/**
 * PRUEBA DE COHERENCIA DEL CONTRATO Y SU FIXTURE · CLIENTES · B18
 * ==================================================================
 * Nace de un defecto real: en la v1 del fixture los cuatro tramos de
 * recencia compartían el mismo generador, y el tramo "Más de 90 días"
 * listaba clientes de 10, 20 y 22 días. Se veía en pantalla.
 *
 * El daño de ese defecto no es cosmético. Una pantalla cuyo propósito
 * es declarar de dónde sale cada número, mostrando un cliente en el
 * tramo equivocado, enseña a desconfiar de todo lo demás que dice.
 *
 * Corre con:  npx tsx contrato-clientes.test.ts
 * o adaptado a node --test, que es lo que usa el repo.
 */

import {
  CXC_PENDIENTE_ENLACE,
  CXC_PENDIENTE_MENSAJE,
  NO_AFIRMABLE,
  type ClaveRecencia,
  type MapaClientesB18,
} from "./contrato-clientes-b18";
import { FIXTURE_CLIENTES_B18 } from "./contrato-clientes-fixture";

let fallos = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { fallos++; console.error(`  ✗ ${msg}`); } else { console.log(`  ✓ ${msg}`); }
};

/** La ventana de días que cada tramo promete. Es la definición, no una sugerencia. */
const VENTANA: Record<ClaveRecencia, [number, number]> = {
  "0-30": [0, 30],
  "31-60": [31, 60],
  "61-90": [61, 90],
  "90+": [91, Infinity],
};

export function verificarMapa(mapa: MapaClientesB18, nombre: string) {
  console.log(`\n=== ${nombre} ===`);

  // ── 1. EL DEFECTO QUE ORIGINÓ ESTA PRUEBA ────────────────────────
  console.log("\n[recencia] cada cliente pertenece al tramo donde aparece");
  for (const tramo of mapa.b18.recencia.tramos) {
    const [min, max] = VENTANA[tramo.clave];
    const intrusos = tramo.filas.filter(
      (f) => f.dias === null || f.dias < min || f.dias > max,
    );
    ok(
      intrusos.length === 0,
      `${tramo.etiqueta}: ${tramo.filas.length} filas dentro de [${min}, ${max === Infinity ? "∞" : max}]` +
        (intrusos.length
          ? ` — INTRUSOS: ${intrusos.map((f) => `${f.etiqueta} (${f.dias} d)`).join(", ")}`
          : ""),
    );
  }

  // La fecha de última compra tiene que ser coherente con los días declarados.
  console.log("\n[recencia] ultima compra coherente con dias al corte");
  const corte = Date.parse(`${mapa.procedencia.corte}T00:00:00Z`);
  for (const tramo of mapa.b18.recencia.tramos) {
    const malas = tramo.filas.filter((f) => {
      if (!f.ultima || f.dias === null) return true;
      const d = Math.round((corte - Date.parse(`${f.ultima}T00:00:00Z`)) / 86400000);
      return Math.abs(d - f.dias) > 1;
    });
    ok(malas.length === 0, `${tramo.etiqueta}: fechas consistentes con dias`);
  }

  // Ningún cliente puede estar en dos tramos a la vez.
  const ids = mapa.b18.recencia.tramos.flatMap((t) => t.filas.map((f) => f.id));
  ok(new Set(ids).size === ids.length, "[recencia] ningun cliente repetido entre tramos");

  // ── 2. totalFilas — el hueco que cerró la v2 ─────────────────────
  console.log("\n[v2] totalFilas permite decir \"10 de 243\"");
  for (const tramo of mapa.b18.recencia.tramos) {
    ok(
      tramo.totalFilas >= tramo.filas.length && tramo.totalFilas === tramo.clientes,
      `recencia ${tramo.etiqueta}: ${tramo.filas.length} de ${tramo.totalFilas}`,
    );
  }
  for (const corte of mapa.b18.concentracion.cortes) {
    ok(
      corte.totalFilas >= corte.filas.length,
      `concentracion ${corte.etiqueta}: ${corte.filas.length} de ${corte.totalFilas}`,
    );
  }
  // v3 · el mismo hueco, en el sitio donde sobrevivió a la v2.
  for (const agente of mapa.agentes) {
    ok(
      agente.listaTotal >= agente.lista.length,
      `agente ${agente.nombre}: lista ${agente.lista.length} de ${agente.listaTotal}`,
    );
  }

  // ── 3. CxC no puede mentir ───────────────────────────────────────
  console.log("\n[v2] CxC degradado y honesto");
  const cxc = mapa.b18.cxc;
  if (cxc.estado === "pendiente") {
    ok(cxc.cifras === null, "pendiente: no hay cifras dibujables (null, no ceros)");
    ok(cxc.pendiente?.mensaje === CXC_PENDIENTE_MENSAJE, "pendiente: mensaje literal del contrato");
    ok(cxc.pendiente?.enlace.href === CXC_PENDIENTE_ENLACE.href, `pendiente: enlace a ${CXC_PENDIENTE_ENLACE.href}`);
    const serializado = JSON.stringify(cxc);
    ok(!/Q0\.00/.test(serializado), "pendiente: no aparece ningun Q0.00");
    ok(!/No derivable/i.test(serializado), "pendiente: no aparece \"No derivable\"");
    ok(!/1,?133,?597|1,?108,?597|935,?596/.test(serializado), "pendiente: no filtra ninguna cifra de cartera");
  } else {
    ok(cxc.cifras !== null, "integrado: las tres cifras existen");
    ok(cxc.pendiente === null, "integrado: no queda el bloque pendiente");
  }

  // ── 4. Reglas que ya existían en v1 ──────────────────────────────
  console.log("\n[estructura]");
  ok(mapa.agentes.length === 4, "hay exactamente 4 agentes");
  ok(
    JSON.stringify(mapa.agentes.map((a) => a.slot)) ===
      JSON.stringify(["detecta", "explica", "prioriza", "recomienda"]),
    "orden de slots detecta -> recomienda",
  );
  ok(new Set(mapa.agentes.map((a) => a.id)).size === 4, "4 ids distintos");

  console.log("\n[procedencia] ninguna vacia");
  const procedencias = [
    mapa.procedencia,
    ...mapa.agentes.map((a) => a.procedencia),
    ...Object.values(mapa.b18).map((p) => p.procedencia),
  ];
  ok(procedencias.every((p) => p.limite.trim().length > 0), `limite no vacio en ${procedencias.length} procedencias`);
  ok(procedencias.every((p) => p.cobertura.etiqueta.trim().length > 0), "cobertura siempre dice que mide");
  ok(procedencias.every((p) => p.corte === mapa.procedencia.corte), "un solo corte en toda la pantalla");

  console.log("\n[serie] lo parcial va marcado");
  const parciales = mapa.b18.serie.meses.filter((m) => m.parcial).map((m) => m.clave);
  ok(parciales.includes("2022-08") && parciales.includes("2026-08"), `parciales: ${parciales.join(", ")}`);
  ok(
    mapa.b18.serie.meses.filter((m) => m.parcial).every((m) => !!m.nota),
    "todo mes parcial explica por que",
  );

  console.log("\n[limites] lo que no se puede afirmar");
  ok(mapa.b18.cobertura.noAfirmable.length === NO_AFIRMABLE.length, `${NO_AFIRMABLE.length} dimensiones no afirmables listadas`);

  console.log(`\n${fallos === 0 ? "TODO PASA" : `${fallos} FALLOS`}`);
  return fallos;
}

verificarMapa(FIXTURE_CLIENTES_B18, "FIXTURE_CLIENTES_B18");
if (fallos > 0) process.exit(1);
