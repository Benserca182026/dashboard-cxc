#!/usr/bin/env node
// EXTRACTOR DE ODOO — SOLO LECTURA.
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE CAMBIO ESTE ARCHIVO (2026-08-24)
// ─────────────────────────────────────────────────────────────────────────────
// La version anterior (22 lineas) navegaba a una URL con un fragmento fijo
// (#menu_id=191&action=203&model=account.payment&view_type=list) y le hacia
// clic al boton de descarga. Eso funciona, pero tiene tres limites duros:
//   1. hay que conocer el menu_id/action de cada modelo, que no se adivinan;
//   2. el archivo que baja trae LAS COLUMNAS DE LA VISTA, no las que uno
//      quiere — por eso `discount` nunca llego, y por eso `stock.quant` se
//      importo sin su cantidad;
//   3. el export sale AGRUPADO, con filas de encabezado de grupo mezcladas
//      con las de dato, que hay que detectar y saltar a mano.
//
// La mecanica que SI generaliza no es cambiar la URL: es pedirle los datos al
// mismo endpoint JSON-RPC que usa la interfaz de Odoo, desde adentro de una
// pagina ya autenticada. Se elige el modelo, los campos EXACTOS y el filtro.
// (Encontrado en pull-sale-lines.js / pull-sale-orders.js de una sesion
// anterior, que asi trajeron las 24.349 lineas con price_subtotal.)
//
// ─────────────────────────────────────────────────────────────────────────────
// ESTE SCRIPT NO PUEDE ESCRIBIR EN ODOO — POR CONSTRUCCION
// ─────────────────────────────────────────────────────────────────────────────
// Solo se permiten los metodos de METODOS_PERMITIDOS. `create`, `write`,
// `unlink`, `action_*`, `button_*` y cualquier otro se rechazan ANTES de tocar
// la red. No es una convencion ni un comentario pidiendo cuidado: es una lista
// blanca, y el script termina con error si se intenta otra cosa.
//
// ─────────────────────────────────────────────────────────────────────────────
// QUE NECESITA EL ENTORNO
// ─────────────────────────────────────────────────────────────────────────────
//   1. Playwright (ya esta: node_modules/playwright).
//   2. Un Chromium con depuracion remota Y SESION DE ODOO INICIADA.
//      El login es MANUAL la primera vez; despues queda en el perfil.
//      Levantarlo:   node _odoo.mjs abrir
//      Eso abre una ventana con un perfil propio (.odoo-perfil/) en el puerto
//      9333. Se inicia sesion a mano UNA vez y se deja abierta.
//
//      No sirve el Chrome personal del usuario: desde Chrome 136
//      --remote-debugging-port se ignora sobre el perfil por defecto (aca hay
//      Chrome 151), por eso hace falta un userDataDir aparte.
//
// ─────────────────────────────────────────────────────────────────────────────
// USO
// ─────────────────────────────────────────────────────────────────────────────
//   node _odoo.mjs abrir
//   node _odoo.mjs leer <modelo> <campos,separados,por,coma> [opciones]
//
//   Opciones:
//     --dominio '<json>'   filtro Odoo. Ej: '[["state","=","sale"]]'
//     --salida <archivo>   escribe JSON. Sin esto, imprime un resumen.
//     --puerto <n>         puerto CDP (9333 por defecto)
//     --limite <n>         tamano de pagina (2000 por defecto)
//
//   Ejemplos que resuelven pendientes concretos de este proyecto:
//     node _odoo.mjs leer sale.order.line \
//       order_id,product_id,product_uom_qty,price_unit,discount,price_subtotal \
//       --salida lineas.json
//
//     node _odoo.mjs leer stock.quant product_id,location_id,quantity \
//       --dominio '[["location_id.usage","=","internal"]]' --salida quant.json
//
//     node _odoo.mjs leer stock.warehouse.orderpoint \
//       product_id,product_min_qty,product_max_qty,warehouse_id --salida min.json
//
//     node _odoo.mjs leer account.payment \
//       date,name,amount,partner_id,reconciled_invoice_ids --salida pagos.json
//
//     node _odoo.mjs leer res.currency name,rate,rate_ids --salida monedas.json

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HOST = "https://3digitalgt-benserca.odoo.com";
const PERFIL = path.join(AQUI, ".odoo-perfil");

// Lista blanca. Todo lo que no este aca se rechaza sin tocar la red.
const METODOS_PERMITIDOS = new Set([
  "search_read",
  "search_count",
  "read",
  "read_group",
  "fields_get",
]);

function morir(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

// ── abrir ───────────────────────────────────────────────────────────────────
async function abrir(puerto) {
  mkdirSync(PERFIL, { recursive: true });
  console.log(`Abriendo Chromium con perfil propio en ${PERFIL}`);
  console.log(`Depuracion remota en el puerto ${puerto}.`);
  const ctx = await chromium.launchPersistentContext(PERFIL, {
    headless: false,
    args: [`--remote-debugging-port=${puerto}`, "--start-maximized"],
    viewport: null,
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(`${HOST}/web`, { waitUntil: "domcontentloaded" });
  console.log("\nINICIA SESION A MANO en la ventana que se abrio.");
  console.log("Dejala abierta. Despues, en otra terminal:");
  console.log("  node _odoo.mjs leer <modelo> <campos>\n");
  console.log("(Ctrl+C aca cierra el navegador y se pierde la sesion viva.)");
  await new Promise(() => {}); // queda vivo a proposito
}

// ── leer ────────────────────────────────────────────────────────────────────
async function leer({ modelo, campos, dominio, salida, puerto, limite }) {
  const metodo = "search_read";
  if (!METODOS_PERMITIDOS.has(metodo)) morir(`metodo no permitido: ${metodo}`);

  let navegador;
  try {
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${puerto}`);
  } catch (e) {
    morir(
      `no hay ningun navegador escuchando en el puerto ${puerto}.\n` +
        `       Levantalo con:  node _odoo.mjs abrir\n` +
        `       (detalle: ${e.message})`
    );
  }

  const ctx = navegador.contexts()[0];
  if (!ctx) morir("el navegador no tiene ningun contexto abierto.");

  let page = ctx.pages().find((p) => p.url().includes("3digitalgt-benserca"));
  if (!page) {
    page = await ctx.newPage();
    await page.goto(`${HOST}/web`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  }

  // Si la sesion caduco, Odoo devuelve el login y `odoo` no existe en la
  // pagina. Se detecta y se dice, en vez de fallar con un error opaco.
  const autenticado = await page.evaluate(
    () => typeof window.odoo !== "undefined" && !!document.querySelector(".o_web_client, .o_action_manager")
  );
  if (!autenticado) {
    morir(
      "la pagina de Odoo no esta autenticada (te devolvio el login).\n" +
        "       Inicia sesion a mano en esa ventana y volve a correr esto."
    );
  }

  console.log(`modelo:  ${modelo}`);
  console.log(`campos:  ${campos.join(", ")}`);
  console.log(`dominio: ${JSON.stringify(dominio)}`);
  console.log(`metodo:  ${metodo} (solo lectura)\n`);

  const resultado = await page.evaluate(
    async ({ modelo, metodo, campos, dominio, limite }) => {
      const csrf = window.odoo && window.odoo.csrf_token ? window.odoo.csrf_token : null;
      const llamar = async (args, kwargs) => {
        const resp = await fetch("/web/dataset/call_kw", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: { model: modelo, method: metodo, args, kwargs },
          }),
        });
        return resp.json();
      };

      const todas = [];
      let offset = 0;
      for (;;) {
        const r = await llamar([dominio, campos], { limit: limite, offset, order: "id asc" });
        if (r.error) return { error: r.error, parcial: todas.length };
        const pagina = r.result;
        todas.push(...pagina);
        if (pagina.length < limite) break;
        offset += limite;
      }
      return { filas: todas };
    },
    { modelo, metodo, campos, dominio, limite }
  );

  if (resultado.error) {
    console.error("Odoo devolvio un error:");
    console.error(JSON.stringify(resultado.error, null, 2).slice(0, 1500));
    console.error(`\nregistros obtenidos antes del error: ${resultado.parcial}`);
    await navegador.close();
    process.exit(1);
  }

  const filas = resultado.filas;
  console.log(`registros: ${filas.length}`);
  if (filas.length) {
    console.log(`campos devueltos: ${Object.keys(filas[0]).join(", ")}`);
    console.log(`muestra: ${JSON.stringify(filas[0])}`);
  }

  if (salida) {
    writeFileSync(salida, JSON.stringify(filas));
    console.log(`\nguardado en: ${salida}`);
  } else {
    console.log("\n(sin --salida: no se escribio ningun archivo)");
  }

  await navegador.close();
}

// ── argumentos ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const comando = argv[0];

function opcion(nombre, def) {
  const i = argv.indexOf(`--${nombre}`);
  return i === -1 ? def : argv[i + 1];
}

const puerto = Number(opcion("puerto", 9333));

if (comando === "abrir") {
  await abrir(puerto);
} else if (comando === "leer") {
  const modelo = argv[1];
  const camposCrudos = argv[2];
  if (!modelo || !camposCrudos) {
    morir("uso: node _odoo.mjs leer <modelo> <campos,separados,por,coma> [--dominio ...] [--salida ...]");
  }
  const campos = camposCrudos.split(",").map((c) => c.trim()).filter(Boolean);
  let dominio = [];
  const dom = opcion("dominio", null);
  if (dom) {
    try {
      dominio = JSON.parse(dom);
    } catch (e) {
      morir(`--dominio no es JSON valido: ${e.message}`);
    }
  }
  await leer({
    modelo,
    campos,
    dominio,
    salida: opcion("salida", null),
    puerto,
    limite: Number(opcion("limite", 2000)),
  });
} else {
  console.log(`
EXTRACTOR DE ODOO — SOLO LECTURA

  node _odoo.mjs abrir
      Abre Chromium con perfil propio (${path.relative(AQUI, PERFIL)}/) y depuracion
      remota en el puerto ${puerto}. Inicia sesion A MANO y deja la ventana abierta.

  node _odoo.mjs leer <modelo> <campos> [--dominio JSON] [--salida archivo] [--puerto n] [--limite n]
      Trae registros con search_read, paginando. Solo lectura: los unicos
      metodos permitidos son ${[...METODOS_PERMITIDOS].join(", ")}.

Ver la cabecera de este archivo para ejemplos que resuelven los pendientes
concretos del proyecto (discount, stock.quant, orderpoint, pago<->factura, moneda).
`);
}
