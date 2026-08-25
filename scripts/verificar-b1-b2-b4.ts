// VERIFICACION ADVERSARIAL de B1, B2 y B4.
//
// Escrita por el agente que NO reparo. Su proposito no es aprobar el trabajo
// sino intentar REFUTARLO; si no lo consigue, entonces lo aprueba.
//
// Importa el codigo REAL (no lo replica) y lo corre contra el dataset real de
// Supabase y contra el demo. Solo lectura.

import { cargarDatasetReal } from "../lib/datosReales";
import { datosDemo, gestionesSemilla } from "../lib/datos";
import { prioridadSimulada } from "../lib/simulados";
import { fmtMoneda, nombreDeCliente } from "../lib/calculos";
import { argumentoVentas, argumentoInventario, argumentoSeguimiento, argumentoDso } from "../lib/argumento";
import type { Dataset } from "../lib/types";

const linea = (s = "") => console.log(s);
let fallos = 0;
function chequeo(nombre: string, ok: boolean, detalle: string) {
  if (!ok) fallos++;
  linea(`  [${ok ? "PASA " : "FALLA"}] ${nombre}`);
  linea(`          ${detalle}`);
}

async function main() {
const real: Dataset = await cargarDatasetReal();
const corte = "2026-08-21";

linea("=".repeat(92));
linea("VERIFICACION ADVERSARIAL — B1 / B2 / B4 · dataset real: " + real.fuente + " · clientes " + real.clientes.length);
linea("=".repeat(92));

// ─────────────────────────────────────────────────────────────────────────────
// B1 · MONEDA — intento de refutacion: buscar un $ que haya sobrevivido
// ─────────────────────────────────────────────────────────────────────────────
linea("\nB1 · MONEDA");

// Se recorren TODOS los constructores de argumento sobre el dataset real y se
// barre cada texto que llega a pantalla buscando el simbolo $.
const args = [
  ["Ventas", argumentoVentas(real)],
  ["Inventario", argumentoInventario(real)],
  ["Seguimiento", argumentoSeguimiento(real, gestionesSemilla, corte)],
  ["DSO", argumentoDso(real, corte)],
] as const;

let conDolar = 0, conQuetzal = 0;
const ejemplosDolar: string[] = [];
for (const [nombre, a] of args) {
  const textos = JSON.stringify(a);
  const dolares = textos.match(/\$\s?[\d.,]+/g) ?? [];
  const quetzales = textos.match(/Q\s?[\d.,]+/g) ?? [];
  conDolar += dolares.length;
  conQuetzal += quetzales.length;
  if (dolares.length) ejemplosDolar.push(`${nombre}: ${dolares.slice(0, 3).join(" · ")}`);
}
chequeo(
  "Cero montos en $ sobre el dataset real (barrido de 4 argumentos completos)",
  conDolar === 0,
  `$ encontrados: ${conDolar} · Q encontrados: ${conQuetzal}` + (ejemplosDolar.length ? ` · ejemplos: ${ejemplosDolar.join(" | ")}` : ""),
);

// El demo DEBE seguir en dolares: si tambien se volvio Q, la reparacion se paso de largo.
const demoArg = argumentoDso(datosDemo, datosDemo.facturas[0]?.fecha_emision ?? "2026-01-01");
const demoTxt = JSON.stringify(demoArg);
chequeo(
  "El dataset demo SIGUE en $ (la reparacion no debia volverlo Q)",
  /\$\s?[\d.,]+/.test(demoTxt),
  `demo.fuente=${datosDemo.fuente} · tiene $: ${/\$/.test(demoTxt)} · tiene Q: ${/Q\s?[\d.,]+/.test(demoTxt)}`,
);

// fmtMoneda ya no admite una sola moneda: se comprueba que respeta la que se le pasa.
chequeo(
  "fmtMoneda respeta la moneda que se le pasa",
  fmtMoneda(1000, "GTQ").includes("Q") && fmtMoneda(1000, "USD").includes("$"),
  `GTQ -> ${fmtMoneda(1000, "GTQ")} · USD -> ${fmtMoneda(1000, "USD")}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// B2 · PRIORITARIOS — intento de refutacion del score
// ─────────────────────────────────────────────────────────────────────────────
linea("\nB2 · PRIORITARIOS");

const filas = prioridadSimulada(real, corte);
const n = filas.length;

const empatadosTope = filas.filter((f) => f.scoreSimulado === 100).length;
chequeo("Cero cuentas empatadas en el score tope (100)", empatadosTope === 0, `empatadas en 100: ${empatadosTope} de ${n}`);

const claves = filas.slice(0, 10).map((f) => `${f.scoreSimulado}|${f.saldoTotal}|${f.diasMaxAtraso}`);
chequeo("Clave score+saldo+dias unica en el top 10", new Set(claves).size === 10, `unicas: ${new Set(claves).size} de 10`);

// Determinismo real: se vuelve a calcular desde cero y se compara el orden.
const filas2 = prioridadSimulada(real, corte);
const mismoOrden = filas.every((f, i) => f.idCliente === filas2[i].idCliente);
chequeo("Orden determinista entre dos corridas independientes", mismoOrden, `coinciden las ${n} posiciones: ${mismoOrden}`);

const posWalmart = filas.findIndex((f) => /WALMART/i.test(f.nombreCliente)) + 1;
const posCemaco = filas.findIndex((f) => /CEMACO/i.test(f.nombreCliente)) + 1;
chequeo("WALMART por delante de CEMACO", posWalmart > 0 && posWalmart < posCemaco, `WALMART #${posWalmart} · CEMACO #${posCemaco}`);

// El criterio escrito era "menos del 5%". El informe declara 5.4%. Se comprueba.
//
// CORRECCION DEL PROPIO INSTRUMENTO: la primera version de este chequeo leia
// f.scoreSaldo y f.scoreDias — campos que NO EXISTEN en FilaPrioridad. Al
// comparar undefined >= 100 el filtro daba siempre 0, y producia un PASA FALSO
// justo en el unico punto donde el reparador habia declarado honestamente que
// NO cumple. tsx transpila sin verificar tipos, asi que el error paso mudo.
// Saturar significa alcanzar el techo, y el techo es el p95 nearest-rank.
const p95 = (v: number[]) => {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(Math.ceil(0.95 * o.length) - 1, o.length - 1)];
};
const techoSaldoObs = Math.max(p95(filas.map((f) => f.saldoTotal)), 1);
const techoDiasObs = Math.max(p95(filas.map((f) => f.diasMaxAtraso)), 1);
const satSaldo = filas.filter((f) => f.saldoTotal >= techoSaldoObs).length;
const satDias = filas.filter((f) => f.diasMaxAtraso >= techoDiasObs).length;
linea(`  (techos derivados: saldo ${techoSaldoObs} · dias ${techoDiasObs})`);
chequeo(
  "Saturacion del techo de saldo por debajo del 5%",
  satSaldo < n * 0.05,
  `${satSaldo} de ${n} = ${((satSaldo / n) * 100).toFixed(1)}% · criterio escrito: menos de ${(n * 0.05).toFixed(1)}`,
);
chequeo(
  "Saturacion del techo de dias por debajo del 5%",
  satDias < n * 0.05,
  `${satDias} de ${n} = ${((satDias / n) * 100).toFixed(1)}%`,
);

// REFUTACION INTENTADA: el techo se recalcula por dataset, o quedo fijo?
const filasDemo = prioridadSimulada(datosDemo, "2026-01-15");
const maxSaldoReal = Math.max(...filas.map((f) => f.saldoTotal));
const maxSaldoDemo = filasDemo.length ? Math.max(...filasDemo.map((f) => f.saldoTotal)) : 0;
chequeo(
  "El techo se DERIVA del dataset (demo y real dan escalas distintas)",
  filasDemo.length > 0 && maxSaldoDemo !== maxSaldoReal,
  `max saldo real ${maxSaldoReal} vs demo ${maxSaldoDemo} · filas demo: ${filasDemo.length}`,
);

// REFUTACION INTENTADA: hay algun score NaN, Infinity o fuera de 0..100?
const raros = filas.filter((f) => !Number.isFinite(f.scoreSimulado) || f.scoreSimulado < 0 || f.scoreSimulado > 100);
chequeo("Ningun score NaN, Infinity ni fuera de 0..100", raros.length === 0, `anomalos: ${raros.length}`);

// REFUTACION INTENTADA: dataset vacio no revienta.
let vacioOk = true, detalleVacio = "";
try {
  const vacio = prioridadSimulada({ ...real, facturas: [], clientes: [] } as Dataset, corte);
  detalleVacio = `devuelve ${vacio.length} filas, sin excepcion`;
} catch (e) {
  vacioOk = false;
  detalleVacio = `LANZA EXCEPCION: ${(e as Error).message}`;
}
chequeo("Dataset vacio no lanza excepcion (division por cero cubierta)", vacioOk, detalleVacio);

linea("\n  TOP 5 que ve la pagina hoy:");
filas.slice(0, 5).forEach((f, i) =>
  linea(`    ${i + 1}. score=${String(f.scoreSimulado).padStart(3)} ${fmtMoneda(f.saldoTotal, "GTQ").padStart(16)} ${String(f.diasMaxAtraso).padStart(5)}d  ${f.nombreCliente}`),
);

// ─────────────────────────────────────────────────────────────────────────────
// B4 · SEGUIMIENTO — intento de refutacion del fantasma
// ─────────────────────────────────────────────────────────────────────────────
linea("\nB4 · SEGUIMIENTO");

chequeo(
  "nombreDeCliente DECLARA el fallo en vez de imprimir el id crudo (dataset real)",
  nombreDeCliente(real.clientes, "CLI-004") !== "CLI-004" && nombreDeCliente(real.clientes, "CLI-004").includes("CLI-004"),
  `-> "${nombreDeCliente(real.clientes, "CLI-004")}"`,
);
chequeo(
  "nombreDeCliente SI resuelve cuando el cliente existe (dataset demo)",
  nombreDeCliente(datosDemo.clientes, "CLI-004") === datosDemo.clientes.find((c) => c.id_cliente === "CLI-004")?.nombre_cliente,
  `-> "${nombreDeCliente(datosDemo.clientes, "CLI-004")}"`,
);

// Un id real debe resolver a su nombre, no al fallback.
const idReal = real.clientes[0].id_cliente;
chequeo(
  "Un id REAL resuelve a su nombre (el fallback no se comio los casos buenos)",
  nombreDeCliente(real.clientes, idReal) === real.clientes[0].nombre_cliente,
  `${idReal} -> "${nombreDeCliente(real.clientes, idReal)}"`,
);

// Barrido: ningun texto del argumento de Seguimiento imprime un CLI-xxxx crudo.
// Prueba adversarial: se le ENTREGAN las gestiones fantasma junto al dataset
// real. Si el fallback no funcionara, aqui es donde CLI-004 saldria impreso.
const segTxt = JSON.stringify(argumentoSeguimiento(real, gestionesSemilla, corte));
const crudos = segTxt.match(/(?<!\()CLI-[A-Z0-9]+/g) ?? [];
chequeo("Ningun id CLI-xxxx crudo en los textos de Seguimiento (real)", crudos.length === 0, `encontrados: ${crudos.length}${crudos.length ? " -> " + crudos.slice(0, 3).join(",") : ""}`);

// La semilla existe todavia en el codigo, pero no debe verse con dataset real.
const semillaEnReal = gestionesSemilla.filter((g) => real.clientes.some((c) => c.id_cliente === g.id_cliente));
chequeo(
  "Los clientes de la semilla NO existen en el dataset real (el defecto era real)",
  semillaEnReal.length === 0,
  `${gestionesSemilla.length} gestiones semilla · ${semillaEnReal.length} con cliente existente en real`,
);

linea("\n" + "=".repeat(92));
linea(fallos === 0 ? "RESULTADO: no se pudo refutar ninguna afirmacion. Se aprueba." : `RESULTADO: ${fallos} chequeo(s) FALLAN. No se aprueba sin explicacion.`);
linea("=".repeat(92));
}

main();
