import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ScrapeJobMessage, ScrapingFailureAlert } from '../../shared/types';

const snsClient = new SNSClient({});
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

if (!ALERT_TOPIC_ARN) {
  throw new Error('Variable de entorno ALERT_TOPIC_ARN no configurada.');
}

/**
 * Procesa un registro que cayó en la Dead Letter Queue (DLQ)
 */
async function processDlqRecord(record: SQSRecord): Promise<void> {
  let parsedBody: Partial<ScrapeJobMessage> = {};
  try {
    parsedBody = JSON.parse(record.body);
  } catch {
    console.warn(`No se pudo parsear el cuerpo del mensaje DLQ como JSON: ${record.body}`);
  }

  const alertPayload: ScrapingFailureAlert = {
    jobId: parsedBody.jobId,
    storeName: parsedBody.storeName,
    targetUrl: parsedBody.targetUrl,
    errorMessage: `El mensaje ha agotado los reintentos máximos (maxReceiveCount) y fue enviado a la Dead Letter Queue.`,
    timestamp: new Date().toISOString(),
    failedQueueArn: record.eventSourceARN,
    messageId: record.messageId,
  };

  const emailSubject = `[ALERTA AJE] Falla crítica en pipeline de scraping - ${alertPayload.storeName ?? 'Tienda Desconocida'}`;

  const emailBody = `
======================================================================
ALERTA CRÍTICA DE SCRAPING - AJE GROUP
======================================================================
Destinatario: jorregoj@uni.pe
Fecha / Hora: ${alertPayload.timestamp}
Tienda: ${alertPayload.storeName ?? 'N/A'}
URL Objetivo: ${alertPayload.targetUrl ?? 'N/A'}
Job ID: ${alertPayload.jobId ?? 'N/A'}
SQS Message ID: ${alertPayload.messageId}
Cola de Origen (DLQ): ${alertPayload.failedQueueArn}

DESCRIPCIÓN DEL INCIDENTE:
${alertPayload.errorMessage}

Atributos del mensaje SQS:
- ApproximateReceiveCount: ${record.attributes.ApproximateReceiveCount}
- SentTimestamp: ${new Date(Number(record.attributes.SentTimestamp)).toISOString()}

ACCIÓN REQUERIDA:
1. Verificar disponibilidad y cambios en el DOM o bloqueos IP de la URL objetivo.
2. Inspeccionar CloudWatch Logs de la Lambda Scraper para trazas del error.
3. Reprocesar el mensaje de la DLQ una vez corregida la causa raíz.
======================================================================
`;

  console.log(`Publicando alerta a SNS Topic ${ALERT_TOPIC_ARN} para oscar.toledo@ajegroup.com`);

  await snsClient.send(
    new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: emailSubject,
      Message: emailBody,
      MessageAttributes: {
        StoreName: {
          DataType: 'String',
          StringValue: alertPayload.storeName ?? 'Unknown',
        },
        Severity: {
          DataType: 'String',
          StringValue: 'CRITICAL',
        },
      },
    })
  );
}

/**
 * Lambda DLQ Notifier:
 * Se activa automáticamente ante cualquier mensaje en la Dead Letter Queue
 * y despacha notificación inmediata vía SNS al correo configurado.
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  console.log(`Procesando ${event.Records.length} mensajes en la Dead Letter Queue (DLQ)...`);

  for (const record of event.Records) {
    try {
      await processDlqRecord(record);
    } catch (err) {
      console.error(`Error procesando mensaje DLQ ${record.messageId}:`, err);
    }
  }
};
