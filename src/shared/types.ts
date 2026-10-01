/**
 * Tipos y contratos compartidos para el Pipeline Serverless de Scraping
 * Reto Técnico AJE Group
 */

export type StoreName = 'Dermashop' | 'Flora y Fauna' | 'Inkafarma';

export type StockStatus = 'disponible' | 'no disponible';

export type BestPriceStatus = 'Sí' | 'No' | 'Empate' | 'Único disponible';

export interface TargetStoreConfig {
  readonly id: string;
  readonly name: StoreName;
  readonly url: string;
}

export const TARGET_STORES: readonly TargetStoreConfig[] = [
  {
    id: 'dermashop',
    name: 'Dermashop',
    url: 'https://dermashop.pe/',
  },
  {
    id: 'flora-y-fauna',
    name: 'Flora y Fauna',
    url: 'https://florayfauna.pe/',
  },
  {
    id: 'inkafarma',
    name: 'Inkafarma',
    url: 'https://inkafarma.pe/',
  },
] as const;

/**
 * Mensaje emitido a la cola principal SQS para procesar una tienda
 */
export interface ScrapeJobMessage {
  readonly jobId: string;
  readonly storeId: string;
  readonly storeName: StoreName;
  readonly targetUrl: string;
  readonly scheduledDate: string; // Formato YYYY-MM-DD
  readonly timestamp: string;
  readonly retryCount?: number;
}

/**
 * Registro de producto extraído de una tienda
 */
export interface ScrapedProduct {
  readonly productCategory: string; // Producto / Categoría
  readonly store: StoreName;
  readonly price: number;
  readonly currency: string; // e.g. 'PEN'
  readonly stock: StockStatus;
  readonly sourceUrl: string;
  readonly extractedAt: string;
}

/**
 * Fila del reporte comparativo final
 */
export interface PriceComparisonReportRow {
  readonly 'Producto/categoria': string;
  readonly 'Tienda (Dermashop, Flora y Fauna o Inkafarma)': StoreName;
  readonly 'Precio': number | string;
  readonly 'Stock (disponible / no disponible)': StockStatus;
  readonly 'url de origen': string;
  readonly 'Es el mejor precio de los 3': BestPriceStatus;
}

/**
 * Notificación de error a enviar vía SNS
 */
export interface ScrapingFailureAlert {
  readonly jobId?: string;
  readonly storeName?: StoreName | string;
  readonly targetUrl?: string;
  readonly errorMessage: string;
  readonly errorStack?: string;
  readonly timestamp: string;
  readonly failedQueueArn: string;
  readonly messageId?: string;
}
