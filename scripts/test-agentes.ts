// Pruebas de los agentes de cartera (components/Agentes.tsx).
//
// POR QUÉ EXISTE ESTE ARCHIVO: los siete grupos de agentes tenían CERO
// cobertura — ni una prueba —, y son la capa que le habla al usuario en prosa.
// Esta suite es el molde: los otros seis grupos se migran copiándola.
//
// Lo que se prueba es el CONTRATO de tres estados, no la aritmética (esa vive
// en test-calculos y test-kpis y ya está cubierta):
//   · un agente que encuentra algo   -> "hallazgo" con evidencia completa
//   · un agente que mira y no halla  -> "sin-hallazgo", que NO es lo mismo
//   · un agente que no puede mirar   -> "sin-dato" con los tres campos
//   · la prosa no cambió al separar medir de redactar
//
// Ejecutar con: npm test

import assert from "node:assert/strict";
import { datosDemo } from "../lib/datos";
import {
  AGENTES,
  AGENTES_VENTAS,
  contarHallazgos,
  normalizarHallazgo,
  type Hallazgo,
} from "../components/Agentes";
import type { Dataset } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

/** Mira con un agente y devuelve SIEMPRE el tipo de tres estados. */
function ver(id: string, d: Dataset, corte: string): Hallazgo {
  const a = AGENTES.find((x) => x.id === id);
  assert.ok(a, `no existe el agente ${id}`);
  return normalizarHallazgo(a.mirar(d, corte), a, corte);
}

/** Un dataset legítimo y VACÍO: no es un dataset roto, es una cartera sin
 *  facturas. Es el único caso en que un agente de antigüedad no puede mirar. */
const DATASET_VACIO: Dataset = {
  clientes: [],
  facturas: [],
  pagos: [],
  notasCredito: [],
  disputas: [],
  condicionesPago: [],
  fuente: "demo-ficticio",
};

const CORTE = "2026-08-19";

// ── 1 · Encontré algo ───────────────────────────────────────────────────────

console.log("\n— Estado (a): el agente encontró algo —");

prueba("Rastreador sobre el demo al corte 2026-08-19 → estado \"hallazgo\"", () => {
  const h = ver("rastreador", datosDemo, CORTE);
  assert.equal(h.estado, "hallazgo");
});

prueba("el hallazgo trae evidencia COMPLETA: expresión, entradas y procedencia", () => {
  const h = ver("rastreador", datosDemo, CORTE);
  assert.equal(h.estado, "hallazgo");
  if (h.estado !== "hallazgo") return;
  assert.equal(h.evidencia.expresion, "mayor saldo del tramo ÷ total del tramo · umbral 60%");
  assert.ok(h.evidencia.entradas.length > 0, "la evidencia no declara ni una entrada");
  // Los valores de la fórmula, no sólo la fórmula: eso era lo que se tiraba.
  const nombres = h.evidencia.entradas.map((e) => e.nombre);
  assert.ok(nombres.includes("mayor saldo del tramo"), `faltó una entrada: ${nombres.join(", ")}`);
  assert.ok(nombres.includes("total del tramo"), `faltó una entrada: ${nombres.join(", ")}`);
  assert.ok(h.evidencia.procedencia.modelo.length > 0);
  assert.ok(h.evidencia.procedencia.filtro.length > 0);
  assert.equal(h.evidencia.procedencia.corte, CORTE);
});

prueba("el ranking sale de lo que ya se calculaba: ordenado desc y con su denominador", () => {
  const h = ver("balanza", datosDemo, CORTE);
  assert.equal(h.estado, "hallazgo");
  if (h.estado !== "hallazgo") return;
  const r = h.ranking;
  assert.ok(r, "Balanza debería traer ranking: concentracionRiesgo ya devuelve porCliente");
  if (!r) return;
  assert.ok(r.filas.length > 0);
  assert.ok(r.total > 0, "el denominador del porcentaje va explícito, nunca implícito");
  for (let i = 1; i < r.filas.length; i++) {
    assert.ok(r.filas[i - 1].valor >= r.filas[i].valor, "el ranking no está ordenado de mayor a menor");
  }
  // Cada pct se corresponde con su propio total declarado.
  for (const f of r.filas) {
    assert.ok(Math.abs((f.valor / r.total) * 100 - f.pct) < 0.05, `pct incoherente en ${f.etiqueta}`);
  }
});

prueba("el ranking no pasa de 10 filas", () => {
  const h = ver("balanza", datosDemo, CORTE);
  if (h.estado !== "hallazgo" || !h.ranking) return;
  assert.ok(h.ranking.filas.length <= 10, `${h.ranking.filas.length} filas`);
});

// ── 2 · Miré y no había nada ────────────────────────────────────────────────

console.log("\n— Estado (b): el agente miró y no encontró —");

prueba("Sello sobre el demo → \"sin-hallazgo\" (miró: todas tienen vencimiento)", () => {
  const h = ver("sello", datosDemo, CORTE);
  assert.equal(h.estado, "sin-hallazgo");
});

prueba("un \"sin-hallazgo\" TAMBIÉN trae evidencia: es una respuesta, no un vacío", () => {
  const h = ver("sello", datosDemo, CORTE);
  assert.equal(h.estado, "sin-hallazgo");
  if (h.estado !== "sin-hallazgo") return;
  assert.ok(h.evidencia.entradas.length > 0, "miró: tiene que poder decir con qué números");
  const nombres = h.evidencia.entradas.map((e) => e.nombre);
  assert.ok(nombres.includes("facturas clasificadas"));
});

prueba("NO se fabrica ranking donde la pregunta no admite uno", () => {
  // Sello sin excluidas no tiene nada que rankear. Un top N vacío o inventado
  // sería exactamente el vicio que este proyecto viene extirpando.
  const h = ver("sello", datosDemo, CORTE);
  assert.equal(h.estado, "sin-hallazgo");
  assert.ok(!("ranking" in h && h.ranking), "Sello sin excluidas no debe traer ranking");
});

// ── 3 · No pude mirar ───────────────────────────────────────────────────────

console.log("\n— Estado (c): el agente NO PUDO mirar —");

prueba("Cronómetro sobre una cartera sin facturas → \"sin-dato\", no \"sin-hallazgo\"", () => {
  const h = ver("cronometro", DATASET_VACIO, CORTE);
  assert.equal(
    h.estado,
    "sin-dato",
    "sin facturas clasificadas no hay antigüedad que promediar: eso NO es «miré y no encontré»"
  );
});

prueba("los tres campos de \"sin-dato\" vienen llenos, no vacíos", () => {
  const h = ver("cronometro", DATASET_VACIO, CORTE);
  assert.equal(h.estado, "sin-dato");
  if (h.estado !== "sin-dato") return;
  // Son obligatorios en el tipo; acá se comprueba que además digan algo.
  assert.ok(h.queFalta.trim().length > 20, "queFalta no explica nada");
  assert.ok(h.consecuencia.trim().length > 20, "consecuencia no explica nada");
  assert.ok(h.comoSeLlena.trim().length > 20, "comoSeLlena no explica nada");
});

prueba("un \"sin-dato\" NO afirma prosa de hallazgo: no tiene texto ni evidencia", () => {
  const h = ver("cronometro", DATASET_VACIO, CORTE);
  assert.equal(h.estado, "sin-dato");
  assert.ok(!("texto" in h), "un sin-dato con texto volvería a mentir como el tipo viejo");
  assert.ok(!("evidencia" in h), "no hay evidencia de algo que no se pudo medir");
});

prueba("contarHallazgos separa los TRES estados y suman el total", () => {
  const c = contarHallazgos(DATASET_VACIO, CORTE);
  assert.equal(c.total, AGENTES.length);
  assert.equal(c.con + c.sinHallazgo + c.sinDato, c.total, "algún agente no cayó en ningún estado");
  assert.ok(c.sinDato >= 1, "con la cartera vacía, al menos el Cronómetro no puede mirar");
});

// ── 4 · La prosa NO cambió al separar medir de redactar ─────────────────────

console.log("\n— La prosa es la misma que antes del refactor (Paso 3) —");

// Textos capturados del código ANTERIOR a separar `mirar` en `medir`+`redactar`.
// Si alguno cambia, se tocó algo que no se debía tocar.
const PROSA_ESPERADA: Record<string, Record<string, string>> = {
  "2026-08-19": {
    rastreador:
      "DEMO-1005 es el 100% del tramo 1-30 ($2,500.00 de $2,500.00). El tramo describe una factura, no una tendencia.",
    balanza:
      "Comercializadora Ficticia Alfa tiene el 38.96% de la cartera ($3,000.00 de $7,700.00). El promedio lo describe a él, no al conjunto.",
    cronometro:
      "Ponderada 34.42 d y promedio simple 34.40 d casi coinciden: el tamaño no distorsiona la antigüedad.",
    sello: "Todas las facturas con saldo tienen fecha de vencimiento. Nada queda fuera del aging.",
  },
  "2026-09-15": {
    rastreador:
      "DEMO-1001 es el 100% del tramo 1-30 ($1,000.00 de $1,000.00). El tramo describe una factura, no una tendencia.",
    balanza:
      "Comercializadora Ficticia Alfa tiene el 38.96% de la cartera ($3,000.00 de $7,700.00). El promedio lo describe a él, no al conjunto.",
    cronometro:
      "Ponderada 59.73 d y promedio simple 58.80 d casi coinciden: el tamaño no distorsiona la antigüedad.",
    sello: "Todas las facturas con saldo tienen fecha de vencimiento. Nada queda fuera del aging.",
  },
};

for (const [corte, esperados] of Object.entries(PROSA_ESPERADA)) {
  for (const [id, texto] of Object.entries(esperados)) {
    prueba(`${id} al corte ${corte}: prosa idéntica, carácter por carácter`, () => {
      const h = ver(id, datosDemo, corte);
      // assert.ok estrecha el tipo: de acá para abajo `h` ya no puede ser
      // "sin-dato", así que `h.texto` existe sin más guardas.
      assert.ok(h.estado !== "sin-dato", `${id} no debería quedar sin dato con el demo`);
      assert.equal(h.texto, texto);
    });
  }
}

// ── 5 · Los grupos NO migrados siguen funcionando ───────────────────────────

console.log("\n— Los seis grupos sin migrar siguen andando, y declaran su deuda —");

prueba("un agente legado se normaliza a uno de los tres estados", () => {
  const a = AGENTES_VENTAS[0];
  const h = normalizarHallazgo(a.mirar(datosDemo, CORTE), a, CORTE);
  assert.ok(h.estado === "hallazgo" || h.estado === "sin-hallazgo" || h.estado === "sin-dato");
});

prueba("un agente legado DECLARA que todavía no trae entradas, en vez de inventarlas", () => {
  const a = AGENTES_VENTAS[0];
  const h = normalizarHallazgo(a.mirar(datosDemo, CORTE), a, CORTE);
  if (h.estado === "sin-dato") return;
  assert.equal(h.evidencia.entradas.length, 0, "un agente sin migrar no puede traer entradas de la nada");
  assert.match(h.evidencia.procedencia.filtro, /sin migrar/);
  assert.equal(h.evidencia.expresion, a.base);
});

console.log(
  `\n${pruebas} pruebas de agentes pasaron. Contrato de TRES estados verificado sobre el dataset demo.\n`
);
