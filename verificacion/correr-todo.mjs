#!/usr/bin/env node
// Corredor de pruebas del proyecto.
//
// POR QUE EXISTE
// El script `test` de package.json encadenaba los siete pasos con `&&`. Como
// `scripts/test-cifras-control.ts` falla A PROPOSITO mientras el mapeo contra
// Odoo siga en rojo, y como cualquier paso que reviente corta la cadena, el
// resultado era que los pasos siguientes NUNCA SE EJECUTABAN. Peor:
// `verificacion/linea-base.mjs` imprimia "0 pasan · 15 fallan" y salia con
// CODIGO 0, asi que ni siquiera cortaba la cadena — fallaba en silencio y el
// `&&` la daba por buena.
//
// QUE HACE ESTE ARCHIVO
//   1. Ejecuta TODOS los pasos, siempre, pase lo que pase con los anteriores.
//   2. Agrega al final un resumen con el estado de cada paso.
//   3. Sale con codigo != 0 si CUALQUIER paso fallo.
//
// LO QUE NO HACE, DELIBERADAMENTE
//   - No silencia ningun fallo. Un paso en rojo se reporta en rojo.
//   - No agrega ninguna dependencia ni framework: solo node:child_process.
//   - No inventa conteos. Si no puede leer el conteo de una salida, dice
//     "no declarado" en vez de poner 0 (un 0 inventado se ve igual que un
//     0 verdadero, que es exactamente el defecto que este proyecto persigue).

import { spawnSync } from "node:child_process";

const PASOS = [
  { id: "calculos",  nombre: "Calculos (Pasos 5 y 6)",        cmd: "npx tsx scripts/test-calculos.ts" },
  { id: "kpis",      nombre: "KPIs (Paso 7)",                 cmd: "npx tsx scripts/test-kpis.ts" },
  { id: "cadena",    nombre: "Cadena de factura (Paso 11)",   cmd: "npx tsx scripts/test-cadena.ts" },
  { id: "argumento", nombre: "Argumento derivado",            cmd: "npx tsx scripts/test-argumento.ts" },
  { id: "agentes",   nombre: "Agentes (contrato 3 estados)",  cmd: "npx tsx scripts/test-agentes.ts" },
  { id: "linea-base",nombre: "Linea base (15 comprobaciones)",cmd: "node verificacion/linea-base.mjs" },
  { id: "cifras",    nombre: "Cifras de control contra Odoo", cmd: "npx tsx scripts/test-cifras-control.ts" },
];

// Patrones de conteo. Cada paso imprime su resumen a su manera; esto los lee
// SIN modificar los scripts. Si un patron no casa, el conteo queda en null y
// se reporta como "no declarado".
function contarDeSalida(id, salida) {
  // linea-base.mjs: "RESULTADO: 0 pasan · 15 fallan · de 15 pruebas corridas"
  const lb = salida.match(/RESULTADO:\s*(\d+)\s*pasan\s*[·.]\s*(\d+)\s*fallan/);
  if (lb) return { pasan: Number(lb[1]), fallan: Number(lb[2]) };

  // test-cifras-control.ts: bloque "=== Resumen ===" con OK / PENDIENTE / FALLO
  const ok = salida.match(/^\s*OK:\s+(\d+)/m);
  const fa = salida.match(/^\s*FALLO:\s+(\d+)/m);
  const pe = salida.match(/^\s*PENDIENTE:\s+(\d+)/m);
  if (ok && fa) {
    return { pasan: Number(ok[1]), fallan: Number(fa[1]), pendientes: pe ? Number(pe[1]) : null };
  }

  // los cinco con assert: "N pruebas ... pasaron."
  const pr = salida.match(/(\d+)\s+pruebas[^\n]*pasaron/);
  if (pr) return { pasan: Number(pr[1]), fallan: 0 };

  return null;
}

// Un SKIP ruidoso de test-cifras-control sale con codigo 0 a proposito (no
// pudo preguntarle a Supabase). No es un fallo, pero TAMPOCO es un visto
// bueno, y el resumen tiene que decirlo con todas las letras.
function esSkipRuidoso(salida) {
  return /SKIP\s+—\s+NO SE VERIFICO NINGUNA CIFRA DE CONTROL/.test(salida);
}

console.log("=".repeat(78));
console.log("CORREDOR DE PRUEBAS — corre TODO, no corta en el primer fallo");
console.log("=".repeat(78));

const resultados = [];

for (const paso of PASOS) {
  console.log(`\n${"─".repeat(78)}`);
  console.log(`▶ ${paso.nombre}   [${paso.cmd}]`);
  console.log("─".repeat(78));

  const r = spawnSync(paso.cmd, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  const salida = (r.stdout ?? "") + (r.stderr ?? "");
  process.stdout.write(salida);

  // r.status === null significa que el proceso murio por senal o no arranco.
  const codigo = r.status === null ? (r.error ? -1 : -2) : r.status;
  if (r.error) console.log(`\n[corredor] no se pudo ejecutar: ${r.error.message}`);

  resultados.push({
    ...paso,
    codigo,
    conteo: contarDeSalida(paso.id, salida),
    skip: esSkipRuidoso(salida),
  });
}

// ── Resumen agregado ────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(78)}`);
console.log("RESUMEN");
console.log("=".repeat(78));

let pasosFallados = 0;
let totalFallan = 0;
let totalPasan = 0;
let hayConteoDesconocido = false;
let totalPendientes = 0;

const fila = (a, b, c) => `${String(a).padEnd(34)} ${String(b).padEnd(10)} ${c}`;
console.log(fila("PASO", "SALIDA", "COMPROBACIONES"));
console.log("-".repeat(78));

for (const r of resultados) {
  const fallo = r.codigo !== 0;
  if (fallo) pasosFallados++;

  let detalle;
  if (r.conteo) {
    totalPasan += r.conteo.pasan ?? 0;
    totalFallan += r.conteo.fallan ?? 0;
    if (r.conteo.pendientes != null) totalPendientes += r.conteo.pendientes;
    detalle = `${r.conteo.pasan} pasan · ${r.conteo.fallan} fallan`;
    if (r.conteo.pendientes != null) detalle += ` · ${r.conteo.pendientes} pendientes`;
  } else {
    hayConteoDesconocido = true;
    detalle = "no declarado (la salida no trae un resumen legible)";
  }

  let estado;
  if (r.skip) estado = "SKIP";
  else if (fallo) estado = `FALLA(${r.codigo})`;
  else estado = "ok";

  console.log(fila(r.nombre, estado, detalle));
  if (r.skip) {
    console.log(fila("", "", "^^ SKIP NO ES APROBADO: no se contrasto nada contra Odoo."));
  }
}

console.log("-".repeat(78));
console.log(`Pasos: ${resultados.length} · en rojo: ${pasosFallados}`);
console.log(
  `Comprobaciones sumadas: ${totalPasan} pasan · ${totalFallan} fallan` +
    (totalPendientes ? ` · ${totalPendientes} cifras pendientes de capturar` : "")
);
if (hayConteoDesconocido) {
  console.log(
    "AVISO: al menos un paso no declaro un conteo legible, asi que el total de\n" +
      "arriba es un PISO, no el numero exacto de comprobaciones en rojo."
  );
}

// Un paso que revienta a mitad (assert que lanza) ABORTA las pruebas que le
// quedaban en ese mismo archivo. El total de arriba, en ese caso, tampoco es
// el numero real: es lo que alcanzo a contarse antes del corte.
if (pasosFallados > 0) {
  console.log(
    "\nRecordatorio: los pasos que usan assert() cortan en su primer fallo, asi\n" +
      "que en un paso en rojo pueden quedar comprobaciones SIN CORRER. Arreglado\n" +
      "el primer fallo pueden aparecer mas — eso no es una regresion nueva."
  );
}

console.log("=".repeat(78));

if (pasosFallados > 0) {
  console.log(`\nRESULTADO: ${pasosFallados} de ${resultados.length} pasos en rojo.\n`);
  process.exit(1);
}
console.log("\nRESULTADO: todos los pasos en verde.\n");
