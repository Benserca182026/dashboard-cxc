// Opciones de reemplazo para las tarjetas debiles de /aging, con datos
// reales, no hipoteticos. Mismo patron que scripts/opciones-reemplazo.ts.
//   npx tsx scripts/opciones-aging.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { calcularAging } from "../lib/calculos";
import { analizarAgingComercial, analizarSeguimientoComercial } from "../lib/commercial-cobranza";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(4)}%`;

async function main() {
  const dataset = await cargarDatasetReal();
  const fechaCorte = FECHA_CORTE_DATOS_REALES;
  const aging = calcularAging(dataset, fechaCorte);
  const comercial = analizarAgingComercial(dataset, fechaCorte, [], aging);
  const seguimiento = analizarSeguimientoComercial(dataset, fechaCorte, []);

  console.log("=".repeat(78));
  console.log("VERIFICACION: ¿siguen los pagos con id_factura null al 100%? (no asumir, volver a medir)");
  console.log("=".repeat(78));
  const pagosConFactura = dataset.pagos.filter((p: any) => p.id_factura != null);
  console.log(`pagos totales: ${dataset.pagos.length} · con id_factura poblado: ${pagosConFactura.length} (${pct(pagosConFactura.length/dataset.pagos.length*100)})`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCION PARA EX-Explica (hoy: 'motivosPresentes.length' = 1, conteo trivial sin valor)");
  console.log("=".repeat(78));
  const pagadas = aging.excluidas.filter((e: any) => e.motivo === "pagada");
  const ticketPromedioPagada = pagadas.length > 0 ? pagadas.reduce((s: number, e: any) => s + e.factura.monto_original, 0) / pagadas.length : 0;
  const ticketPromedioAbierta = aging.clasificadas.length > 0 ? aging.clasificadas.reduce((s: number, f: any) => s + f.factura.monto_original, 0) / aging.clasificadas.length : 0;
  console.log(`ticket promedio (monto_original) de facturas PAGADAS: ${fmt(ticketPromedioPagada)} (n=${pagadas.length})`);
  console.log(`ticket promedio (monto_original) de facturas ABIERTAS (clasificadas): ${fmt(ticketPromedioAbierta)} (n=${aging.clasificadas.length})`);
  console.log(`diferencia: ${fmt(ticketPromedioPagada - ticketPromedioAbierta)} (${pct((ticketPromedioPagada-ticketPromedioAbierta)/ticketPromedioAbierta*100)} mas grande la pagada)`);
  console.log(`¿esto revela algo? si las facturas grandes se pagan mas rapido/mejor que las chicas, o al reves.`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCION PARA CN-Recomienda (hoy: Top10=53.0083%, contexto a agregar igual que CL-Recomienda)");
  console.log("=".repeat(78));
  const porCliente = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    porCliente.set(f.factura.id_cliente, (porCliente.get(f.factura.id_cliente) ?? 0) + f.saldo);
  }
  const ordenados = [...porCliente.entries()].sort((a, b) => b[1] - a[1]);
  const top20 = ordenados.slice(0, 20).reduce((s, [, v]) => s + v, 0);
  console.log(`Top 20 = ${fmt(top20)} = ${pct(top20/comercial.vencido*100)} del vencido (vs Top10=${pct(comercial.porcentajeTopDiez)})`);
  const clientesConVencidoTotal = ordenados.length;
  console.log(`10 de ${clientesConVencidoTotal} clientes con vencido (${pct(10/clientesConVencidoTotal*100)}) explican el ${pct(comercial.porcentajeTopDiez)} del vencido -- contexto de universo`);

  console.log("\n" + "=".repeat(78));
  console.log("VERIFICACION GE: saldo vencido real de los clientes 'sin gestion' via cruce contra aging.clasificadas");
  console.log("=".repeat(78));
  const idsSinGestion = new Set(seguimiento.sinGestion.map((f) => f.idCliente));
  let saldoVencidoRealSinGestion = 0;
  let facturasVencidasSinGestion = 0;
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    if (idsSinGestion.has(f.factura.id_cliente)) { saldoVencidoRealSinGestion += f.saldo; facturasVencidasSinGestion++; }
  }
  console.log(`clientes sin gestion: ${idsSinGestion.size}`);
  console.log(`saldo VENCIDO real (solo facturas bucket!=actual) de esos clientes = ${fmt(saldoVencidoRealSinGestion)}`);
  console.log(`facturas vencidas de esos clientes = ${facturasVencidasSinGestion}`);
  console.log(`comercial.vencido (total, TODOS los clientes con vencido) = ${fmt(comercial.vencido)}`);
  console.log(`¿coinciden? ${saldoVencidoRealSinGestion === comercial.vencido ? "SI, exacto" : "NO"} -- esperable si contactadoTotal=0 (todos los vencidos estan 'sin gestion')`);
  console.log(`seguimiento.saldoSinGestion (KPI actual, = saldoTotal TODO abierto de esos clientes) = ${fmt(seguimiento.saldoSinGestion)}`);
  console.log(`sobreestimacion = ${fmt(seguimiento.saldoSinGestion - saldoVencidoRealSinGestion)} (${pct((seguimiento.saldoSinGestion-saldoVencidoRealSinGestion)/seguimiento.saldoSinGestion*100)} del numero mostrado hoy es saldo AL DIA, no vencido)`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
