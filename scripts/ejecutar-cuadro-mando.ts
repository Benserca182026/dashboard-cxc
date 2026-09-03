// Ejecuta la query real (no una versión resumida) contra el dataset real de
// Odoo/Supabase, y vuelca CADA valor intermedio — no solo el KPI final que
// se ve en pantalla. Se corre con: npx tsx scripts/ejecutar-cuadro-mando.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { calcularAging } from "../lib/calculos";
import { construirLecturaEjecutiva } from "../lib/commercial-ejecutivo";
import { leerSerieVentas } from "../lib/lecturas-ventas-reales";
import { BUCKETS } from "../lib/types";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const dataset = await cargarDatasetReal();
  const fechaCorte = FECHA_CORTE_DATOS_REALES;

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente} · corte=${fechaCorte}`);
  console.log(`facturas totales en el dataset: ${dataset.facturas.length}`);
  console.log(`pagos totales: ${dataset.pagos.length}`);
  console.log(`notas de crédito totales: ${dataset.notasCredito.length}`);
  console.log(`clientes totales: ${dataset.clientes.length}`);
  console.log("=".repeat(78));

  // ── CA · CARTERA ──────────────────────────────────────────────────────
  const aging = calcularAging(dataset, fechaCorte);
  console.log("\n### calcularAging() — CADA PASO ###\n");
  console.log(`facturas.clasificadas.length = ${aging.clasificadas.length}`);
  console.log(`facturas.excluidas.length = ${aging.excluidas.length}`);
  console.log(`  motivos de exclusión:`, JSON.stringify(
    aging.excluidas.reduce((acc: Record<string, number>, e: any) => {
      acc[e.motivo] = (acc[e.motivo] ?? 0) + 1;
      return acc;
    }, {})
  ));
  console.log(`\ntotalesPorBucket (Q, ANTES de ordenar por tamaño):`);
  for (const b of BUCKETS) {
    const facturasDeEsteBucket = aging.clasificadas.filter((f: any) => f.bucket === b);
    console.log(`  ${b.padEnd(6)} -> ${fmt(aging.totalesPorBucket[b])}  (${facturasDeEsteBucket.length} facturas)`);
  }
  console.log(`\ntotalClasificado = ${fmt(aging.totalClasificado)}`);
  console.log(`saldoNoClasificable = ${fmt(aging.saldoNoClasificable)}`);
  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;
  console.log(`carteraTotal (clasificado + no clasificable) = ${fmt(carteraTotal)}`);
  console.log(`coberturaCartera = totalClasificado/carteraTotal*100 = ${aging.totalClasificado}/${carteraTotal}*100 = ${(aging.totalClasificado/carteraTotal*100).toFixed(4)}%`);
  const facturasVencidas = aging.clasificadas.filter((f: any) => f.bucket !== "actual").length;
  console.log(`facturasVencidas (bucket != actual) = ${facturasVencidas}`);

  // ── CO · COBRANZA ─────────────────────────────────────────────────────
  const ejecutiva = construirLecturaEjecutiva(dataset, fechaCorte);
  console.log("\n### construirLecturaEjecutiva() — CADA PASO ###\n");
  console.log(`totalVencido = ${fmt(ejecutiva.totalVencido)}`);
  console.log(`totalMoraCritica (bucket 90+) = ${fmt(ejecutiva.totalMoraCritica)}`);
  console.log(`totalMora180 (dias > 180, subconjunto de moraCritica) = ${fmt(ejecutiva.totalMora180)}`);
  console.log(`totalCarteraClasificable = ${fmt(ejecutiva.totalCarteraClasificable)}`);
  console.log(`sinFechaVencimiento (conteo) = ${ejecutiva.sinFechaVencimiento}`);
  const mora90a180 = Math.max(ejecutiva.totalMoraCritica - ejecutiva.totalMora180, 0);
  const vencidoTemprano = Math.max(ejecutiva.totalVencido - ejecutiva.totalMoraCritica, 0);
  const alDia = aging.totalesPorBucket.actual;
  console.log(`\nmora90a180 = totalMoraCritica - totalMora180 = ${ejecutiva.totalMoraCritica} - ${ejecutiva.totalMora180} = ${fmt(mora90a180)}`);
  console.log(`vencidoTemprano = totalVencido - totalMoraCritica = ${ejecutiva.totalVencido} - ${ejecutiva.totalMoraCritica} = ${fmt(vencidoTemprano)}`);
  console.log(`alDia (bucket actual) = ${fmt(alDia)}`);
  const pctVencido = ejecutiva.totalCarteraClasificable > 0 ? (ejecutiva.totalVencido / ejecutiva.totalCarteraClasificable) * 100 : 0;
  const pctCritica = ejecutiva.totalVencido > 0 ? (ejecutiva.totalMoraCritica / ejecutiva.totalVencido) * 100 : 0;
  const coberturaCobranza = ejecutiva.totalVencido > 0 ? (vencidoTemprano / ejecutiva.totalVencido) * 100 : 0;
  console.log(`\npctVencido = totalVencido/totalCarteraClasificable*100 = ${ejecutiva.totalVencido}/${ejecutiva.totalCarteraClasificable}*100 = ${pctVencido.toFixed(6)}%`);
  console.log(`pctCritica = totalMoraCritica/totalVencido*100 = ${ejecutiva.totalMoraCritica}/${ejecutiva.totalVencido}*100 = ${pctCritica.toFixed(6)}%`);
  console.log(`coberturaCobranza = vencidoTemprano/totalVencido*100 = ${vencidoTemprano}/${ejecutiva.totalVencido}*100 = ${coberturaCobranza.toFixed(6)}%`);
  console.log(`>>> VERIFICACION ALGEBRAICA: pctCritica + coberturaCobranza = ${pctCritica.toFixed(6)} + ${coberturaCobranza.toFixed(6)} = ${(pctCritica + coberturaCobranza).toFixed(6)} (¿=100?)`);

  // ── CL · CLIENTES ─────────────────────────────────────────────────────
  console.log("\n### CL Clientes — ejecutiva.oportunidades (Top 5 real) ###\n");
  console.log(`ejecutiva.oportunidades.length = ${ejecutiva.oportunidades.length} (debería ser 5, topCinco() los recorta)`);
  ejecutiva.oportunidades.forEach((o: any, i: number) => {
    console.log(`  [${i}] ${o.nombre.padEnd(45)} monto=${fmt(o.monto)}  participacion=${o.participacion.toFixed(4)}%  detalle="${o.detalle}"`);
  });
  const clientesConVencido = new Set(
    aging.clasificadas.filter((f: any) => f.bucket !== "actual").map((f: any) => f.factura.id_cliente)
  ).size;
  console.log(`\nclientesConVencido (Set de id_cliente únicos con bucket != actual) = ${clientesConVencido}`);
  const sumaTop5 = ejecutiva.oportunidades.reduce((s: number, o: any) => s + o.monto, 0);
  console.log(`sumaTop5 (suma de los 5 montos de arriba) = ${fmt(sumaTop5)}`);
  console.log(`concentracionTop5 = sumaTop5/totalVencido*100 = ${sumaTop5}/${ejecutiva.totalVencido}*100 = ${(sumaTop5/ejecutiva.totalVencido*100).toFixed(6)}%`);

  // ── VE · VENTAS ───────────────────────────────────────────────────────
  const serie = leerSerieVentas(dataset);
  console.log("\n### leerSerieVentas() — CADA PASO ###\n");
  console.log(`serie.desde = ${serie.desde} · serie.corte = ${serie.corte}`);
  console.log(`serie.total = ${fmt(serie.total)} · serie.pedidos = ${serie.pedidos} · serie.clientes = ${serie.clientes}`);
  console.log(`\nserie.anios (los últimos 4, orden real que trae la función):`);
  serie.anios.slice(-4).forEach((a: any) => {
    console.log(`  ${a.anio}${a.parcial ? " (parcial)" : ""}: valor=${fmt(a.valor)} pedidos=${a.pedidos} clientes=${a.clientes} ticket=${fmt(a.ticket)} pedidosOtraMoneda=${a.pedidosOtraMoneda} monedasOtras=${JSON.stringify(a.monedasOtras)}`);
  });
  if (serie.ytd) {
    console.log(`\nserie.ytd.actual: ${JSON.stringify(serie.ytd.actual, null, 2)}`);
    console.log(`serie.ytd.previo: ${JSON.stringify(serie.ytd.previo, null, 2)}`);
    console.log(`serie.ytd.variacionValor = ${serie.ytd.variacionValor}`);
    console.log(`serie.ytd.variacionClientes = ${serie.ytd.variacionClientes}`);
    console.log(`\nverificacion manual variacionValor = (actual.valor - previo.valor)/previo.valor*100 = (${serie.ytd.actual.valor} - ${serie.ytd.previo.valor})/${serie.ytd.previo.valor}*100 = ${((serie.ytd.actual.valor - serie.ytd.previo.valor)/serie.ytd.previo.valor*100).toFixed(6)}`);
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
