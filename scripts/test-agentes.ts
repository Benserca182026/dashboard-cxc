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
  AGENTES_DATOS,
  AGENTES_FORECAST,
  AGENTES_INVENTARIO,
  AGENTES_PRIORITARIOS,
  AGENTES_SEGUIMIENTO,
  AGENTES_VENTAS,
  type Agente,
  type Hallazgo,
} from "../components/Agentes";
import type { Dataset } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

/** Mira con un agente de cartera. `mirar` YA devuelve el tipo de tres estados:
 *  desde que migró el último grupo no hay adaptador que interponer. */
function ver(id: string, d: Dataset, corte: string): Hallazgo {
  const a = AGENTES.find((x) => x.id === id);
  assert.ok(a, `no existe el agente ${id}`);
  return a.mirar(d, corte);
}

/** Los SIETE grupos, para poder afirmar cosas sobre los 28 agentes a la vez. */
const GRUPOS: [string, Agente[]][] = [
  ["AGENTES", AGENTES],
  ["AGENTES_PRIORITARIOS", AGENTES_PRIORITARIOS],
  ["AGENTES_SEGUIMIENTO", AGENTES_SEGUIMIENTO],
  ["AGENTES_VENTAS", AGENTES_VENTAS],
  ["AGENTES_INVENTARIO", AGENTES_INVENTARIO],
  ["AGENTES_FORECAST", AGENTES_FORECAST],
  ["AGENTES_DATOS", AGENTES_DATOS],
];

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

// ── 5 · LOS SIETE GRUPOS ESTÁN MIGRADOS ─────────────────────────────────────
//
// Esta sección decía lo contrario: comprobaba que los agentes SIN migrar
// siguieran andando y declararan su deuda. Ya no queda ninguno, así que ahora
// afirma la propiedad opuesta y mucho más fuerte — y es la que impide que la
// deuda vuelva a entrar sin que nadie se dé cuenta.

console.log("\n— Los 28 agentes de los siete grupos están migrados —");

prueba("son 28 agentes: 4 de cartera + 6 grupos de módulo × 4", () => {
  const total = GRUPOS.reduce((s, [, lista]) => s + lista.length, 0);
  assert.equal(total, 28, `se contaron ${total}`);
  for (const [nombre, lista] of GRUPOS) {
    assert.equal(lista.length, 4, `${nombre} tiene ${lista.length} agentes, no 4`);
  }
});

prueba("ningún id de agente se repite entre los siete grupos", () => {
  const ids = GRUPOS.flatMap(([, lista]) => lista.map((a) => a.id));
  assert.equal(new Set(ids).size, ids.length, "hay ids duplicados");
});

prueba("TODO agente devuelve el tipo de tres estados, en todo escenario", () => {
  for (const [nombre, lista] of GRUPOS) {
    for (const a of lista) {
      for (const d of [datosDemo, DATASET_VACIO]) {
        const h = a.mirar(d, CORTE);
        assert.ok(
          h.estado === "hallazgo" || h.estado === "sin-hallazgo" || h.estado === "sin-dato",
          `${nombre}/${a.id} devolvió algo que no es un Hallazgo`
        );
      }
    }
  }
});

prueba("ya NO existe el placeholder «sin migrar»: todo agente declara entradas y filtro reales", () => {
  for (const [nombre, lista] of GRUPOS) {
    for (const a of lista) {
      const h = a.mirar(datosDemo, CORTE);
      if (h.estado === "sin-dato") continue;
      assert.ok(
        h.evidencia.entradas.length > 0,
        `${nombre}/${a.id} no declara ni una entrada: quedó sin migrar`
      );
      assert.doesNotMatch(
        h.evidencia.procedencia.filtro,
        /sin migrar/,
        `${nombre}/${a.id} todavía trae la procedencia del adaptador muerto`
      );
      assert.ok(h.evidencia.procedencia.modelo.length > 0, `${nombre}/${a.id} no declara origen`);
      assert.equal(h.evidencia.procedencia.corte, CORTE, `${nombre}/${a.id} no declara el corte`);
    }
  }
});

prueba("todo «sin-dato» explica las tres cosas, en cualquier grupo y escenario", () => {
  let vistos = 0;
  for (const [nombre, lista] of GRUPOS) {
    for (const a of lista) {
      for (const d of [datosDemo, DATASET_VACIO]) {
        const h = a.mirar(d, CORTE);
        if (h.estado !== "sin-dato") continue;
        vistos++;
        assert.ok(h.queFalta.trim().length > 20, `${nombre}/${a.id}: queFalta no explica nada`);
        assert.ok(h.consecuencia.trim().length > 20, `${nombre}/${a.id}: consecuencia no explica nada`);
        assert.ok(h.comoSeLlena.trim().length > 20, `${nombre}/${a.id}: comoSeLlena no explica nada`);
        assert.ok(!("texto" in h), `${nombre}/${a.id}: un sin-dato con texto vuelve a mentir`);
        assert.ok(!("evidencia" in h), `${nombre}/${a.id}: no hay evidencia de lo que no se midió`);
      }
    }
  }
  assert.ok(vistos >= 19, `sólo ${vistos} casos «sin-dato»: la cartera vacía debería producir muchos más`);
});

prueba("todo ranking declara su denominador y va ordenado de mayor a menor", () => {
  for (const [nombre, lista] of GRUPOS) {
    for (const a of lista) {
      const h = a.mirar(datosDemo, CORTE);
      if (h.estado !== "hallazgo" || !h.ranking) continue;
      const r = h.ranking;
      assert.ok(r.total > 0, `${nombre}/${a.id}: ranking sin denominador declarado`);
      assert.ok(r.filas.length <= 10, `${nombre}/${a.id}: ranking de ${r.filas.length} filas`);
      for (let i = 1; i < r.filas.length; i++) {
        assert.ok(
          r.filas[i - 1].valor >= r.filas[i].valor,
          `${nombre}/${a.id}: ranking desordenado`
        );
      }
      for (const f of r.filas) {
        assert.ok(
          Math.abs((f.valor / r.total) * 100 - f.pct) < 0.05,
          `${nombre}/${a.id}: pct incoherente en ${f.etiqueta}`
        );
      }
    }
  }
});

prueba("un agente cuya pregunta es un CONTEO no fabrica ranking", () => {
  // La regla que este proyecto extirpa: inventar un top N donde no hay reparto.
  // Estos cuatro preguntan «¿cuántos?» o «¿hay alguno?» — no admiten orden.
  const deConteo = ["filtro", "bitacora-bloqueo", "huerfano", "vencimiento-dato", "duplicado-dato"];
  for (const [nombre, lista] of GRUPOS) {
    for (const a of lista) {
      if (!deConteo.includes(a.id)) continue;
      const h = a.mirar(datosDemo, CORTE);
      assert.ok(
        !("ranking" in h && h.ranking),
        `${nombre}/${a.id} fabricó un ranking para una pregunta de conteo`
      );
    }
  }
});

console.log(
  `\n${pruebas} pruebas de agentes pasaron. Contrato de TRES estados verificado sobre el dataset demo.\n`
);
