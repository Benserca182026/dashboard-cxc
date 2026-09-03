// Ejecuta la query real (no una versión resumida) contra el dataset real de
// Odoo/Supabase, y vuelca CADA valor intermedio de /prioritarios — no solo el
// KPI final que se ve en pantalla. Mismo patrón que scripts/ejecutar-cuadro-mando.ts.
// Se corre con: npx tsx scripts/ejecutar-prioritarios.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { analizarPrioritariosComercial } from "../lib/commercial-cobranza";
import { prioridadSimulada } from "../lib/simulados";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(4)}%`;

function bucketDias(dias: number): string {
  if (dias <= 0) return "Al día o sin fecha (0)";
  if (dias <= 30) return "1 a 30 días";
  if (dias <= 60) return "31 a 60 días";
  if (dias <= 90) return "61 a 90 días";
  return "Más de 90 días";
}

async function main() {
  const dataset = await cargarDatasetReal();
  const fechaCorte = FECHA_CORTE_DATOS_REALES;
  const gestiones: any[] = []; // real: fuera del navegador no hay localStorage -- mismo caso que B18-7 documenta.

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente} · corte=${fechaCorte}`);
  console.log(`clientes totales: ${dataset.clientes.length}`);
  console.log(`facturas totales: ${dataset.facturas.length}`);
  console.log(`pagos totales: ${dataset.pagos.length}`);
  console.log("=".repeat(78));

  // ── prioridadSimulada() cruda ────────────────────────────────────────────
  const crudas = prioridadSimulada(dataset, fechaCorte);
  console.log(`\n### prioridadSimulada() — CADA PASO ###\n`);
  console.log(`filas.length (clientes con saldoTotal>0) = ${crudas.length} de ${dataset.clientes.length} clientes totales`);
  console.log(`primeras 5 filas (ya ordenadas por score desc, desempate saldo/dias/id):`);
  crudas.slice(0, 5).forEach((f, i) => {
    console.log(`  [${i}] ${f.nombreCliente.padEnd(45)} score=${f.scoreSimulado} saldo=${fmt(f.saldoTotal)} dias=${f.diasMaxAtraso} disputa=${f.enDisputa}`);
  });

  // ── analizarPrioritariosComercial() — lo que consume el molde ───────────
  const comercial = analizarPrioritariosComercial(dataset, fechaCorte, gestiones);
  const filas = comercial.filas;
  const saldoTotal = comercial.saldoTotal;
  console.log(`\n### analizarPrioritariosComercial() ###\n`);
  console.log(`filas.length = ${filas.length}`);
  console.log(`saldoTotal = ${fmt(saldoTotal)}`);
  console.log(`saldoTopDiez = ${fmt(comercial.saldoTopDiez)}`);
  console.log(`medianaSaldo = ${fmt(comercial.medianaSaldo)}`);
  console.log(`medianaDias = ${comercial.medianaDias.toFixed(2)} días`);

  // ── SC · SCORE ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("SC · SCORE");
  console.log("=".repeat(78));
  const topDiez = comercial.topDiez;
  const lider = topDiez[0] ?? null;
  console.log(`topDiez.length = ${topDiez.length}`);
  console.log(`lider = ${lider ? `${lider.cliente} score=${lider.score} saldo=${fmt(lider.saldo)} dias=${lider.dias}` : "ninguno"}`);
  const sumaScoreTopDiez = topDiez.reduce((s, f) => s + f.score, 0);
  console.log(`sumaScoreTopDiez (base del reparto de filasScore) = ${sumaScoreTopDiez}`);
  topDiez.forEach((f, i) => {
    console.log(`  [${i}] ${f.cliente.padEnd(45)} score=${String(f.score).padStart(3)} pct=${(sumaScoreTopDiez > 0 ? (f.score / sumaScoreTopDiez * 100) : 0).toFixed(4)}% saldo=${fmt(f.saldo)}`);
  });
  const coberturaScore = saldoTotal > 0 ? (comercial.saldoTopDiez / saldoTotal) * 100 : 0;
  console.log(`coberturaScore = saldoTopDiez/saldoTotal*100 = ${comercial.saldoTopDiez}/${saldoTotal}*100 = ${pct(coberturaScore)}`);
  const saldoFueraTopDiez = saldoTotal - comercial.saldoTopDiez;
  const cuentasFueraTopDiez = filas.length - topDiez.length;
  console.log(`saldo FUERA del Top10 = saldoTotal - saldoTopDiez = ${fmt(saldoFueraTopDiez)} (${pct(saldoTotal > 0 ? saldoFueraTopDiez / saldoTotal * 100 : 0)}), en ${cuentasFueraTopDiez} cuentas`);

  // ── GE · GESTIÓN ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("GE · GESTIÓN");
  console.log("=".repeat(78));
  const conGestion = filas.filter((f) => f.responsable !== "Sin responsable registrado");
  const sinGestion = filas.filter((f) => f.responsable === "Sin responsable registrado");
  const saldoCon = conGestion.reduce((s, f) => s + f.saldo, 0);
  const saldoSin = sinGestion.reduce((s, f) => s + f.saldo, 0);
  console.log(`conGestion.length = ${conGestion.length} · saldoCon = ${fmt(saldoCon)}`);
  console.log(`sinGestion.length = ${sinGestion.length} · saldoSin = ${fmt(saldoSin)}`);
  const coberturaGestion = saldoTotal > 0 ? (saldoCon / saldoTotal) * 100 : 0;
  console.log(`coberturaGestion = saldoCon/saldoTotal*100 = ${pct(coberturaGestion)}`);
  const liderSinGestion = sinGestion[0] ?? null;
  console.log(`liderSinGestion = ${liderSinGestion ? `${liderSinGestion.cliente} score=${liderSinGestion.score}` : "ninguno"}`);
  // Cruce nuevo: cuántas del Top10 por SCORE no tienen gestión (worklist de mayor prioridad, sin dueño)
  const topDiezSinGestion = topDiez.filter((f) => f.responsable === "Sin responsable registrado");
  console.log(`\nCRUCE Score x Gestión: del Top10 por score, ¿cuántos NO tienen gestión?`);
  console.log(`  topDiezSinGestion.length = ${topDiezSinGestion.length} de ${topDiez.length}`);
  topDiezSinGestion.forEach((f) => console.log(`    ${f.cliente} score=${f.score} saldo=${fmt(f.saldo)}`));
  const saldoTopDiezSinGestion = topDiezSinGestion.reduce((s, f) => s + f.saldo, 0);
  console.log(`  saldo de esas cuentas = ${fmt(saldoTopDiezSinGestion)}`);

  // ── CN · CONCENTRACIÓN ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("CN · CONCENTRACIÓN");
  console.log("=".repeat(78));
  const porSaldo = [...filas].sort((a, b) => b.saldo - a.saldo || a.idCliente.localeCompare(b.idCliente));
  const top5 = porSaldo.slice(0, 5);
  const saldoTop5 = top5.reduce((s, f) => s + f.saldo, 0);
  console.log(`Top5 por saldo:`);
  top5.forEach((f, i) => console.log(`  [${i}] ${f.cliente.padEnd(45)} saldo=${fmt(f.saldo)} score=${f.score}`));
  console.log(`saldoTop5 = ${fmt(saldoTop5)}`);
  const coberturaConcentracion = saldoTotal > 0 ? (saldoTop5 / saldoTotal) * 100 : 0;
  console.log(`coberturaConcentracion (Top5) = saldoTop5/saldoTotal*100 = ${pct(coberturaConcentracion)}`);
  function cuentasParaObjetivo(ordenadas: { saldo: number }[], total: number, objetivo = 80): number {
    if (total <= 0) return 0;
    let acumulado = 0;
    for (let i = 0; i < ordenadas.length; i++) {
      acumulado += ordenadas[i].saldo;
      if ((acumulado / total) * 100 >= objetivo) return i + 1;
    }
    return ordenadas.length;
  }
  const cuentasPara80 = cuentasParaObjetivo(porSaldo, saldoTotal, 80);
  console.log(`cuentasPara80 = ${cuentasPara80} de ${filas.length}`);
  // Alternativa: Top10 por saldo, mismo patrón "Top5 vs Top10" ya probado útil en Cuadro de mando
  const top10PorSaldo = porSaldo.slice(0, 10);
  const saldoTop10 = top10PorSaldo.reduce((s, f) => s + f.saldo, 0);
  const coberturaTop10 = saldoTotal > 0 ? (saldoTop10 / saldoTotal) * 100 : 0;
  console.log(`\nOpción Top10 por saldo: ${fmt(saldoTop10)} = ${pct(coberturaTop10)} del saldo priorizado (vs. ${pct(coberturaConcentracion)} del Top5)`);
  // Cruce nuevo: overlap entre Top5 por saldo y Top10 por score
  const idsTopDiezScore = new Set(topDiez.map((f) => f.idCliente));
  const overlapTop5SaldoEnTopScore = top5.filter((f) => idsTopDiezScore.has(f.idCliente));
  console.log(`\nCRUCE Concentración x Score: de los Top5 por SALDO, ¿cuántos están también en el Top10 por SCORE?`);
  console.log(`  overlap = ${overlapTop5SaldoEnTopScore.length} de 5`);
  top5.forEach((f) => console.log(`    ${f.cliente.padEnd(45)} saldo=${fmt(f.saldo)} ¿en Top10 score? ${idsTopDiezScore.has(f.idCliente) ? "SI" : "NO"}`));

  // ── AT · ANTIGÜEDAD ───────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("AT · ANTIGÜEDAD");
  console.log("=".repeat(78));
  const buckets = new Map<string, number>();
  const bucketsCount = new Map<string, number>();
  for (const f of filas) {
    const clave = bucketDias(f.dias);
    buckets.set(clave, (buckets.get(clave) ?? 0) + f.saldo);
    bucketsCount.set(clave, (bucketsCount.get(clave) ?? 0) + 1);
  }
  console.log(`Reparto por bucket (saldo, cuentas):`);
  for (const [clave, valor] of buckets.entries()) {
    console.log(`  ${clave.padEnd(24)} saldo=${fmt(valor)} cuentas=${bucketsCount.get(clave)}`);
  }
  const moraCritica = filas.filter((f) => f.dias > 90);
  const saldoCritico = moraCritica.reduce((s, f) => s + f.saldo, 0);
  console.log(`\nmoraCritica.length (dias>90) = ${moraCritica.length}`);
  console.log(`saldoCritico = ${fmt(saldoCritico)}`);
  const coberturaAntiguedad = saldoTotal > 0 ? (saldoCritico / saldoTotal) * 100 : 0;
  console.log(`coberturaAntiguedad = saldoCritico/saldoTotal*100 = ${pct(coberturaAntiguedad)}`);
  // Comparar contra Cuadro de mando (referencia B18-4, ya documentado, no recalcular aquí --
  // solo confirmar que el patrón "por cliente, contagio del máximo" se mantiene)
  console.log(`\n(referencia B18-4 ya documentada: esta cifra clasifica por CLIENTE -- el máximo de días de` );
  console.log(`atraso entre sus facturas arrastra TODO su saldo, no solo el de la factura vieja)`);

  // ── Resumen del dashboard integral (kpis) ─────────────────────────────────
  console.log("\n" + "=".repeat(78));
  console.log("RESUMEN — kpis del dashboard B18 integral");
  console.log("=".repeat(78));
  console.log(`Cuentas priorizadas: ${filas.length} · nota: ${pct(coberturaScore)} del saldo en el Top 10`);
  console.log(`Saldo priorizado total: ${fmt(saldoTotal)} · nota: ${pct(coberturaConcentracion)} en el Top 5 por saldo`);
  console.log(`Score líder: ${lider ? `${lider.score} pts` : "—"} · nota: ${lider?.cliente ?? "sin cuentas"}`);
  console.log(`Mora crítica 90+: ${fmt(saldoCritico)} · nota: ${pct(coberturaAntiguedad)} del saldo priorizado`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
