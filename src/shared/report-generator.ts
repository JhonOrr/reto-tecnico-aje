import {
  ScrapedProduct,
  PriceComparisonReportRow,
  BestPriceStatus,
} from './types';

/**
 * Realiza la comparación de precios e identifica cuál es el mejor precio entre las tiendas
 */
export function buildComparisonReportRows(products: ScrapedProduct[]): PriceComparisonReportRow[] {
  // Agrupar por producto/categoría
  const groupedByCategory = new Map<string, ScrapedProduct[]>();

  for (const product of products) {
    const list = groupedByCategory.get(product.productCategory) || [];
    list.push(product);
    groupedByCategory.set(product.productCategory, list);
  }

  const rows: PriceComparisonReportRow[] = [];

  for (const [category, items] of groupedByCategory.entries()) {
    // Filtrar los que tengan stock disponible para calcular el mejor precio real
    const availableItems = items.filter((i) => i.stock === 'disponible');

    let minPrice = Infinity;
    if (availableItems.length > 0) {
      minPrice = Math.min(...availableItems.map((i) => i.price));
    } else {
      // Si ninguno tiene stock, tomamos el mínimo referencial
      minPrice = Math.min(...items.map((i) => i.price));
    }

    for (const item of items) {
      let isBestPrice: BestPriceStatus = 'No';

      if (item.stock === 'disponible' && item.price === minPrice) {
        // Verificar si hay empate
        const itemsWithMin = availableItems.filter((i) => i.price === minPrice);
        isBestPrice = itemsWithMin.length > 1 ? 'Empate' : 'Sí';
      } else if (item.stock === 'no disponible') {
        isBestPrice = 'No';
      }

      rows.push({
        'Producto/categoria': item.productCategory,
        'Tienda (Dermashop, Flora y Fauna o Inkafarma)': item.store,
        'Precio': item.price,
        'Stock (disponible / no disponible)': item.stock,
        'url de origen': item.sourceUrl,
        'Es el mejor precio de los 3': isBestPrice,
      });
    }
  }

  // Ordenar por categoría y luego por tienda
  return rows.sort((a, b) => {
    const catComp = a['Producto/categoria'].localeCompare(b['Producto/categoria']);
    if (catComp !== 0) return catComp;
    return a['Tienda (Dermashop, Flora y Fauna o Inkafarma)'].localeCompare(
      b['Tienda (Dermashop, Flora y Fauna o Inkafarma)']
    );
  });
}

/**
 * Genera el contenido CSV con delimitador ';' requerido por el estándar de reporte
 */
export function generateCsvContent(rows: PriceComparisonReportRow[]): string {
  const headers = [
    'Producto/categoria',
    'Tienda (Dermashop, Flora y Fauna o Inkafarma)',
    'Precio',
    'Stock (disponible / no disponible)',
    'url de origen',
    'columa que diga si es el mejor precio de los 3',
  ];

  const lines = [headers.join(';')];

  for (const row of rows) {
    const line = [
      `"${row['Producto/categoria'].replace(/"/g, '""')}"`,
      `"${row['Tienda (Dermashop, Flora y Fauna o Inkafarma)']}"`,
      typeof row.Precio === 'number' ? row.Precio.toFixed(2) : row.Precio,
      `"${row['Stock (disponible / no disponible)']}"`,
      `"${row['url de origen']}"`,
      `"${row['Es el mejor precio de los 3']}"`,
    ];
    lines.push(line.join(';'));
  }

  return lines.join('\n');
}
