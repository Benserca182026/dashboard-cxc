#!/usr/bin/env node
/**
 * Extrae, sin escribir en Odoo, la evidencia necesaria para reconstruir el
 * costo historico por pedido:
 *
 * sale.order -> sale.order.line -> stock.move -> stock.valuation.layer
 *
 * El script usa la sesion ya autenticada de Chrome mediante CDP. Los unicos
 * metodos de Odoo habilitados son fields_get, search_count y search_read.
 * Los snapshots crudos quedan en .odoo-extracts/, ignorados por Git porque
 * contienen datos comerciales. El manifiesto registra campos, dominios,
 * conteos, corte y huellas SHA-256 para que la corrida sea reproducible.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const HOST = "https://3digitalgt-benserca.odoo.com";
const METODOS_PERMITIDOS = new Set(["fields_get", "search_count", "search_read"]);
const PUERTO = Number(argumento("puerto", "9444"));
const TAMANO_PAGINA = Number(argumento("pagina", "2000"));
const SOLO_CAMPOS = process.argv.includes("--solo-campos");

function argumento(nombre, predeterminado) {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice >= 0 ? process.argv[indice + 1] : predeterminado;
}

function marcaDeTiempo(fecha = new Date()) {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function jsonEstable(valor) {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

function sha256(texto) {
  return createHash("sha256").update(texto).digest("hex");
}

function trocear(valores, tamano) {
  const partes = [];
  for (let i = 0; i < valores.length; i += tamano) partes.push(valores.slice(i, i + tamano));
  return partes;
}

async function conectarCdp() {
  const respuesta = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
  if (!respuesta.ok) throw new Error(`Chrome CDP no responde en el puerto ${PUERTO} (HTTP ${respuesta.status}).`);
  const paginas = await respuesta.json();
  const pagina = paginas.find((x) => x.type === "page" && x.url?.startsWith(HOST));
  if (!pagina?.webSocketDebuggerUrl) {
    throw new Error(`No hay una pagina de ${HOST} en Chrome CDP puerto ${PUERTO}.`);
  }

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    ws.addEventListener("open", resolver, { once: true });
    ws.addEventListener("error", () => rechazar(new Error("No se pudo abrir el WebSocket CDP.")), { once: true });
  });

  let siguienteId = 1;
  const pendientes = new Map();
  ws.addEventListener("message", (evento) => {
    const mensaje = JSON.parse(String(evento.data));
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const { resolver, rechazar } = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    if (mensaje.error) rechazar(new Error(JSON.stringify(mensaje.error)));
    else resolver(mensaje.result);
  });

  const enviar = (method, params = {}) =>
    new Promise((resolver, rechazar) => {
      const id = siguienteId++;
      pendientes.set(id, { resolver, rechazar });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluar = async (expresion) => {
    const resultado = await enviar("Runtime.evaluate", {
      expression: expresion,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (resultado.exceptionDetails) {
      throw new Error(resultado.exceptionDetails.exception?.description || resultado.exceptionDetails.text);
    }
    return resultado.result?.value;
  };

  const estado = await evaluar(`(() => ({
    url: location.href,
    autenticado: typeof window.odoo !== "undefined" && !!document.querySelector(".o_web_client, .o_action_manager"),
    base: location.origin
  }))()`);
  if (!estado?.autenticado) {
    ws.close();
    throw new Error("La sesion de Odoo en Chrome existe, pero ya no esta autenticada.");
  }

  return { evaluar, cerrar: () => ws.close(), estado, pagina: { id: pagina.id, url: pagina.url, title: pagina.title } };
}

function expresionCallKw(modelo, metodo, args, kwargs) {
  if (!METODOS_PERMITIDOS.has(metodo)) throw new Error(`Metodo Odoo bloqueado: ${metodo}`);
  return `(async () => {
    const csrf = window.odoo?.csrf_token || null;
    const respuesta = await fetch("/web/dataset/call_kw", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: ${JSON.stringify({ model: modelo, method: metodo, args, kwargs })}
      })
    });
    const cuerpo = await respuesta.json();
    if (cuerpo.error) throw new Error(JSON.stringify(cuerpo.error));
    return cuerpo.result;
  })()`;
}

async function callKw(cdp, modelo, metodo, args = [], kwargs = {}) {
  return cdp.evaluar(expresionCallKw(modelo, metodo, args, kwargs));
}

const CANDIDATOS = {
  "sale.order": [
    "id", "name", "partner_id", "date_order", "state", "currency_id", "company_id",
    "amount_total", "amount_untaxed", "currency_rate",
  ],
  "sale.order.line": [
    "id", "order_id", "product_id", "product_uom_qty", "qty_delivered", "qty_invoiced",
    "price_unit", "discount", "price_subtotal", "state", "currency_id", "company_id",
  ],
  "product.product": [
    "id", "display_name", "default_code", "detailed_type", "type", "product_tmpl_id", "categ_id",
    "company_id",
  ],
  "product.category": [
    "id", "name", "complete_name", "property_cost_method", "property_valuation",
  ],
  "stock.move": [
    "id", "sale_line_id", "picking_id", "product_id", "product_uom", "state", "date",
    "create_date", "quantity", "quantity_done", "product_uom_qty", "product_qty", "origin",
    "reference", "move_orig_ids", "move_dest_ids", "company_id",
  ],
  "stock.valuation.layer": [
    "id", "stock_move_id", "product_id", "quantity", "unit_cost", "value", "remaining_qty",
    "remaining_value", "account_move_id", "create_date", "description", "company_id",
    "stock_valuation_layer_id", "stock_valuation_layer_ids", "stock_landed_cost_id",
  ],
  "account.move": [
    "id", "name", "state", "move_type", "invoice_date", "date", "currency_id", "company_id",
    "amount_untaxed", "amount_untaxed_signed", "amount_total", "amount_total_signed", "reversed_entry_id",
  ],
  "account.move.line": [
    "id", "move_id", "date", "account_id", "product_id", "debit", "credit", "balance",
    "currency_id", "amount_currency", "company_id", "stock_valuation_layer_ids", "sale_line_ids",
    "parent_state", "move_type", "quantity", "price_unit", "price_subtotal", "price_total", "display_type",
  ],
};

async function descubrirCampos(cdp) {
  const modelos = {};
  for (const [modelo, candidatos] of Object.entries(CANDIDATOS)) {
    const definiciones = await callKw(cdp, modelo, "fields_get", [], {
      attributes: ["string", "type", "relation", "store", "readonly", "required"],
    });
    const presentes = candidatos.filter((campo) => Object.hasOwn(definiciones, campo));
    modelos[modelo] = {
      campos: presentes,
      ausentes: candidatos.filter((campo) => !Object.hasOwn(definiciones, campo)),
      definiciones: Object.fromEntries(presentes.map((campo) => [campo, definiciones[campo]])),
    };
  }
  return modelos;
}

async function extraerPaginado(cdp, modelo, campos, dominio = []) {
  const total = await callKw(cdp, modelo, "search_count", [dominio], {});
  const filas = [];
  for (let offset = 0; offset < total; offset += TAMANO_PAGINA) {
    const pagina = await callKw(cdp, modelo, "search_read", [dominio, campos], {
      offset,
      limit: TAMANO_PAGINA,
      order: "id asc",
    });
    filas.push(...pagina);
  }
  return { total, filas };
}

async function escribirSnapshot(directorio, nombre, contenido) {
  const texto = jsonEstable(contenido);
  const archivo = path.join(directorio, `${nombre}.json`);
  await writeFile(archivo, texto, "utf8");
  return { archivo: path.relative(process.cwd(), archivo).replaceAll("\\", "/"), filas: contenido.length, sha256: sha256(texto) };
}

async function principal() {
  const inicio = new Date();
  const corrida = marcaDeTiempo(inicio);
  const directorio = path.resolve(process.cwd(), ".odoo-extracts", `costos-historicos-${corrida}`);
  await mkdir(directorio, { recursive: true });

  const cdp = await conectarCdp();
  try {
    const campos = await descubrirCampos(cdp);
    const manifiesto = {
      schemaVersion: 1,
      corrida,
      host: HOST,
      puertoCdp: PUERTO,
      inicioUtc: inicio.toISOString(),
      finUtc: null,
      soloLectura: true,
      metodosPermitidos: [...METODOS_PERMITIDOS],
      sesion: { ...cdp.estado, pagina: cdp.pagina },
      campos,
      extracciones: {},
    };

    await writeFile(path.join(directorio, "campos-verificados.json"), jsonEstable(campos), "utf8");
    if (SOLO_CAMPOS) {
      manifiesto.finUtc = new Date().toISOString();
      await writeFile(path.join(directorio, "manifest.json"), jsonEstable(manifiesto), "utf8");
      console.log(JSON.stringify({ directorio, modelos: campos }, null, 2));
      return;
    }

    const ordenes = await extraerPaginado(cdp, "sale.order", campos["sale.order"].campos, [["state", "=", "sale"]]);
    manifiesto.extracciones["sale.order"] = await escribirSnapshot(directorio, "sale-order", ordenes.filas);
    manifiesto.extracciones["sale.order"].dominio = [["state", "=", "sale"]];
    manifiesto.extracciones["sale.order"].searchCount = ordenes.total;

    const idsOrdenes = ordenes.filas.map((fila) => fila.id);
    const lineas = await extraerPaginado(cdp, "sale.order.line", campos["sale.order.line"].campos, [["order_id", "in", idsOrdenes]]);
    manifiesto.extracciones["sale.order.line"] = await escribirSnapshot(directorio, "sale-order-line", lineas.filas);
    manifiesto.extracciones["sale.order.line"].dominio = [["order_id", "in", `${idsOrdenes.length} ids sale.order`]];
    manifiesto.extracciones["sale.order.line"].searchCount = lineas.total;

    const idsLineas = lineas.filas.map((fila) => fila.id);
    const idsProductos = [...new Set(lineas.filas
      .map((fila) => Array.isArray(fila.product_id) ? fila.product_id[0] : null)
      .filter(Boolean))];
    const productos = await extraerPaginado(
      cdp,
      "product.product",
      campos["product.product"].campos,
      [["id", "in", idsProductos]],
    );
    manifiesto.extracciones["product.product"] = await escribirSnapshot(directorio, "product-product", productos.filas);
    manifiesto.extracciones["product.product"].dominio = [["id", "in", `${idsProductos.length} productos en lineas de venta`]];

    const idsCategorias = [...new Set(productos.filas
      .map((fila) => Array.isArray(fila.categ_id) ? fila.categ_id[0] : null)
      .filter(Boolean))];
    const categorias = await extraerPaginado(
      cdp,
      "product.category",
      campos["product.category"].campos,
      [["id", "in", idsCategorias]],
    );
    manifiesto.extracciones["product.category"] = await escribirSnapshot(directorio, "product-category", categorias.filas);
    manifiesto.extracciones["product.category"].dominio = [["id", "in", `${idsCategorias.length} categorias usadas`]];

    const movimientosPorId = new Map();
    for (const ids of trocear(idsLineas, 1000)) {
      const parte = await extraerPaginado(cdp, "stock.move", campos["stock.move"].campos, [["sale_line_id", "in", ids]]);
      for (const fila of parte.filas) movimientosPorId.set(fila.id, fila);
    }
    const movimientos = [...movimientosPorId.values()].sort((a, b) => a.id - b.id);
    manifiesto.extracciones["stock.move"] = await escribirSnapshot(directorio, "stock-move", movimientos);
    manifiesto.extracciones["stock.move"].dominio = [["sale_line_id", "in", `${idsLineas.length} ids sale.order.line`]];

    const idsMovimientos = movimientos.map((fila) => fila.id);
    const capasPorId = new Map();
    for (const ids of trocear(idsMovimientos, 1000)) {
      const parte = await extraerPaginado(cdp, "stock.valuation.layer", campos["stock.valuation.layer"].campos, [["stock_move_id", "in", ids]]);
      for (const fila of parte.filas) capasPorId.set(fila.id, fila);
    }

    // Las capas de revalorizacion/costos en destino pueden apuntar a otra capa.
    // Se preservan y se anexan iterativamente sin perder su fila original.
    if (campos["stock.valuation.layer"].campos.includes("stock_valuation_layer_id")) {
      let frontera = [...capasPorId.keys()];
      for (let profundidad = 0; profundidad < 5 && frontera.length; profundidad++) {
        const nuevas = [];
        for (const ids of trocear(frontera, 1000)) {
          const parte = await extraerPaginado(
            cdp,
            "stock.valuation.layer",
            campos["stock.valuation.layer"].campos,
            [["stock_valuation_layer_id", "in", ids]],
          );
          for (const fila of parte.filas) {
            if (!capasPorId.has(fila.id)) nuevas.push(fila.id);
            capasPorId.set(fila.id, fila);
          }
        }
        frontera = nuevas;
      }
    }
    const capas = [...capasPorId.values()].sort((a, b) => a.id - b.id);
    manifiesto.extracciones["stock.valuation.layer"] = await escribirSnapshot(directorio, "stock-valuation-layer", capas);
    manifiesto.extracciones["stock.valuation.layer"].dominio = [
      ["stock_move_id", "in", `${idsMovimientos.length} ids stock.move`],
      "mas capas hijas por stock_valuation_layer_id",
    ];

    // Poblacion global para demostrar que parte de la valoracion pertenece a
    // ventas y que parte corresponde a compras, ajustes u otros movimientos.
    // Esta copia tambien permite reconciliar remaining_value sin confundirlo
    // con costo historico de ventas.
    const capasGlobales = await extraerPaginado(
      cdp,
      "stock.valuation.layer",
      campos["stock.valuation.layer"].campos,
      [],
    );
    manifiesto.extracciones["stock.valuation.layer:global"] = await escribirSnapshot(
      directorio,
      "stock-valuation-layer-global",
      capasGlobales.filas,
    );
    manifiesto.extracciones["stock.valuation.layer:global"].dominio = [];
    manifiesto.extracciones["stock.valuation.layer:global"].searchCount = capasGlobales.total;

    // Control contable: solo lineas de los asientos enlazados por las capas.
    const idsAsientos = [...new Set(capas.map((fila) => Array.isArray(fila.account_move_id) ? fila.account_move_id[0] : null).filter(Boolean))];
    const apuntesCostoPorId = new Map();
    for (const ids of trocear(idsAsientos, 500)) {
      const parte = await extraerPaginado(cdp, "account.move.line", campos["account.move.line"].campos, [["move_id", "in", ids]]);
      for (const fila of parte.filas) apuntesCostoPorId.set(fila.id, fila);
    }
    const apuntesCosto = [...apuntesCostoPorId.values()].sort((a, b) => a.id - b.id);
    manifiesto.extracciones["account.move.line:cogs"] = await escribirSnapshot(directorio, "account-move-line-cogs", apuntesCosto);
    manifiesto.extracciones["account.move.line:cogs"].dominio = [["move_id", "in", `${idsAsientos.length} asientos desde SVL`]];

    // Ingreso neto sin IVA, incluidos reembolsos, en moneda de la compania.
    // balance es mas robusto que price_subtotal para pedidos en USD porque ya
    // incorpora la conversion contable historica de la factura.
    const apuntesIngresoPorId = new Map();
    for (const ids of trocear(idsLineas, 750)) {
      const parte = await extraerPaginado(
        cdp,
        "account.move.line",
        campos["account.move.line"].campos,
        [["sale_line_ids", "in", ids], ["parent_state", "=", "posted"]],
      );
      for (const fila of parte.filas) apuntesIngresoPorId.set(fila.id, fila);
    }
    const apuntesIngreso = [...apuntesIngresoPorId.values()].sort((a, b) => a.id - b.id);
    manifiesto.extracciones["account.move.line:revenue"] = await escribirSnapshot(
      directorio,
      "account-move-line-revenue",
      apuntesIngreso,
    );
    manifiesto.extracciones["account.move.line:revenue"].dominio = [
      ["sale_line_ids", "in", `${idsLineas.length} lineas de venta`],
      ["parent_state", "=", "posted"],
    ];

    const idsAsientosIngreso = [...new Set(apuntesIngreso
      .map((fila) => Array.isArray(fila.move_id) ? fila.move_id[0] : null)
      .filter(Boolean))];
    const asientosIngreso = await extraerPaginado(
      cdp,
      "account.move",
      campos["account.move"].campos,
      [["id", "in", idsAsientosIngreso]],
    );
    manifiesto.extracciones["account.move:revenue"] = await escribirSnapshot(
      directorio,
      "account-move-revenue",
      asientosIngreso.filas,
    );
    manifiesto.extracciones["account.move:revenue"].dominio = [["id", "in", `${idsAsientosIngreso.length} asientos de ingreso`]];

    const apuntesIngresoNoPublicadosPorId = new Map();
    for (const ids of trocear(idsLineas, 750)) {
      const parte = await extraerPaginado(
        cdp,
        "account.move.line",
        campos["account.move.line"].campos,
        [["sale_line_ids", "in", ids], ["parent_state", "!=", "posted"]],
      );
      for (const fila of parte.filas) apuntesIngresoNoPublicadosPorId.set(fila.id, fila);
    }
    const apuntesIngresoNoPublicados = [...apuntesIngresoNoPublicadosPorId.values()].sort((a, b) => a.id - b.id);
    manifiesto.extracciones["account.move.line:revenue-unposted"] = await escribirSnapshot(
      directorio,
      "account-move-line-revenue-unposted",
      apuntesIngresoNoPublicados,
    );
    manifiesto.extracciones["account.move.line:revenue-unposted"].dominio = [
      ["sale_line_ids", "in", `${idsLineas.length} lineas de venta`],
      ["parent_state", "!=", "posted"],
    ];
    const idsAsientosIngresoNoPublicados = [...new Set(apuntesIngresoNoPublicados
      .map((fila) => Array.isArray(fila.move_id) ? fila.move_id[0] : null)
      .filter(Boolean))];
    const asientosIngresoNoPublicados = await extraerPaginado(
      cdp,
      "account.move",
      campos["account.move"].campos,
      [["id", "in", idsAsientosIngresoNoPublicados]],
    );
    manifiesto.extracciones["account.move:revenue-unposted"] = await escribirSnapshot(
      directorio,
      "account-move-revenue-unposted",
      asientosIngresoNoPublicados.filas,
    );
    manifiesto.extracciones["account.move:revenue-unposted"].dominio = [["id", "in", `${idsAsientosIngresoNoPublicados.length} asientos no publicados`]];

    manifiesto.finUtc = new Date().toISOString();
    await writeFile(path.join(directorio, "manifest.json"), jsonEstable(manifiesto), "utf8");
    await writeFile(path.resolve(process.cwd(), ".odoo-extracts", "ultima-corrida-costos.txt"), `${directorio}\n`, "utf8");
    console.log(JSON.stringify({ directorio, extracciones: manifiesto.extracciones }, null, 2));
  } finally {
    cdp.cerrar();
  }
}

principal().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
