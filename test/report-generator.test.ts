import { buildComparisonReportRows, generateCsvContent } from '../src/shared/report-generator';
import { ScrapedProduct } from '../src/shared/types';

describe('Report Generator Business Logic Tests', () => {
  const sampleProducts: ScrapedProduct[] = [
    {
      productCategory: 'Bloqueador Solar SPF 50+',
      store: 'Dermashop',
      price: 89.9,
      currency: 'PEN',
      stock: 'disponible',
      sourceUrl: 'https://dermashop.pe/bloqueador',
      extractedAt: '2026-10-01T06:05:00.000Z',
    },
    {
      productCategory: 'Bloqueador Solar SPF 50+',
      store: 'Flora y Fauna',
      price: 95.0,
      currency: 'PEN',
      stock: 'disponible',
      sourceUrl: 'https://florayfauna.pe/bloqueador',
      extractedAt: '2026-10-01T06:05:00.000Z',
    },
    {
      productCategory: 'Bloqueador Solar SPF 50+',
      store: 'Inkafarma',
      price: 84.9,
      currency: 'PEN',
      stock: 'disponible',
      sourceUrl: 'https://inkafarma.pe/bloqueador',
      extractedAt: '2026-10-01T06:05:00.000Z',
    },
  ];

  test('Correctly identifies the single best price among 3 stores', () => {
    const rows = buildComparisonReportRows(sampleProducts);

    expect(rows).toHaveLength(3);
    const inkafarmaRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Inkafarma');
    const dermashopRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Dermashop');
    const floraRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Flora y Fauna');

    expect(inkafarmaRow?.['Es el mejor precio de los 3']).toBe('Sí');
    expect(dermashopRow?.['Es el mejor precio de los 3']).toBe('No');
    expect(floraRow?.['Es el mejor precio de los 3']).toBe('No');
  });

  test('Marks tie ("Empate") when two or more stores offer the lowest price', () => {
    const productsWithTie: ScrapedProduct[] = [
      {
        productCategory: 'Serum Vitamina C',
        store: 'Dermashop',
        price: 99.0,
        currency: 'PEN',
        stock: 'disponible',
        sourceUrl: 'https://dermashop.pe/serum',
        extractedAt: '2026-10-01T06:05:00.000Z',
      },
      {
        productCategory: 'Serum Vitamina C',
        store: 'Flora y Fauna',
        price: 99.0,
        currency: 'PEN',
        stock: 'disponible',
        sourceUrl: 'https://florayfauna.pe/serum',
        extractedAt: '2026-10-01T06:05:00.000Z',
      },
      {
        productCategory: 'Serum Vitamina C',
        store: 'Inkafarma',
        price: 110.0,
        currency: 'PEN',
        stock: 'disponible',
        sourceUrl: 'https://inkafarma.pe/serum',
        extractedAt: '2026-10-01T06:05:00.000Z',
      },
    ];

    const rows = buildComparisonReportRows(productsWithTie);
    const dermashopRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Dermashop');
    const floraRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Flora y Fauna');
    const inkafarmaRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Inkafarma');

    expect(dermashopRow?.['Es el mejor precio de los 3']).toBe('Empate');
    expect(floraRow?.['Es el mejor precio de los 3']).toBe('Empate');
    expect(inkafarmaRow?.['Es el mejor precio de los 3']).toBe('No');
  });

  test('Does not mark as best price if product is out of stock ("no disponible")', () => {
    const productsWithOutOfStock: ScrapedProduct[] = [
      {
        productCategory: 'Crema Hidratante',
        store: 'Dermashop',
        price: 50.0, // Más bajo pero sin stock
        currency: 'PEN',
        stock: 'no disponible',
        sourceUrl: 'https://dermashop.pe/crema',
        extractedAt: '2026-10-01T06:05:00.000Z',
      },
      {
        productCategory: 'Crema Hidratante',
        store: 'Inkafarma',
        price: 70.0, // Disponible
        currency: 'PEN',
        stock: 'disponible',
        sourceUrl: 'https://inkafarma.pe/crema',
        extractedAt: '2026-10-01T06:05:00.000Z',
      },
    ];

    const rows = buildComparisonReportRows(productsWithOutOfStock);
    const dermashopRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Dermashop');
    const inkafarmaRow = rows.find((r) => r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'] === 'Inkafarma');

    expect(dermashopRow?.['Es el mejor precio de los 3']).toBe('No');
    expect(inkafarmaRow?.['Es el mejor precio de los 3']).toBe('Sí');
  });

  test('Generates valid CSV formatted with semicolon (;) delimiter and proper quotes', () => {
    const rows = buildComparisonReportRows(sampleProducts);
    const csv = generateCsvContent(rows);

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Producto/categoria;Tienda (Dermashop, Flora y Fauna o Inkafarma);Precio;Stock (disponible / no disponible);url de origen;columa que diga si es el mejor precio de los 3'
    );
    expect(lines.length).toBe(4); // Cabecera + 3 filas
    expect(lines[1]).toContain(';');
  });
});
