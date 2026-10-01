import { TARGET_STORES, ScrapedProduct, StoreName, StockStatus } from '../src/shared/types';
import { buildComparisonReportRows, generateCsvContent } from '../src/shared/report-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script de simulación local del pipeline completo (sin requerir AWS)
 * Demuestra:
 * 1. Orquestación y fan-out por tienda
 * 2. Scraping y extracción de datos
 * 3. Consolidación, algoritmo de mejor precio y generación de CSV
 */
async function simulatePipeline() {
  console.log('='.repeat(70));
  console.log('🚀 SIMULACIÓN LOCAL DEL PIPELINE DE SCRAPING - AJE GROUP');
  console.log('='.repeat(70));

  const scheduledDate = new Date().toISOString().split('T')[0];
  console.log(`\n1. [Orchestrator] Identificando tiendas objetivo para la fecha: ${scheduledDate}`);
  for (const store of TARGET_STORES) {
    console.log(`   - Tienda: ${store.name.padEnd(15)} | URL: ${store.url}`);
  }

  console.log('\n2. [Scraper Worker] Simulando extracción de productos...');
  const categorySamples: Record<StoreName, Array<{ category: string; price: number; stock: StockStatus; path: string }>> = {
    'Dermashop': [
      { category: 'Cuidado Facial - Bloqueador Solar SPF 50+', price: 89.90, stock: 'disponible', path: 'bloqueador-solar-spf-50' },
      { category: 'Cuidado Facial - Serum Vitamina C 30ml', price: 125.00, stock: 'disponible', path: 'serum-vitamina-c-30ml' },
      { category: 'Cuidado Corporal - Crema Hidratante Cerav', price: 74.50, stock: 'disponible', path: 'crema-hidratante-cerav' },
      { category: 'Cuidado Personal - Gel Limpiador Espumoso 400ml', price: 92.00, stock: 'no disponible', path: 'gel-limpiador-espumoso-400ml' },
      { category: 'Nutrición / Suplementos - Colágeno Hidrolizado 300g', price: 110.00, stock: 'disponible', path: 'colageno-hidrolizado-300g' },
    ],
    'Flora y Fauna': [
      { category: 'Cuidado Facial - Bloqueador Solar SPF 50+', price: 95.00, stock: 'disponible', path: 'bloqueador-solar-natural-spf-50' },
      { category: 'Cuidado Facial - Serum Vitamina C 30ml', price: 119.90, stock: 'disponible', path: 'serum-vitamina-c-organico' },
      { category: 'Cuidado Corporal - Crema Hidratante Cerav', price: 78.00, stock: 'disponible', path: 'crema-hidratante-botanica' },
      { category: 'Cuidado Personal - Gel Limpiador Espumoso 400ml', price: 88.50, stock: 'disponible', path: 'gel-limpiador-botanico-400ml' },
      { category: 'Nutrición / Suplementos - Colágeno Hidrolizado 300g', price: 105.00, stock: 'disponible', path: 'colageno-hidrolizado-bio-300g' },
    ],
    'Inkafarma': [
      { category: 'Cuidado Facial - Bloqueador Solar SPF 50+', price: 84.90, stock: 'disponible', path: 'bloqueador-solar-spf-50' },
      { category: 'Cuidado Facial - Serum Vitamina C 30ml', price: 130.00, stock: 'no disponible', path: 'serum-vitamina-c-30ml' },
      { category: 'Cuidado Corporal - Crema Hidratante Cerav', price: 72.90, stock: 'disponible', path: 'crema-hidratante-cerav' },
      { category: 'Cuidado Personal - Gel Limpiador Espumoso 400ml', price: 85.00, stock: 'disponible', path: 'gel-limpiador-espumoso-400ml' },
      { category: 'Nutrición / Suplementos - Colágeno Hidrolizado 300g', price: 115.00, stock: 'disponible', path: 'colageno-hidrolizado-300g' },
    ],
  };

  const allProducts: ScrapedProduct[] = [];
  const now = new Date().toISOString();

  for (const store of TARGET_STORES) {
    const items = categorySamples[store.name] || [];
    for (const item of items) {
      allProducts.push({
        productCategory: item.category,
        store: store.name,
        price: item.price,
        currency: 'PEN',
        stock: item.stock,
        sourceUrl: new URL(item.path, store.url).toString(),
        extractedAt: now,
      });
    }
    console.log(`   ✓ Tienda ${store.name}: ${items.length} productos procesados.`);
  }

  console.log(`\n3. [Reporter] Calculando comparativo y determinando 'Mejor precio de los 3'...`);
  const reportRows = buildComparisonReportRows(allProducts);

  console.log('\n📊 VISTA PREVIA DEL COMPARATIVO CALCULADO:');
  console.table(
    reportRows.map((r) => ({
      Producto: r['Producto/categoria'].substring(0, 32),
      Tienda: r['Tienda (Dermashop, Flora y Fauna o Inkafarma)'],
      Precio: `S/ ${typeof r.Precio === 'number' ? r.Precio.toFixed(2) : r.Precio}`,
      Stock: r['Stock (disponible / no disponible)'],
      'Mejor Precio': r['Es el mejor precio de los 3'],
    }))
  );

  console.log('\n4. [Reporter] Generando archivo CSV estructurado...');
  const csvContent = generateCsvContent(reportRows);

  const [year, month, day] = scheduledDate.split('-');
  const outputDir = path.join(__dirname, `../output/${year}/${month}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `Precios_Comparativos_${year}_${month}_${day}.csv`);
  fs.writeFileSync(outputFile, csvContent, 'utf-8');

  console.log(`\n✅ Archivo CSV generado exitosamente en:`);
  console.log(`   ${outputFile}`);

  console.log('\nPrimeras 5 líneas del CSV resultante:');
  console.log('-'.repeat(70));
  console.log(csvContent.split('\n').slice(0, 5).join('\n'));
  console.log('-'.repeat(70));
  console.log('\nSimulación finalizada con éxito.');
}

simulatePipeline().catch(console.error);
