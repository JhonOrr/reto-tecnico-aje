import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { TARGET_STORES, ScrapeJobMessage } from '../../shared/types';

const sqsClient = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL;

if (!QUEUE_URL) {
  throw new Error('Variable de entorno QUEUE_URL no configurada.');
}

/**
 * Lambda Orchestrator:
 * Inicia la ejecución diaria del pipeline enviando tareas desacopladas a SQS por cada tienda objetivo.
 */
export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
  console.log('Iniciando orquestación de tareas de scraping...', JSON.stringify(event));

  const now = new Date();
  const scheduledDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const jobId = `job-${scheduledDate}-${Date.now()}`;

  const dispatchPromises = TARGET_STORES.map(async (store) => {
    const payload: ScrapeJobMessage = {
      jobId,
      storeId: store.id,
      storeName: store.name,
      targetUrl: store.url,
      scheduledDate,
      timestamp: now.toISOString(),
      retryCount: 0,
    };

    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        StoreId: {
          DataType: 'String',
          StringValue: store.id,
        },
        ScheduledDate: {
          DataType: 'String',
          StringValue: scheduledDate,
        },
      },
    });

    console.log(`Enviando tarea para tienda ${store.name} (${store.url}) a SQS`);
    return sqsClient.send(command);
  });

  const results = await Promise.allSettled(dispatchPromises);
  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Orquestación finalizada. Exitosas: ${successful}, Fallidas: ${failed}`);

  if (failed > 0) {
    throw new Error(`Error al despachar ${failed} tareas a SQS`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Tareas de scraping despachadas correctamente a la cola principal SQS.',
      jobId,
      dispatchedStores: TARGET_STORES.length,
      scheduledDate,
    }),
  };
};
