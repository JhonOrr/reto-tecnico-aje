import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export interface RetoTecnicoAjeStackProps extends cdk.StackProps {
  readonly alertEmailRecipient?: string;
  readonly environmentName?: string;
  readonly googleSheetsWebhookUrl?: string;
}

export class RetoTecnicoAjeStack extends cdk.Stack {
  public readonly mainQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly alertTopic: sns.Topic;
  public readonly dataBucket: s3.Bucket;
  public readonly orchestratorFunction: nodejs.NodejsFunction;
  public readonly scraperFunction: nodejs.NodejsFunction;
  public readonly dlqNotifierFunction: nodejs.NodejsFunction;
  public readonly reporterFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: RetoTecnicoAjeStackProps) {
    super(scope, id, props);

    const envName = props?.environmentName ?? 'prod';
    // const alertEmail = props?.alertEmailRecipient ?? 'oscar.toledo@ajegroup.com';
    const alertEmail = props?.alertEmailRecipient ?? 'oscar.toledo@ajegroup.com';

    
    // =========================================================================
    // 1. SQS: Dead Letter Queue (DLQ) y Cola Principal
    // =========================================================================
    this.deadLetterQueue = new sqs.Queue(this, 'PriceScraperDlq', {
      queueName: `aje-price-scraper-dlq-${envName}`,
      retentionPeriod: cdk.Duration.days(14), // Máxima retención para diagnóstico forense
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });

    this.mainQueue = new sqs.Queue(this, 'PriceScraperMainQueue', {
      queueName: `aje-price-scraper-main-${envName}`,
      visibilityTimeout: cdk.Duration.seconds(360), // >= 6x timeout de la Lambda (60s)
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Redrive policy: 3 reintentos antes de mover a DLQ
      },
    });

    // =========================================================================
    // 2. SNS: Tópico de Alertas y Suscripción por Correo
    // =========================================================================
    this.alertTopic = new sns.Topic(this, 'PriceScraperAlertTopic', {
      topicName: `aje-price-scraper-alerts-${envName}`,
      displayName: 'AJE Group Price Scraper System Alerts',
      enforceSSL: true,
    });

    // Suscripción al correo requerido
    this.alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    // Alarma CloudWatch sobre la DLQ (ApproximateNumberOfMessagesVisible >= 1)
    const dlqMessagesAlarm = new cloudwatch.Alarm(this, 'PriceScraperDlqAlarm', {
      alarmName: `aje-price-scraper-dlq-messages-${envName}`,
      alarmDescription: `Alerta disparada cuando existen mensajes en la DLQ de scraping para ${alertEmail}`,
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dlqMessagesAlarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));

    // =========================================================================
    // 3. S3: Bucket de Almacenamiento (Raw Data y Reportes Consolidados)
    // =========================================================================
    this.dataBucket = new s3.Bucket(this, 'PriceScraperDataBucket', {
      bucketName: `aje-price-scraper-data-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'RawDataRetentionAndTransition',
          prefix: 'raw/',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // =========================================================================
    // 4. Funciones Lambda (TypeScript con NodejsFunction y Node.js 22)
    // =========================================================================
    const commonNodejsProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2 para mayor eficiencia y menor costo
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        externalModules: ['@aws-sdk/*'], // AWS SDK v3 incluido de forma nativa en el runtime
      },
    };

    // A) Orchestrator: Despacha una tarea SQS por cada tienda/URL
    this.orchestratorFunction = new nodejs.NodejsFunction(this, 'OrchestratorFunction', {
      ...commonNodejsProps,
      functionName: `aje-price-scraper-orchestrator-${envName}`,
      entry: path.join(__dirname, '../src/lambdas/orchestrator/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'OrchestratorLogGroup', {
        logGroupName: `/aws/lambda/aje-price-scraper-orchestrator-${envName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        QUEUE_URL: this.mainQueue.queueUrl,
      },
    });

    // B) Scraper Worker: Consume de la cola principal, ejecuta scraping y escribe a S3
    this.scraperFunction = new nodejs.NodejsFunction(this, 'ScraperFunction', {
      ...commonNodejsProps,
      functionName: `aje-price-scraper-worker-${envName}`,
      entry: path.join(__dirname, '../src/lambdas/scraper/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logGroup: new logs.LogGroup(this, 'ScraperLogGroup', {
        logGroupName: `/aws/lambda/aje-price-scraper-worker-${envName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        DATA_BUCKET_NAME: this.dataBucket.bucketName,
      },
    });

    this.scraperFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.mainQueue, {
        batchSize: 1, // Aislamiento de reintentos por tienda individual
        reportBatchItemFailures: true,
      })
    );

    // C) DLQ Notifier: Consume mensajes fallidos de la DLQ y publica alerta detallada a SNS
    this.dlqNotifierFunction = new nodejs.NodejsFunction(this, 'DlqNotifierFunction', {
      ...commonNodejsProps,
      functionName: `aje-price-scraper-dlq-notifier-${envName}`,
      entry: path.join(__dirname, '../src/lambdas/dlq-notifier/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'DlqNotifierLogGroup', {
        logGroupName: `/aws/lambda/aje-price-scraper-dlq-notifier-${envName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
      },
    });

    this.dlqNotifierFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.deadLetterQueue, {
        batchSize: 1,
      })
    );

    // D) Reporter: Agrupa productos, calcula mejor precio y sincroniza a Google Drive/Sheets & S3
    this.reporterFunction = new nodejs.NodejsFunction(this, 'ReporterFunction', {
      ...commonNodejsProps,
      functionName: `aje-price-scraper-reporter-${envName}`,
      entry: path.join(__dirname, '../src/lambdas/reporter/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      logGroup: new logs.LogGroup(this, 'ReporterLogGroup', {
        logGroupName: `/aws/lambda/aje-price-scraper-reporter-${envName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        DATA_BUCKET_NAME: this.dataBucket.bucketName,
        ALERT_TOPIC_ARN: this.alertTopic.topicArn,
        GOOGLE_SECRET_NAME: 'aje/google-service-account',
        GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbwMwFlagIqjhWyduOm4-MuhcIcOeu5v-gqi4FB2KwA4934a5nJGp-x6qo4c4TQV-rSU/exec",
      },
    });

    // =========================================================================
    // 5. Configuración de Permisos IAM (Principio de Mínimo Privilegio)
    // =========================================================================
    // Orchestrator: Solo enviar mensajes a la cola principal
    this.mainQueue.grantSendMessages(this.orchestratorFunction);

    // Scraper Worker: Consumir cola principal y guardar objetos únicamente bajo 'raw/*' en S3
    this.mainQueue.grantConsumeMessages(this.scraperFunction);
    this.dataBucket.grantPut(this.scraperFunction, 'raw/*');

    // DLQ Notifier: Consumir DLQ y publicar mensajes en el tópico SNS de alertas
    this.deadLetterQueue.grantConsumeMessages(this.dlqNotifierFunction);
    this.alertTopic.grantPublish(this.dlqNotifierFunction);

    // Reporter: Lectura de 'raw/*', escritura de 'reports/*' en S3 y publicación de alertas
    this.dataBucket.grantRead(this.reporterFunction, 'raw/*');
    this.dataBucket.grantReadWrite(this.reporterFunction, 'reports/*');
    this.alertTopic.grantPublish(this.reporterFunction);

    // =========================================================================
    // 6. Programación Automatizada (EventBridge Rules)
    // =========================================================================
    const dailyScheduleRule = new events.Rule(this, 'DailyScraperScheduleRule', {
      ruleName: `aje-price-scraper-daily-trigger-${envName}`,
      description: 'Disparador diario del pipeline serverless de scraping para AJE Group',
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }), // 06:00 UTC (01:00 AM Perú)
    });
    dailyScheduleRule.addTarget(new targets.LambdaFunction(this.orchestratorFunction));

    const dailyReporterScheduleRule = new events.Rule(this, 'DailyReporterScheduleRule', {
      ruleName: `aje-price-reporter-daily-trigger-${envName}`,
      description: 'Generación diaria del reporte comparativo y sincronización a Google Drive',
      schedule: events.Schedule.cron({ minute: '15', hour: '6' }), // 06:15 UTC
    });
    dailyReporterScheduleRule.addTarget(new targets.LambdaFunction(this.reporterFunction));

    // =========================================================================
    // 7. Salidas del Stack (CloudFormation Outputs)
    // =========================================================================
    new cdk.CfnOutput(this, 'MainQueueUrlOutput', {
      value: this.mainQueue.queueUrl,
      description: 'URL de la cola principal SQS',
      exportName: `aje-price-scraper-main-queue-url-${envName}`,
    });

    new cdk.CfnOutput(this, 'DlqUrlOutput', {
      value: this.deadLetterQueue.queueUrl,
      description: 'URL de la Dead Letter Queue (DLQ)',
      exportName: `aje-price-scraper-dlq-url-${envName}`,
    });

    new cdk.CfnOutput(this, 'AlertTopicArnOutput', {
      value: this.alertTopic.topicArn,
      description: 'ARN del Tópico SNS de alertas',
      exportName: `aje-price-scraper-alert-topic-arn-${envName}`,
    });

    new cdk.CfnOutput(this, 'DataBucketNameOutput', {
      value: this.dataBucket.bucketName,
      description: 'Nombre del Bucket S3 de datos y reportes',
      exportName: `aje-price-scraper-bucket-name-${envName}`,
    });
  }
}