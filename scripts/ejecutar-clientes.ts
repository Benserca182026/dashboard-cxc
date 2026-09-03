// Ejecuta la query real (no una versión resumida) contra el dataset real de
// Odoo/Supabase para /ventas/clientes, y vuelca CADA valor intermedio de las
// 4 categorías (Recencia, Comparable, Concentración, Recuperación) — no solo
// el KPI final que se ve en pantalla. Mismo patrón que ejecutar-cuadro-mando.ts,
// ejecutar-aging.ts y ejecutar-prioritarios.ts.
// Se corre con: npx tsx scripts/ejecutar-clientes.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { leerClientesReales } from "../lib/lecturas-clientes-reales";

const q = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(4)}%`;

async function main() {
  const dataset = await cargarDatasetReal();

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente} · FECHA_CORTE_DATOS_REALES=${FECHA_CORTE_DATOS_REALES}`);
  console.log(`ventas totales en el dataset: ${(dataset.ventas ?? []).length}`);
  console.log(`clientes totales: ${dataset.clientes.length}`);
  const confirmadas = (dataset.ventas ?? []).filter((v) => v.estado_odoo === "sale");
  console.log(`ventas con estado_odoo = 'sale': ${confirmadas.length}`);
  console.log("=".repeat(78));

  const lectura = leerClientesReales(dataset);

  console.log("\n### leerClientesReales() — CORTE Y VENTANA ###\n");
  console.log(`desde (primer día con venta confirmada) = ${lectura.desde}`);
  console.log(`corte (DERIVADO: max(fecha_venta) de pedidos confirmados) = ${lectura.corte}`);
  console.log(`  <<< este es el "Corte:" que aparece en pantalla, NO FECHA_CORTE_DATOS_REALES (${FECHA_CORTE_DATOS_REALES}) >>>`);
  console.log(`pedidosConfirmados = ${lectura.pedidosConfirmados}`);
  console.log(`clientesHistoricos = ${lectura.clientesHistoricos}`);
  console.log(`totalHistorico = ${q(lectura.totalHistorico)}`);
  console.log(`medianaPedidosHistorico = ${lectura.medianaPedidosHistorico}`);
  console.log(`ticketMedianoHistorico = ${q(lectura.ticketMedianoHistorico)}`);

  // ── 1 · DETECTA · Recencia ──────────────────────────────────────────────
  console.log("\n### 1 · DETECTA · Recencia — tramos ###\n");
  for (const tramo of lectura.recencia) {
    console.log(`  ${tramo.clave.padEnd(6)} (${tramo.etiqueta.padEnd(14)}) -> ${tramo.filas.length.toString().padStart(4)} clientes · ${q(tramo.valor)} venta histórica acumulada`);
  }
  const mas90 = lectura.recencia.find((t) => t.clave === "90+");
  console.log(`\nmas90.filas.length = ${mas90?.filas.length}`);
  console.log(`clientesHistoricos = ${lectura.clientesHistoricos}`);
  console.log(`KPI Detecta (pct de la base sin compra en 90 días) = ${mas90?.filas.length}/${lectura.clientesHistoricos}*100 = ${pct((mas90!.filas.length / lectura.clientesHistoricos) * 100)}`);
  console.log(`unaSolaCompraHistorica.length (clientes de una sola compra en TODO el histórico) = ${lectura.unaSolaCompraHistorica.length}`);
  const conPatron = lectura.clientesHistoricos - lectura.unaSolaCompraHistorica.length;
  console.log(`conPatron (clientesHistoricos - unaSola) = ${conPatron}`);
  console.log(`cobertura Detecta = conPatron/clientesHistoricos*100 = ${pct((conPatron / lectura.clientesHistoricos) * 100)}`);
  console.log(`\n>>> cuántos de los "unaSolaCompraHistorica" también caen en el tramo 90+ (aclarado en la nota de la barra 90+):`);
  const unaSolaIds = new Set(lectura.unaSolaCompraHistorica.map((f) => f.id));
  const mas90UnaSola = (mas90?.filas ?? []).filter((f) => unaSolaIds.has(f.id)).length;
  console.log(`    ${mas90UnaSola} de ${mas90?.filas.length} clientes del tramo 90+ tienen una sola compra histórica (${pct((mas90UnaSola / (mas90?.filas.length ?? 1)) * 100)})`);

  // ── 2 · EXPLICA · Comparable ────────────────────────────────────────────
  console.log("\n### 2 · EXPLICA · Comparable — ytd vs comparable ###\n");
  if (lectura.ytd && lectura.comparable) {
    console.log(`ytd: ${lectura.ytd.etiqueta} [${lectura.ytd.inicio} → ${lectura.ytd.fin}], dias=${lectura.ytd.dias}`);
    console.log(`  compradores=${lectura.ytd.compradores} pedidos=${lectura.ytd.pedidos} valor=${q(lectura.ytd.valor)}`);
    console.log(`  recurrentes=${lectura.ytd.recurrentes} unaCompra=${lectura.ytd.unaCompra} primeraCompraRegistrada=${lectura.ytd.primeraCompraRegistrada}`);
    console.log(`  medianaPedidos=${lectura.ytd.medianaPedidos} ticketMediano=${q(lectura.ytd.ticketMediano)}`);
    console.log(`comparable: ${lectura.comparable.etiqueta} [${lectura.comparable.inicio} → ${lectura.comparable.fin}], dias=${lectura.comparable.dias}`);
    console.log(`  compradores=${lectura.comparable.compradores} pedidos=${lectura.comparable.pedidos} valor=${q(lectura.comparable.valor)}`);
    console.log(`\nvariacion.valor = (${lectura.ytd.valor}/${lectura.comparable.valor}-1)*100 = ${lectura.variacion.valor}`);
    console.log(`variacion.pedidos = ${lectura.variacion.pedidos}`);
    console.log(`variacion.compradores = ${lectura.variacion.compradores}`);
    console.log(`\nKPI Explica (compradores vs comparable) = ${lectura.variacion.compradores}`);
    console.log(`mediana pedidos histórico=${lectura.medianaPedidosHistorico} vs YTD=${lectura.ytd.medianaPedidos}`);
    console.log(`ticket mediano histórico=${q(lectura.ticketMedianoHistorico)} vs YTD=${q(lectura.ytd.ticketMediano)}`);
    const pctConHistorial = ((lectura.ytd.compradores - lectura.ytd.primeraCompraRegistrada) / lectura.ytd.compradores) * 100;
    console.log(`cobertura Explica (compradores YTD que ya tenían compra antes del período) = (${lectura.ytd.compradores}-${lectura.ytd.primeraCompraRegistrada})/${lectura.ytd.compradores}*100 = ${pct(pctConHistorial)}`);
  }

  // ── 3 · PRIORIZA · Concentración ────────────────────────────────────────
  console.log("\n### 3 · PRIORIZA · Concentración — cortes Top N ###\n");
  for (const corte of lectura.concentracion) {
    console.log(`  ${corte.etiqueta.padEnd(8)} n=${corte.n.toString().padStart(2)} -> ${q(corte.valor)} = ${pct(corte.pct)} de la venta YTD (${q(lectura.ytd?.valor ?? 0)})`);
  }
  console.log(`\nclientesParaMitadYtd = ${lectura.clientesParaMitadYtd}`);
  const top20 = lectura.concentracion.find((c) => c.clave === "top20");
  const top20Detenido = top20 ? top20.filas.filter((f) => f.dias !== null && f.dias > 90) : [];
  console.log(`top20Detenido (cuentas del Top 20 YTD con dias > 90) = ${top20Detenido.length}`);
  top20Detenido.forEach((f) => console.log(`    ${f.etiqueta} · ${q(f.valor)} · ${f.dias} días`));

  // ── 4 · RECOMIENDA · Recuperación ───────────────────────────────────────
  console.log("\n### 4 · RECOMIENDA · Recuperación ###\n");
  console.log(`detenidosAltoValor.length (Top 50 histórico con dias > 90) = ${lectura.detenidosAltoValor.length}`);
  lectura.detenidosAltoValor.slice(0, 10).forEach((f) => console.log(`    ${f.etiqueta} · ${q(f.valor)} · ${f.dias} días`));
  console.log(`\nytd.recurrentes = ${lectura.ytd?.recurrentes}`);
  console.log(`ytd.unaCompra = ${lectura.ytd?.unaCompra}`);
  console.log(`pedidosCero.length = ${lectura.pedidosCero.length}`);
  console.log(`  clientes distintos afectados = ${new Set(lectura.pedidosCero.map((p) => p.cliente)).size}`);
  console.log(`variantesDeNombre.length = ${lectura.variantesDeNombre.length}`);
  lectura.variantesDeNombre.forEach((v) => console.log(`    raíz "${v.raiz}" -> ${v.nombres.join(" | ")}`));

  // ── Cruces / posibles duplicados entre agentes (a varios decimales) ────
  console.log("\n### CRUCES — buscar complementos matemáticos y duplicados exactos ###\n");
  console.log(`Detecta KPI  (pct sin compra 90+)      = ${((mas90!.filas.length / lectura.clientesHistoricos) * 100).toFixed(8)}`);
  console.log(`Prioriza KPI (top5 pct)                = ${(lectura.concentracion.find((c) => c.clave === "top5")?.pct ?? 0).toFixed(8)}`);
  console.log(`Explica KPI  (variacion compradores)   = ${(lectura.variacion.compradores ?? 0).toFixed(8)}`);
  console.log(`Recomienda KPI (recurrentes, entero)   = ${lectura.ytd?.recurrentes}`);
  const pctRecurrentes = lectura.ytd ? (lectura.ytd.recurrentes / lectura.ytd.compradores) * 100 : 0;
  console.log(`Recomienda como % de compradores YTD   = ${pctRecurrentes.toFixed(8)}%`);
  console.log(`\n243 (mas90) de 363 (clientesHistoricos) -> ¿coincide con lo que se ve en pantalla?`);
  console.log(`  mas90.filas.length = ${mas90?.filas.length}, clientesHistoricos = ${lectura.clientesHistoricos}`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
