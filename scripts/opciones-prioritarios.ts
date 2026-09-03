// Candidatos de reemplazo para los KPIs débiles de /prioritarios, con números
// reales, no hipotéticos. Mismo patrón que scripts/opciones-reemplazo.ts y
// scripts/opciones-completas.ts (Cuadro de mando). npx tsx scripts/opciones-prioritarios.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { analizarPrioritariosComercial } from "../lib/commercial-cobranza";

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
  const comercial = analizarPrioritariosComercial(dataset, fechaCorte, []);
  const filas = comercial.filas;
  const saldoTotal = comercial.saldoTotal;
  const topDiez = comercial.topDiez;
  const idsTopDiez = new Set(topDiez.map((f) => f.idCliente));

  console.log("=".repeat(78));
  console.log("VERIFICACIÓN ALGEBRAICA: AT-Detecta (bucket líder) vs AT-Recomienda (coberturaAntiguedad)");
  console.log("=".repeat(78));
  const buckets = new Map<string, number>();
  for (const f of filas) buckets.set(bucketDias(f.dias), (buckets.get(bucketDias(f.dias)) ?? 0) + f.saldo);
  const bucketLiderValor = buckets.get("Más de 90 días") ?? 0;
  const pctBucketLider = (bucketLiderValor / saldoTotal) * 100;
  const moraCritica = filas.filter((f) => f.dias > 90);
  const saldoCritico = moraCritica.reduce((s, f) => s + f.saldo, 0);
  const coberturaAntiguedad = (saldoCritico / saldoTotal) * 100;
  console.log(`bucket "Más de 90 días" saldo = ${fmt(bucketLiderValor)} -> pct sobre saldoTotal = ${pctBucketLider.toFixed(8)}%`);
  console.log(`moraCritica (dias>90) saldo   = ${fmt(saldoCritico)} -> coberturaAntiguedad = ${coberturaAntiguedad.toFixed(8)}%`);
  console.log(`¿Son el mismo número, a 8 decimales? ${pctBucketLider.toFixed(8) === coberturaAntiguedad.toFixed(8) ? "SI — duplicado exacto" : "NO"}`);
  console.log(`moraCritica.length = ${moraCritica.length} cuentas, bucket "Más de 90 días" cuentas = ${filas.filter((f) => bucketDias(f.dias) === "Más de 90 días").length} (deben coincidir: mismo filtro dias>90)`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN AT-Recomienda — cruce Mora crítica (90+) x Top10 por Score");
  console.log("=".repeat(78));
  const moraCriticaEnTop10 = moraCritica.filter((f) => idsTopDiez.has(f.idCliente));
  const saldoMoraCriticaEnTop10 = moraCriticaEnTop10.reduce((s, f) => s + f.saldo, 0);
  console.log(`de las ${moraCritica.length} cuentas en mora crítica, ¿cuántas están en el Top10 por score?: ${moraCriticaEnTop10.length}`);
  console.log(`saldo de esas cuentas: ${fmt(saldoMoraCriticaEnTop10)} (${pct(saldoMoraCriticaEnTop10 / saldoCritico * 100)} de la mora crítica total)`);
  moraCriticaEnTop10.forEach((f) => console.log(`  ${f.cliente.padEnd(45)} saldo=${fmt(f.saldo)} score=${f.score} dias=${f.dias}`));
  console.log(`--> es decir, ${moraCritica.length - moraCriticaEnTop10.length} de ${moraCritica.length} cuentas en mora crítica NO están priorizadas en el Top10 por score`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN AT-Prioriza — ratio en vez de conteo suelto (mismo patrón que CA/CL-Prioriza)");
  console.log("=".repeat(78));
  console.log(`${moraCritica.length} / ${filas.length} = ${pct(moraCritica.length / filas.length * 100)} de las cuentas priorizadas está en mora crítica (90+)`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN GE-Prioriza / GE-Recomienda — ejes independientes de localStorage (gestiones=0 hoy)");
  console.log("=".repeat(78));
  const sinGestion = filas.filter((f) => f.responsable === "Sin responsable registrado");
  const topDiezSinGestion = topDiez.filter((f) => f.responsable === "Sin responsable registrado");
  console.log(`\nEje 1 (cruce Score x Gestión): Top10 por score sin gestión = ${topDiezSinGestion.length} de ${topDiez.length}`);
  console.log(`  (nota: coberturaGestion total = 0% hoy — CUALQUIER subconjunto de "sin gestión" también da 100% sin gestión, ver aclaración abajo)`);

  console.log(`\nEje 2 (independiente de localStorage): distribución de accionSugerida (regla determinista sobre dias/disputa, lib/simulados.ts:96-104)`);
  const porAccion = new Map<string, { cuentas: number; saldo: number }>();
  for (const f of filas) {
    const accion = f.proximaAccion;
    const prev = porAccion.get(accion) ?? { cuentas: 0, saldo: 0 };
    prev.cuentas += 1;
    prev.saldo += f.saldo;
    porAccion.set(accion, prev);
  }
  for (const [accion, datos] of [...porAccion.entries()].sort((a, b) => b[1].cuentas - a[1].cuentas)) {
    console.log(`  "${accion}": ${datos.cuentas} cuentas (${pct(datos.cuentas / filas.length * 100)}) · saldo ${fmt(datos.saldo)}`);
  }
  const accionLider = [...porAccion.entries()].sort((a, b) => b[1].cuentas - a[1].cuentas)[0];
  console.log(`  acción más común: "${accionLider[0]}" con ${accionLider[1].cuentas} cuentas`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN SC-Prioriza — saldo/cuentas FUERA del Top10 (hoy: duplica 'saldo del Top10' de metricas)");
  console.log("=".repeat(78));
  const saldoFueraTopDiez = saldoTotal - comercial.saldoTopDiez;
  const cuentasFueraTopDiez = filas.length - topDiez.length;
  console.log(`saldo fuera del Top10 = ${fmt(saldoFueraTopDiez)} (${pct(saldoFueraTopDiez / saldoTotal * 100)}) en ${cuentasFueraTopDiez} cuentas`);
  console.log(`(complemento algebraico exacto de coberturaScore: 100 - 39.0002 = ${(100 - (comercial.saldoTopDiez / saldoTotal * 100)).toFixed(4)} -- ¿es válido mostrarlo como cuentas en vez de %?)`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN SC-Recomienda (resumen, KPI se mantiene) — Top10 por SCORE vs Top10 por SALDO puro");
  console.log("=".repeat(78));
  const porSaldo = [...filas].sort((a, b) => b.saldo - a.saldo || a.idCliente.localeCompare(b.idCliente));
  const top10PorSaldo = porSaldo.slice(0, 10);
  const saldoTop10PorSaldo = top10PorSaldo.reduce((s, f) => s + f.saldo, 0);
  console.log(`Top10 por SCORE cubre ${pct(comercial.saldoTopDiez / saldoTotal * 100)} del saldo priorizado`);
  console.log(`Top10 por SALDO PURO cubriría ${pct(saldoTop10PorSaldo / saldoTotal * 100)} -- el score, al pesar también días de atraso, deja fuera saldo grande que un ranking puro por dinero sí tomaría`);

  console.log("\n" + "=".repeat(78));
  console.log("OPCIÓN CN-Prioriza — overlap Top5 por saldo x Top10 por score (hoy: duplica 'cuentas para 80%' de metricas)");
  console.log("=".repeat(78));
  const top5PorSaldo = porSaldo.slice(0, 5);
  const overlap = top5PorSaldo.filter((f) => idsTopDiez.has(f.idCliente));
  console.log(`de los Top5 por saldo, ${overlap.length} de 5 están también en el Top10 por score:`);
  top5PorSaldo.forEach((f) => console.log(`  ${f.cliente.padEnd(45)} saldo=${fmt(f.saldo)} score=${f.score} ¿Top10 score? ${idsTopDiez.has(f.idCliente) ? "SI" : "NO"}`));
  const fueraDelScore = top5PorSaldo.filter((f) => !idsTopDiez.has(f.idCliente));
  console.log(`fuera del Top10 por score: ${fueraDelScore.map((f) => `${f.cliente} (score ${f.score})`).join(", ") || "ninguno"}`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
