#!/usr/bin/env node
// COMPROBADOR DEL SALDO INICIAL DE INVENTARIO — se corre ANTES de cargar nada.
//
// ─────────────────────────────────────────────────────────────────────────────
// EL PELIGRO QUE ESTE ARCHIVO EXISTE PARA ATAJAR
// ─────────────────────────────────────────────────────────────────────────────
// La existencia se arma como:  saldo inicial + Σ movimientos posteriores.
// Si el saldo inicial sale de un `stock.quant` tomado en el instante T, y se le
// suman movimientos ocurridos EN O ANTES de T, esos movimientos ya estaban
// dentro del saldo inicial y se cuentan DOS VECES.
//
// Un doble conteo:
//   · no da negativo,
//   · no lanza ninguna excepcion,
//   · no rompe ninguna prueba existente,
//   · y produce un numero perfectamente plausible.
// Es indistinguible de un dato correcto mirandolo. La UNICA forma de agarrarlo
// es comprobar la identidad PRODUCTO POR PRODUCTO contra la cifra que declara
// Odoo. Un total agregado que "da parecido" no prueba nada: un producto de mas
// y otro de menos se cancelan entre si y el agregado sale limpio.
//
// ─────────────────────────────────────────────────────────────────────────────
// USO
// ─────────────────────────────────────────────────────────────────────────────
//   node verificacion/saldo-inicial-inventario.mjs <quant.json> <instante-del-snapshot>
//
//   <quant.json>  salida de:
//       node _odoo.mjs leer stock.quant product_id,location_id,quantity \
//         --dominio '[["location_id.usage","=","internal"]]' --salida quant.json
//
//   <instante-del-snapshot>  fecha/hora EXACTA a la que corresponde ese quant,
//       en ISO (ej. 2026-08-24T14:30). NO se adivina y NO se asume "hoy":
//       si no se pasa, el script se niega a correr. Odoo no escribe esa marca
//       en el archivo, asi que la tiene que declarar quien corrio el extracto.
//
// NO ESCRIBE NADA, NI EN ODOO NI EN SUPABASE. Solo lee y dictamina.

import { readFileSync, existsSync } from "node:fs";

const SUPABASE_URL = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";

const [rutaQuant, instante] = process.argv.slice(2);

if (!rutaQuant || !instante) {
  console.error(`
FALTA UN ARGUMENTO — y no se inventa ninguno.

  node verificacion/saldo-inicial-inventario.mjs <quant.json> <instante-del-snapshot>

El instante del snapshot es obligatorio a proposito. Sin el no hay forma de
saber que movimientos ya estan adentro del saldo inicial, y cargar el saldo a
ciegas es exactamente como se produce un doble conteo silencioso.
`);
  process.exit(1);
}

if (!existsSync(rutaQuant)) {
  console.error(`No existe el archivo ${rutaQuant}.`);
  process.exit(1);
}

const corte = new Date(instante);
if (Number.isNaN(corte.getTime())) {
  console.error(`"${instante}" no es una fecha/hora que se pueda leer. Usa ISO, ej. 2026-08-24T14:30.`);
  process.exit(1);
}

// ── Quant de Odoo: existencia declarada por producto ────────────────────────
const quantCrudo = JSON.parse(readFileSync(rutaQuant, "utf8"));
const skuDe = (v) => {
  // product_id llega como [id, "[SKU] NOMBRE"]
  const texto = Array.isArray(v) ? v[1] : String(v ?? "");
  const m = /^\[([^\]]+)\]/.exec(texto.trim());
  return m ? m[1].trim().toUpperCase() : texto.trim().toUpperCase();
};

const odooPorSku = new Map();
for (const q of quantCrudo) {
  const sku = skuDe(q.product_id);
  odooPorSku.set(sku, (odooPorSku.get(sku) ?? 0) + Number(q.quantity ?? 0));
}

// ── Movimientos ya cargados en Supabase ─────────────────────────────────────
async function traerTodo(tabla, orden, columnas) {
  const filas = [];
  let desde = 0;
  const pagina = 1000;
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=${encodeURIComponent(columnas)}&order=${orden}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${desde}-${desde + pagina - 1}`,
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} leyendo ${tabla}`);
    const lote = await r.json();
    if (!Array.isArray(lote)) throw new Error(`respuesta inesperada de ${tabla}`);
    filas.push(...lote);
    if (lote.length < pagina) break;
    desde += pagina;
  }
  return filas;
}

const movimientos = await traerTodo(
  "movimientos_inventario",
  "id_movimiento.asc",
  "id_movimiento,id_producto,fecha,tipo_movimiento,cantidad"
);
const productos = await traerTodo("productos", "id_producto.asc", "id_producto,sku");

const skuPorIdProducto = new Map(productos.map((p) => [p.id_producto, String(p.sku ?? "").trim().toUpperCase()]));

// Signo: entrada suma, salida resta, ajuste suma tal cual viene.
const signo = (tipo) => (String(tipo).toLowerCase() === "salida" ? -1 : 1);

// ── El reparto que decide todo ──────────────────────────────────────────────
// ANTES/EN el corte  -> ya esta DENTRO del quant. Sumarlo seria doble conteo.
// DESPUES del corte  -> hay que sumarlo encima del saldo inicial.
const antesPorSku = new Map();
const despuesPorSku = new Map();
let sinSku = 0;

for (const m of movimientos) {
  const sku = skuPorIdProducto.get(m.id_producto);
  if (!sku) {
    sinSku++;
    continue;
  }
  const f = new Date(m.fecha);
  const delta = signo(m.tipo_movimiento) * Number(m.cantidad ?? 0);
  const destino = f <= corte ? antesPorSku : despuesPorSku;
  destino.set(sku, (destino.get(sku) ?? 0) + delta);
}

// ── Dictamen ────────────────────────────────────────────────────────────────
console.log("=".repeat(78));
console.log("SALDO INICIAL DE INVENTARIO — comprobacion producto por producto");
console.log("=".repeat(78));
console.log(`snapshot quant declarado a: ${corte.toISOString()}`);
console.log(`productos en el quant de Odoo: ${odooPorSku.size}`);
console.log(`movimientos en Supabase:       ${movimientos.length}`);
if (sinSku) console.log(`movimientos sin SKU resoluble: ${sinSku} (se ignoran y se declaran)`);

const conAntes = [...antesPorSku.entries()].filter(([, v]) => v !== 0);
console.log(`\nSKU con movimientos EN O ANTES del corte: ${conAntes.length}`);
console.log(`SKU con movimientos DESPUES del corte:    ${[...despuesPorSku.entries()].filter(([, v]) => v !== 0).length}`);

// El saldo inicial correcto NO es el quant: es el quant menos lo que ya paso
// dentro de la ventana importada. Se calcula y se muestra, no se carga.
console.log(`\n${"-".repeat(78)}`);
console.log("SALDO INICIAL QUE HABRIA QUE CARGAR (quant - movimientos ya dentro del corte)");
console.log("-".repeat(78));
console.log("SKU".padEnd(24) + "quant".padStart(10) + "movs<=corte".padStart(14) + "saldo inicial".padStart(15));

const faltantes = [];
const sobrantes = [];
let mostrados = 0;
for (const [sku, cantidadOdoo] of odooPorSku) {
  const yaDentro = antesPorSku.get(sku) ?? 0;
  const inicial = cantidadOdoo - yaDentro;
  if (mostrados < 15) {
    console.log(
      sku.padEnd(24) +
        String(cantidadOdoo).padStart(10) +
        String(yaDentro).padStart(14) +
        String(inicial).padStart(15)
    );
    mostrados++;
  }
}
if (odooPorSku.size > 15) console.log(`... y ${odooPorSku.size - 15} SKU mas`);

// ── Omisiones: los dos lados tienen que cubrir el mismo catalogo ────────────
for (const sku of odooPorSku.keys()) {
  if (!skuPorIdProducto.size) break;
  if (![...skuPorIdProducto.values()].includes(sku)) faltantes.push(sku);
}
for (const sku of new Set(skuPorIdProducto.values())) {
  if (sku && !odooPorSku.has(sku)) sobrantes.push(sku);
}

console.log(`\n${"-".repeat(78)}`);
console.log("DESCUADRES DE CATALOGO");
console.log("-".repeat(78));
console.log(`SKU en Odoo que NO estan en la tabla productos: ${faltantes.length}`);
if (faltantes.length) console.log(`   ejemplos: ${faltantes.slice(0, 10).join(", ")}`);
console.log(`SKU en productos que NO aparecen en el quant de Odoo: ${sobrantes.length}`);
if (sobrantes.length) console.log(`   ejemplos: ${sobrantes.slice(0, 10).join(", ")}`);
console.log("   (un SKU sin quant puede ser legitimo: existencia cero. Un SKU en Odoo");
console.log("    que falta en productos es una OMISION del import y hay que explicarla.)");

// ── El testigo ──────────────────────────────────────────────────────────────
const TESTIGO = "ED-11.7.3";
console.log(`\n${"=".repeat(78)}`);
console.log(`PRODUCTO TESTIGO ${TESTIGO}`);
console.log("=".repeat(78));
if (!odooPorSku.has(TESTIGO)) {
  console.log(`${TESTIGO} NO aparece en el quant. Sin el testigo no se valida la carga.`);
  process.exit(1);
}
const quantTestigo = odooPorSku.get(TESTIGO);
const antesTestigo = antesPorSku.get(TESTIGO) ?? 0;
const despuesTestigo = despuesPorSku.get(TESTIGO) ?? 0;
const inicialTestigo = quantTestigo - antesTestigo;
console.log(`quant declarado por Odoo:            ${quantTestigo}`);
console.log(`movimientos EN O ANTES del corte:    ${antesTestigo}   <- YA estan dentro del quant`);
console.log(`saldo inicial a cargar:              ${inicialTestigo}`);
console.log(`movimientos DESPUES del corte:       ${despuesTestigo}`);
console.log(`existencia final esperada:           ${inicialTestigo + antesTestigo + despuesTestigo}`);
console.log("");
console.log("REGLA DE ACEPTACION: despues de cargar, la existencia calculada por la app");
console.log(`para ${TESTIGO} tiene que dar EXACTAMENTE ${quantTestigo + despuesTestigo}, no "cerca".`);
console.log("Si da otra cosa, hubo doble conteo u omision y NO se sigue adelante.");
console.log("=".repeat(78));

if (conAntes.length > 0) {
  console.log(`
AVISO, y es el importante: hay ${conAntes.length} SKU con movimientos fechados EN O
ANTES del snapshot. Esos movimientos YA ESTAN CONTENIDOS en el quant. Cargar el
quant como saldo inicial SIN restarlos primero los cuenta dos veces.

La columna "saldo inicial" de arriba ya trae esa resta hecha. Es ESE numero el
que se carga, NO el quant crudo.
`);
}
