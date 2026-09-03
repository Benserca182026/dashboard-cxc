// Ejecuta candidatos de reemplazo para los KPIs débiles del piloto, con
// números reales, no hipotéticos. npx tsx scripts/opciones-reemplazo.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { calcularAging } from "../lib/calculos";
import { construirLecturaEjecutiva } from "../lib/commercial-ejecutivo";
import { leerSerieVentas } from "../lib/lecturas-ventas-reales";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(2)}%`;

async function main() {
  const dataset = await cargarDatasetReal();
  const fechaCorte = FECHA_CORTE_DATOS_REALES;
  const aging = calcularAging(dataset, fechaCorte);
  const ejecutiva = construirLecturaEjecutiva(dataset, fechaCorte);
  const serie = leerSerieVentas(dataset);

  const ventasConfirmadas = (dataset.ventas ?? []).filter((v: any) => v.estado_odoo === "sale");
  const ultimaCompraPorCliente = new Map<string, string>();
  for (const v of ventasConfirmadas) {
    const actual = ultimaCompraPorCliente.get(v.id_cliente);
    if (!actual || v.fecha_venta > actual) ultimaCompraPorCliente.set(v.id_cliente, v.fecha_venta);
  }
  const corteVentas = serie.corte ?? fechaCorte;
  const hace60 = new Date(new Date(corteVentas).getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const hace30 = new Date(new Date(corteVentas).getTime() - 30 * 86400000).toISOString().slice(0, 10);

  console.log("=".repeat(78));
  console.log("OPCIONES PARA: CO-Recomienda (hoy: complemento exacto de Explica)");
  console.log("=".repeat(78));

  // Opción 1: cruzar vencido con Venta reciente
  const clientesVencidos = new Set(
    aging.clasificadas.filter((f: any) => f.bucket !== "actual").map((f: any) => f.factura.id_cliente)
  );
  let vencidosQueCompraronReciente = 0;
  let saldoVencidoQueCompraronReciente = 0;
  const saldoPorClienteVencido = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    saldoPorClienteVencido.set(f.factura.id_cliente, (saldoPorClienteVencido.get(f.factura.id_cliente) ?? 0) + f.saldo);
  }
  for (const id of clientesVencidos) {
    const ultima = ultimaCompraPorCliente.get(id);
    if (ultima && ultima >= hace60) {
      vencidosQueCompraronReciente++;
      saldoVencidoQueCompraronReciente += saldoPorClienteVencido.get(id) ?? 0;
    }
  }
  console.log(`\nOpción 1 — "Vencido que sigue comprando" (cruce Factura x Venta):`);
  console.log(`  clientes vencidos totales: ${clientesVencidos.size}`);
  console.log(`  de esos, compraron en los últimos 60 días (>=${hace60}): ${vencidosQueCompraronReciente}`);
  console.log(`  saldo vencido de esos clientes: ${fmt(saldoVencidoQueCompraronReciente)} (${pct(saldoVencidoQueCompraronReciente / ejecutiva.totalVencido * 100)} del vencido total)`);

  // Opción 2: velocidad histórica de cobro (dias promedio factura->pago) para clientes vencidos
  const pagosAplicados = (dataset.pagos ?? []).filter((p: any) => p.estado_aplicacion === "aplicado" && p.id_factura);
  const facturaPorId = new Map(dataset.facturas.map((f: any) => [f.id_factura, f]));
  const diasParaPagar: number[] = [];
  for (const p of pagosAplicados) {
    const f = facturaPorId.get(p.id_factura!);
    if (!f || !f.fecha_vencimiento) continue;
    const dias = (new Date(p.fecha_pago).getTime() - new Date(f.fecha_vencimiento).getTime()) / 86400000;
    diasParaPagar.push(dias);
  }
  const promedioDiasPago = diasParaPagar.length > 0 ? diasParaPagar.reduce((a, b) => a + b, 0) / diasParaPagar.length : null;
  console.log(`\nOpción 2 — "Velocidad histórica de cobro" (Pago.fecha_pago - Factura.fecha_vencimiento):`);
  console.log(`  pagos aplicados con fecha de vencimiento conocida: ${diasParaPagar.length} de ${pagosAplicados.length} pagos aplicados`);
  console.log(`  promedio días entre vencimiento y pago real: ${promedioDiasPago !== null ? promedioDiasPago.toFixed(1) + " días" : "no calculable"}`);
  console.log(`  (negativo = paga antes de vencer, positivo = paga tarde)`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIONES PARA: CA-Explica / CA-Recomienda (hoy: refinamiento débil / gobernanza dormida)");
  console.log("=".repeat(78));

  const clientesEn90mas = new Set(aging.clasificadas.filter((f: any) => f.bucket === "90+").map((f: any) => f.factura.id_cliente)).size;
  console.log(`\nOpción 1 — "Clientes distintos en el bucket líder" (no monto, no facturas — cuentas):`);
  console.log(`  clientes distintos con al menos 1 factura en 90+: ${clientesEn90mas}`);
  console.log(`  facturas en 90+: 116 → promedio ${(116 / clientesEn90mas).toFixed(2)} facturas por cliente en ese bucket`);

  console.log(`\nOpción 2 — "Ticket promedio de factura vencida por bucket" (severidad individual, no total):`);
  for (const b of ["1-30", "31-60", "61-90", "90+"] as const) {
    const filas = aging.clasificadas.filter((f: any) => f.bucket === b);
    const promedio = filas.length > 0 ? filas.reduce((s: number, f: any) => s + f.saldo, 0) / filas.length : 0;
    console.log(`  ${b.padEnd(6)}: ${filas.length} facturas, ticket promedio = ${fmt(promedio)}`);
  }

  console.log("\n" + "=".repeat(78));
  console.log("OPCIONES PARA: CL-Explica (hoy: Top 2 por monto, refinamiento débil de Detecta)");
  console.log("=".repeat(78));

  const facturasPorClienteVencido = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    facturasPorClienteVencido.set(f.factura.id_cliente, (facturasPorClienteVencido.get(f.factura.id_cliente) ?? 0) + 1);
  }
  const nombrePorId = new Map(dataset.clientes.map((c: any) => [c.id_cliente, c.nombre_cliente]));
  const top5PorFacturas = [...facturasPorClienteVencido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`\nOpción 1 — "Top 5 por CANTIDAD de facturas vencidas" (en vez de por monto):`);
  top5PorFacturas.forEach(([id, n]) => console.log(`  ${(nombrePorId.get(id) ?? id).toString().padEnd(45)} ${n} facturas · saldo ${fmt(saldoPorClienteVencido.get(id) ?? 0)}`));

  console.log(`\nOpción 2 — "Top 5 por días de atraso máximo" (severidad, no tamaño):`);
  const diasMaxPorCliente = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    const actual = diasMaxPorCliente.get(f.factura.id_cliente) ?? 0;
    if (f.dias > actual) diasMaxPorCliente.set(f.factura.id_cliente, f.dias);
  }
  const top5PorDias = [...diasMaxPorCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  top5PorDias.forEach(([id, d]) => console.log(`  ${(nombrePorId.get(id) ?? id).toString().padEnd(45)} ${d} días · saldo ${fmt(saldoPorClienteVencido.get(id) ?? 0)}`));

  console.log("\n" + "=".repeat(78));
  console.log("OPCIONES PARA: VE-Prioriza / VE-Recomienda (hoy: pedidos count sin contexto / gobernanza dormida)");
  console.log("=".repeat(78));

  if (serie.ytd) {
    console.log(`\nOpción 1 — usar campos YA CALCULADOS y hoy invisibles, como KPI destacado:`);
    console.log(`  recurrentes (2+ pedidos en el período):        ${serie.ytd.actual.recurrentes} de ${serie.ytd.actual.clientes} compradores (${pct(serie.ytd.actual.recurrentes / serie.ytd.actual.clientes * 100)})`);
    console.log(`  porRecuperar (última compra hace 30+ días):    ${serie.ytd.actual.porRecuperar} de ${serie.ytd.actual.clientes} compradores (${pct(serie.ytd.actual.porRecuperar / serie.ytd.actual.clientes * 100)})`);
    console.log(`  conHistorial (ya compraba antes del período):  ${serie.ytd.actual.conHistorial} de ${serie.ytd.actual.clientes} compradores (${pct(serie.ytd.actual.conHistorial / serie.ytd.actual.clientes * 100)})`);
  }
  let compradoresHace90SinRepetir = 0;
  for (const [, ultima] of ultimaCompraPorCliente) {
    if (ultima < hace30 && ultima >= hace60) compradoresHace90SinRepetir++;
  }
  console.log(`\nOpción 2 — "Clientes en zona de alerta temprana" (compraron entre 30 y 60 días atrás, todavía no son churn):`);
  console.log(`  clientes: ${compradoresHace90SinRepetir}`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
