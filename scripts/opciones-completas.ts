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

  console.log("=".repeat(78));
  console.log("CA-Detecta: bucket lider por MONTO vs por CANTIDAD DE FACTURAS vs por CLIENTES DISTINTOS");
  console.log("=".repeat(78));
  for (const b of ["actual", "1-30", "31-60", "61-90", "90+"] as const) {
    const filas = aging.clasificadas.filter((f: any) => f.bucket === b);
    const monto = filas.reduce((s: number, f: any) => s + f.saldo, 0);
    const clientesDistintos = new Set(filas.map((f: any) => f.factura.id_cliente)).size;
    console.log(`  ${b.padEnd(6)}: monto=${fmt(monto)} · facturas=${filas.length} · clientes distintos=${clientesDistintos}`);
  }

  console.log("\n" + "=".repeat(78));
  console.log("CA-Prioriza: 166 facturas vencidas -- como RATIO, no como conteo suelto");
  console.log("=".repeat(78));
  console.log(`  166 / 224 clasificadas = ${pct(166/224*100)} de la cartera clasificada está vencida (en FACTURAS, no en Q)`);
  console.log(`  (recordar: pctVencido en Q ya es 62.03% -- ¿el ratio de facturas coincide con el ratio de Q?)`);

  console.log("\n" + "=".repeat(78));
  console.log("CO-Explica: 62.55% en Q -- version en CANTIDAD DE CLIENTES");
  console.log("=".repeat(78));
  const clientesVencidos = new Set(aging.clasificadas.filter((f: any) => f.bucket !== "actual").map((f: any) => f.factura.id_cliente));
  const clientesEnMoraCritica = new Set(aging.clasificadas.filter((f: any) => f.bucket === "90+").map((f: any) => f.factura.id_cliente));
  console.log(`  clientes vencidos totales: ${clientesVencidos.size}`);
  console.log(`  de esos, con AL MENOS una factura en 90+: ${clientesEnMoraCritica.size} (${pct(clientesEnMoraCritica.size/clientesVencidos.size*100)})`);
  console.log(`  (vs. 62.55% que es la version en Q -- ¿coincide el % de personas con el % de dinero?)`);

  console.log("\n" + "=".repeat(78));
  console.log("CO-Prioriza: Q117,001.64 en el tramo 90-180 -- version en CLIENTES");
  console.log("=".repeat(78));
  const clientesEn90a180 = new Set(
    aging.clasificadas.filter((f: any) => f.bucket === "90+" && f.dias <= 180).map((f: any) => f.factura.id_cliente)
  );
  console.log(`  clientes con factura(s) en la ventana 90-180 días: ${clientesEn90a180.size}`);

  console.log("\n" + "=".repeat(78));
  console.log("CL-Prioriza: 91 clientes con vencido -- como % de la base total de clientes");
  console.log("=".repeat(78));
  console.log(`  91 / ${dataset.clientes.length} clientes totales = ${pct(91/dataset.clientes.length*100)} de la base tiene algo vencido`);

  console.log("\n" + "=".repeat(78));
  console.log("CL-Recomienda: Top5=38.93% -- version Top10");
  console.log("=".repeat(78));
  const porCliente = new Map<string, number>();
  for (const f of aging.clasificadas) {
    if (f.bucket === "actual") continue;
    porCliente.set(f.factura.id_cliente, (porCliente.get(f.factura.id_cliente) ?? 0) + f.saldo);
  }
  const top10 = [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sumaTop10 = top10.reduce((s, [, v]) => s + v, 0);
  console.log(`  Top10 suma = ${fmt(sumaTop10)} = ${pct(sumaTop10/ejecutiva.totalVencido*100)} del vencido (vs. ${pct(38.93)} del Top5)`);

  console.log("\n" + "=".repeat(78));
  console.log("VE-Detecta/Explica: variacion YTD -- descomposicion meses cerrados vs mes parcial");
  console.log("=".repeat(78));
  if (serie.ytd) {
    console.log(`  actual.pedidosMesesCerrados=${serie.ytd.actual.pedidosMesesCerrados} de actual.pedidos=${serie.ytd.actual.pedidos} (${pct(serie.ytd.actual.pedidosMesesCerrados/serie.ytd.actual.pedidos*100)} en meses YA cerrados)`);
    console.log(`  valorMesesCerrados=${fmt(serie.ytd.actual.valorMesesCerrados)} de valor total=${fmt(serie.ytd.actual.valor)} (${pct(serie.ytd.actual.valorMesesCerrados/serie.ytd.actual.valor*100)})`);
    console.log(`  variacion SOLO meses cerrados = (${serie.ytd.actual.valorMesesCerrados} - ${serie.ytd.previo.valorMesesCerrados})/${serie.ytd.previo.valorMesesCerrados}*100 = ${((serie.ytd.actual.valorMesesCerrados-serie.ytd.previo.valorMesesCerrados)/serie.ytd.previo.valorMesesCerrados*100).toFixed(2)}%`);
  }
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
