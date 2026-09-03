// Ejecuta la query real (no una version resumida) contra el dataset real de
// Odoo/Supabase para la pagina /aging, y vuelca CADA valor intermedio -- no
// solo el KPI final que se ve en pantalla. Mismo patron que
// scripts/ejecutar-cuadro-mando.ts. Se corre con:
//   npx tsx scripts/ejecutar-aging.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { calcularAging } from "../lib/calculos";
import { analizarAgingComercial, analizarSeguimientoComercial } from "../lib/commercial-cobranza";
import { prioridadSimulada } from "../lib/simulados";
import { BUCKETS } from "../lib/types";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(4)}%`;

async function main() {
  const dataset = await cargarDatasetReal();
  const fechaCorte = FECHA_CORTE_DATOS_REALES;

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente} · corte=${fechaCorte}`);
  console.log(`facturas totales: ${dataset.facturas.length} · pagos: ${dataset.pagos.length} · clientes: ${dataset.clientes.length}`);
  console.log("=".repeat(78));

  // ── AN · Antiguedad ──────────────────────────────────────────────────
  const aging = calcularAging(dataset, fechaCorte);
  console.log("\n### calcularAging() -- CADA PASO ###\n");
  console.log(`clasificadas.length = ${aging.clasificadas.length} · excluidas.length = ${aging.excluidas.length}`);
  console.log(`motivos de exclusion:`, JSON.stringify(
    aging.excluidas.reduce((acc: Record<string, number>, e: any) => { acc[e.motivo] = (acc[e.motivo] ?? 0) + 1; return acc; }, {})
  ));
  console.log(`\ntotalesPorBucket (orden BUCKETS, cronologico):`);
  for (const b of BUCKETS) {
    const filas = aging.clasificadas.filter((f: any) => f.bucket === b);
    console.log(`  ${b.padEnd(6)} -> ${fmt(aging.totalesPorBucket[b])}  (${filas.length} facturas, ${new Set(filas.map((f:any)=>f.factura.id_cliente)).size} clientes distintos)`);
  }
  console.log(`\norden que produce repartir() (por pct desc -- el que se ve en pantalla):`);
  const totalBuckets = BUCKETS.reduce((s, b) => s + aging.totalesPorBucket[b], 0);
  const ordenPct = BUCKETS.map((b) => ({ b, pct: totalBuckets > 0 ? (aging.totalesPorBucket[b]/totalBuckets*100) : 0 })).sort((a,b)=>b.pct-a.pct);
  ordenPct.forEach((o) => console.log(`  ${o.b.padEnd(6)} -> ${pct(o.pct)}`));

  console.log(`\ntotalClasificado = ${fmt(aging.totalClasificado)} · saldoNoClasificable = ${fmt(aging.saldoNoClasificable)}`);
  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;
  const coberturaAntiguedad = carteraTotal > 0 ? (aging.totalClasificado / carteraTotal) * 100 : 0;
  console.log(`coberturaAntiguedad = ${pct(coberturaAntiguedad)}`);
  const facturasVencidasAN = aging.clasificadas.filter((f: any) => f.bucket !== "actual").length;
  console.log(`facturasVencidasAN (conteo suelto, KPI actual de Prioriza) = ${facturasVencidasAN}`);
  console.log(`  como ratio: ${facturasVencidasAN} / ${aging.clasificadas.length} = ${pct(facturasVencidasAN/aging.clasificadas.length*100)}`);

  console.log(`\nticket promedio por bucket (opcion para Explica, igual patron que CA-Explica de Cuadro de mando):`);
  const bucketLiderKey = [...BUCKETS].sort((a,b)=>aging.totalesPorBucket[b]-aging.totalesPorBucket[a])[0];
  for (const b of BUCKETS) {
    const filas = aging.clasificadas.filter((f: any) => f.bucket === b);
    const prom = filas.length > 0 ? filas.reduce((s:number,f:any)=>s+f.saldo,0)/filas.length : 0;
    console.log(`  ${b.padEnd(6)}: ${filas.length} facturas, ticket promedio = ${fmt(prom)}${b===bucketLiderKey ? "  <- bucket lider" : ""}`);
  }

  // ── CN · Concentracion ───────────────────────────────────────────────
  const comercial = analizarAgingComercial(dataset, fechaCorte, [], aging);
  console.log("\n### analizarAgingComercial() -- CADA PASO ###\n");
  console.log(`vencido total = ${fmt(comercial.vencido)}`);
  console.log(`topClientes.length = ${comercial.topClientes.length}`);
  comercial.topClientes.forEach((c: any, i: number) => {
    console.log(`  [${i}] ${c.nombre.padEnd(40)} saldo=${fmt(c.saldo)} diasMax=${c.diasMax} facturas=${c.facturas} acumuladoPct=${c.acumuladoPct.toFixed(4)}%`);
  });
  console.log(`porcentajeTopDiez = ${pct(comercial.porcentajeTopDiez)}`);
  console.log(`clientesParaOchentaPct = ${comercial.clientesParaOchentaPct}`);
  const mayorDeudor = comercial.topClientes[0];
  const topDos = (comercial.topClientes[0] ? (comercial.topClientes[0].saldo/comercial.vencido*100) : 0) + (comercial.topClientes[1] ? (comercial.topClientes[1].saldo/comercial.vencido*100) : 0);
  console.log(`\ntopDosConcentracion (KPI actual de Explica) = ${pct(topDos)}`);

  console.log(`\nranking alternativo por CANTIDAD DE FACTURAS vencidas (opcion Explica, igual patron que CL-Explica):`);
  const facturasPorCliente = new Map<string, number>();
  const saldoPorCliente = new Map<string, number>();
  const nombrePorId = new Map(dataset.clientes.map((c: any) => [c.id_cliente, c.nombre_cliente]));
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    facturasPorCliente.set(f.factura.id_cliente, (facturasPorCliente.get(f.factura.id_cliente) ?? 0) + 1);
    saldoPorCliente.set(f.factura.id_cliente, (saldoPorCliente.get(f.factura.id_cliente) ?? 0) + f.saldo);
  }
  const topPorFacturas = [...facturasPorCliente.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  topPorFacturas.forEach(([id,n]) => console.log(`  ${(nombrePorId.get(id) ?? id).toString().padEnd(40)} ${n} facturas vencidas · saldo ${fmt(saldoPorCliente.get(id) ?? 0)}`));
  console.log(`lider por facturas: ${nombrePorId.get(topPorFacturas[0]?.[0] ?? "")} con ${topPorFacturas[0]?.[1]} facturas ¿coincide con mayor deudor por monto (${mayorDeudor?.nombre})? ${topPorFacturas[0]?.[0] === undefined ? "n/a" : (topPorFacturas[0][0] === (comercial.topClientes[0] as any)?.idCliente ? "SI" : "NO")}`);

  // ── EX · Exclusiones ─────────────────────────────────────────────────
  console.log("\n### EX Exclusiones -- CADA PASO ###\n");
  const motivos = ["pagada", "anulada", "sin_fecha_vencimiento"] as const;
  for (const m of motivos) {
    const filas = aging.excluidas.filter((e: any) => e.motivo === m);
    const saldo = filas.reduce((s:number,e:any)=>s+e.saldo,0);
    console.log(`  ${m.padEnd(24)}: ${filas.length} facturas · saldo ${fmt(saldo)}`);
  }
  const motivosPresentes = [...new Set(aging.excluidas.map((f:any)=>f.motivo))];
  console.log(`motivosPresentes.length (KPI actual de Explica) = ${motivosPresentes.length}`);
  const totalFacturasDataset = aging.clasificadas.length + aging.excluidas.length;
  console.log(`coberturaExclusiones = clasificadas/(clasificadas+excluidas) = ${aging.clasificadas.length}/${totalFacturasDataset} = ${pct(aging.clasificadas.length/totalFacturasDataset*100)}`);

  // ── GE · Gestion (dataset real: gestiones = [] segun lib/store.tsx) ────
  console.log("\n### analizarSeguimientoComercial() con gestiones=[] (asi llega en produccion para odoo-real) -- CADA PASO ###\n");
  const seguimiento = analizarSeguimientoComercial(dataset, fechaCorte, []);
  seguimiento.embudo.forEach((e: any) => console.log(`  ${e.id.padEnd(12)} ${e.etiqueta.padEnd(28)} clientes=${e.clientes}  (${e.aclaracion})`));
  console.log(`sinGestion.length = ${seguimiento.sinGestion.length} · saldoSinGestion = ${fmt(seguimiento.saldoSinGestion)}`);
  const vencidoTotal = seguimiento.embudo[0]?.clientes ?? 0;
  const contactadoTotal = seguimiento.embudo[1]?.clientes ?? 0;
  console.log(`coberturaGestion = contactado/vencido = ${contactadoTotal}/${vencidoTotal} = ${pct(vencidoTotal>0?contactadoTotal/vencidoTotal*100:0)}`);

  // ── Cruce clave: poblacion "vencido" de AN/CN (por FACTURA, calcularAging)
  // vs poblacion "vencido" de GE (por CLIENTE via prioridadSimulada -> dias
  // = MAXIMO de dias de atraso entre TODAS sus facturas abiertas).
  console.log("\n" + "=".repeat(78));
  console.log("CRUCE: poblacion 'clientes con vencido' -- AN/CN (por factura) vs GE (por cliente, prioridadSimulada)");
  console.log("=".repeat(78));
  const clientesConVencidoANCN = new Set(
    aging.clasificadas.filter((f: any) => f.bucket !== "actual").map((f: any) => f.factura.id_cliente)
  );
  const prioridad = prioridadSimulada(dataset, fechaCorte);
  const clientesConVencidoGE = new Set(prioridad.filter((f) => f.diasMaxAtraso > 0).map((f) => f.idCliente));
  console.log(`clientesConVencidoANCN.size (via calcularAging, bucket != actual) = ${clientesConVencidoANCN.size}`);
  console.log(`clientesConVencidoGE.size (via prioridadSimulada, diasMaxAtraso > 0) = ${clientesConVencidoGE.size}`);
  const soloEnANCN = [...clientesConVencidoANCN].filter((id) => !clientesConVencidoGE.has(id));
  const soloEnGE = [...clientesConVencidoGE].filter((id) => !clientesConVencidoANCN.has(id));
  console.log(`en ANCN pero NO en GE: ${soloEnANCN.length}`);
  console.log(`en GE pero NO en ANCN: ${soloEnGE.length}`);

  // ── Cruce clave 2: saldoSinGestion (GE) usa fila.saldo = saldoTotal de
  // prioridadSimulada (TODAS las facturas abiertas del cliente, no solo las
  // vencidas) -- comparar contra "saldo VENCIDO real" de esos mismos clientes
  // (solo las facturas con bucket != actual, via calcularAging).
  console.log("\n" + "=".repeat(78));
  console.log("CRUCE: saldoSinGestion (GE, usa saldoTotal TODO abierto) vs saldo VENCIDO real de esos mismos clientes");
  console.log("=".repeat(78));
  const idsSinGestion = new Set(seguimiento.sinGestion.map((f) => f.idCliente));
  const saldoVencidoPorCliente = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    saldoVencidoPorCliente.set(f.factura.id_cliente, (saldoVencidoPorCliente.get(f.factura.id_cliente) ?? 0) + f.saldo);
  }
  let saldoVencidoRealSinGestion = 0;
  let saldoTotalSinGestion = 0;
  for (const id of idsSinGestion) {
    saldoVencidoRealSinGestion += saldoVencidoPorCliente.get(id) ?? 0;
    const fila = prioridad.find((p) => p.idCliente === id);
    saldoTotalSinGestion += fila?.saldoTotal ?? 0;
  }
  console.log(`saldoSinGestion segun GE (seguimiento.saldoSinGestion, = suma de fila.saldo = saldoTotal) = ${fmt(seguimiento.saldoSinGestion)}`);
  console.log(`recalculado a mano (suma saldoTotal de prioridadSimulada para los mismos ${idsSinGestion.size} clientes) = ${fmt(saldoTotalSinGestion)}`);
  console.log(`saldo VENCIDO real de esos mismos clientes (solo facturas bucket != actual) = ${fmt(saldoVencidoRealSinGestion)}`);
  console.log(`diferencia (saldo al dia que se cuela como "vencido sin gestion") = ${fmt(saldoTotalSinGestion - saldoVencidoRealSinGestion)} (${pct((saldoTotalSinGestion-saldoVencidoRealSinGestion)/saldoTotalSinGestion*100)} del total mostrado)`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
