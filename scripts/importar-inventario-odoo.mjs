#!/usr/bin/env node
// Importa Inventario real de Odoo hacia Supabase (mismo proyecto REAL que
// _esquema-cxc-real.sql, jfvmuemyjcdesnoqeaix). Dos archivos de entrada:
//
//   node scripts/importar-inventario-odoo.mjs <stock_quant.xlsx> <stock_move_line.xlsx>
//
// stock_quant.xlsx  -> catálogo `productos` (Inventario -> Informes ->
//                       Informe de inventario, modelo stock.quant).
// stock_move_line.xlsx -> `movimientos_inventario` (Inventario -> Informes
//                       -> Movimientos productos, modelo stock.move.line,
//                       exportado SIN el filtro de 12 meses que trae la
//                       pantalla por defecto).
//
// AVISO ESTRUCTURAL — el más importante de este archivo: ambos exports
// vienen AGRUPADOS por producto (Odoo mete el nombre del grupo en la
// primera columna y dejaengris el resto null, con un subtotal al final).
// Esas filas de encabezado de grupo NO son datos — se detectan y se
// saltan explícitamente, no se cuentan como productos ni movimientos.
//
// Clasificación entrada/salida/ajuste — derivada, no viene así de Odoo:
//   Ubicación EXTERNA -> INTERNA  = entrada (o ajuste si la externa es
//                                    "Virtual Locations/Inventory adjustment")
//   INTERNA -> EXTERNA            = salida (o ajuste si la externa es
//                                    "Virtual Locations/Inventory adjustment")
//   INTERNA -> INTERNA            = transferencia entre bodegas: se OMITE.
//                                    No cambia la existencia total de la
//                                    empresa y el modelo (MovimientoInventario)
//                                    no tiene campo de ubicación por línea.
// "Externa" = cualquier ubicación que empiece con "Partner Locations/" o
// "Virtual Locations/". Todo lo demás (NAC/Stock, C VEN/Stock, C MAS/Stock,
// C YAD/Stock, FISC/Stock, MUEST/Stock, ...) se trata como interna.
//
// id_venta queda SIEMPRE null en este import: la "Referencia" de
// stock.move.line (ej. "C VEN/INT/00019") no comparte esquema con la
// "Referencia del pedido" de sale.order (ej. "S00001") en este export —
// no hay forma confiable de enlazarlos con las columnas disponibles.
//
// costo_unitario / precio_unitario de `productos` quedan en 0: ninguno de
// los dos archivos trae precio de catálogo (Stock a mano no tiene precio;
// Valoración de stock trae costo REALIZADO por movimiento, que es otra
// cosa). Hace falta un export de Productos/Lista de precios aparte.

import { basename } from "node:path";
import { leerXlsxHoja1, subirEnLotes } from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY;

function slug(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function excelSerialAIso(crudo) {
  const dias = Math.round(Number(crudo));
  if (!Number.isFinite(dias) || dias <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const d = new Date(epoch + dias * 86400000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function partirSkuNombre(textoProducto) {
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(String(textoProducto ?? "").trim());
  if (!m) return null;
  return { sku: m[1].trim(), nombre: m[2].trim() };
}

function esExterna(ubicacion) {
  const u = String(ubicacion ?? "");
  return u.startsWith("Partner Locations/") || u.startsWith("Virtual Locations/");
}
function esAjusteVirtual(ubicacion) {
  return String(ubicacion ?? "").startsWith("Virtual Locations/");
}

function idProductoDesdeSku(sku) {
  return `PRD-${slug(sku)}`;
}

// leerXlsxHoja1 devuelve TODO como texto crudo de celda (ver su propio
// docstring: "la interpretación queda para el llamador") — nunca como
// number de JS, ni siquiera para columnas numéricas/fecha. Mismo patrón
// que pareceSoloNumero() en lib-importacion-odoo.mjs para distinguir una
// fila real (Fecha = serial de Excel en texto, ej. "46253.84...") de una
// fila de encabezado de grupo (columna Fecha = nombre de producto en texto).
function pareceSerialExcel(v) {
  return /^\d+(\.\d+)?$/.test(String(v ?? "").trim());
}

function importarProductos(rutaQuant) {
  console.log(`Leyendo ${basename(rutaQuant)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaQuant);
  console.log("Encabezados stock_quant:", encabezados.join(" | "));
  // Fila real = tiene Ubicación (columna 1) no vacía. Las de encabezado de
  // grupo/subgrupo dejan esa columna null.
  const iUbicacion = 1;
  const productosPorId = new Map();
  let filasGrupo = 0, filasSinSku = 0;

  filas.forEach((fila) => {
    const ubicacion = fila[iUbicacion];
    if (ubicacion === undefined || ubicacion === null || String(ubicacion).trim() === "") {
      filasGrupo++;
      return;
    }
    const partido = partirSkuNombre(fila[0]);
    if (!partido) { filasSinSku++; return; }
    const idProducto = idProductoDesdeSku(partido.sku);
    if (!productosPorId.has(idProducto)) {
      productosPorId.set(idProducto, {
        id_producto: idProducto,
        sku: partido.sku,
        nombre_producto: partido.nombre,
        costo_unitario: 0,
        precio_unitario: 0,
        stock_minimo: 0,
        origen: "odoo-stock-quant",
      });
    }
  });

  console.log(`Filas de encabezado de grupo/subgrupo saltadas: ${filasGrupo}`);
  if (filasSinSku > 0) console.log(`Filas con Ubicación pero sin SKU reconocible (formato "[SKU] nombre"): ${filasSinSku}`);
  console.log(`Productos únicos detectados: ${productosPorId.size}`);
  return [...productosPorId.values()];
}

function importarMovimientos(rutaMoveLine) {
  console.log(`Leyendo ${basename(rutaMoveLine)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaMoveLine);
  console.log("Encabezados stock_move_line:", encabezados.join(" | "));
  // [Fecha, Referencia, Producto, Desde, Hasta, Hecho, Estado]. Fila real =
  // columna 0 (Fecha) es numérica (serial de Excel). Las de encabezado de
  // grupo traen el nombre del producto ahí en texto.
  const movimientos = [];
  const descartadas = [];
  const clavesVistas = new Map(); // dedupe/estabilidad de id: referencia+sku -> contador
  let filasGrupo = 0, transferenciasOmitidas = 0;

  filas.forEach((fila, i) => {
    const numeroLinea = i + 2;
    const [fechaCruda, referencia, productoTexto, desde, hasta, hecho, estado] = fila;

    if (!pareceSerialExcel(fechaCruda)) { filasGrupo++; return; }

    if (estado !== "done") {
      descartadas.push({ numeroLinea, motivo: `estado "${estado}" no es "done" — no confirmado, no cuenta como movimiento real` });
      return;
    }

    const partido = partirSkuNombre(productoTexto);
    if (!partido) {
      descartadas.push({ numeroLinea, motivo: `producto sin SKU reconocible: "${productoTexto}"` });
      return;
    }

    const desdeInterna = !esExterna(desde);
    const hastaInterna = !esExterna(hasta);
    let tipo, signo;
    if (desdeInterna && hastaInterna) {
      transferenciasOmitidas++;
      return; // transferencia entre bodegas: no cambia existencia total, se omite
    } else if (!desdeInterna && hastaInterna) {
      tipo = esAjusteVirtual(desde) ? "ajuste" : "entrada";
      signo = 1;
    } else if (desdeInterna && !hastaInterna) {
      tipo = esAjusteVirtual(hasta) ? "ajuste" : "salida";
      signo = -1;
    } else {
      descartadas.push({ numeroLinea, motivo: `ambas ubicaciones externas ("${desde}" -> "${hasta}") — caso no esperado, se descarta` });
      return;
    }

    const cantidad = Number(hecho);
    if (!Number.isFinite(cantidad)) {
      descartadas.push({ numeroLinea, motivo: `cantidad ilegible en "Hecho": "${hecho}"` });
      return;
    }

    const fecha = excelSerialAIso(fechaCruda);
    if (fecha === null) {
      descartadas.push({ numeroLinea, motivo: `fecha ilegible: "${fechaCruda}"` });
      return;
    }

    const idProducto = idProductoDesdeSku(partido.sku);
    const claveBase = `${slug(referencia)}-${slug(partido.sku)}`;
    const n = (clavesVistas.get(claveBase) ?? 0) + 1;
    clavesVistas.set(claveBase, n);
    const idMovimiento = `MOV-${claveBase}${n > 1 ? `-${n}` : ""}`;

    movimientos.push({
      id_movimiento: idMovimiento,
      id_producto: idProducto,
      fecha,
      tipo,
      cantidad: signo * Math.abs(cantidad),
      id_venta: null,
      ubicacion_desde: desde ?? null,
      ubicacion_hasta: hasta ?? null,
      motivo: referencia ?? null,
      origen: "odoo-stock-move-line",
    });
  });

  console.log(`Filas de encabezado de grupo saltadas: ${filasGrupo}`);
  console.log(`Transferencias interno->interno omitidas (no cambian existencia total): ${transferenciasOmitidas}`);
  console.log(`Movimientos listos para subir: ${movimientos.length}`);
  console.log(`Filas descartadas: ${descartadas.length}`);
  for (const d of descartadas.slice(0, 30)) console.log(`  - línea ${d.numeroLinea}: ${d.motivo}`);
  if (descartadas.length > 30) console.log(`  ... y ${descartadas.length - 30} más`);
  return movimientos;
}

async function main() {
  const rutaQuant = process.argv[2];
  const rutaMoveLine = process.argv[3];
  if (!rutaQuant || !rutaMoveLine) {
    console.error("Uso: node scripts/importar-inventario-odoo.mjs <stock_quant.xlsx> <stock_move_line.xlsx>");
    process.exit(1);
  }

  const productos = importarProductos(rutaQuant);
  console.log("");
  const movimientos = importarMovimientos(rutaMoveLine);

  // Un movimiento puede referenciar un producto que stock_quant.xlsx no
  // trajo (ej. existencia llegó a 0 y ya no aparece en "Stock a mano").
  // Se completa el catálogo con esos SKU para que la FK de
  // movimientos_inventario no falle, marcados con origen distinto para
  // poder diferenciarlos.
  const productosPorId = new Map(productos.map((p) => [p.id_producto, p]));
  let productosInferidos = 0;
  for (const m of movimientos) {
    if (!productosPorId.has(m.id_producto)) {
      productosPorId.set(m.id_producto, {
        id_producto: m.id_producto,
        sku: m.id_producto.replace(/^PRD-/, ""),
        nombre_producto: "(sin nombre — no apareció en Stock a mano, solo en Movimientos)",
        costo_unitario: 0,
        precio_unitario: 0,
        stock_minimo: 0,
        origen: "odoo-stock-move-line-inferido",
      });
      productosInferidos++;
    }
  }
  const productosFinal = [...productosPorId.values()];

  console.log("");
  console.log("=== Resumen de la transformación (nada subido todavía) ===");
  console.log(`Productos de stock_quant: ${productos.length}`);
  console.log(`Productos inferidos solo desde movimientos (SKU sin nombre legible): ${productosInferidos}`);
  console.log(`Productos totales a subir: ${productosFinal.length}`);
  console.log(`Movimientos totales a subir: ${movimientos.length}`);

  console.log("");
  console.log(`Subiendo a ${SUPABASE_URL} ...`);
  const rProductos = await subirEnLotes("productos", productosFinal, {
    supabaseUrl: SUPABASE_URL,
    apiKey: SUPABASE_ANON_KEY,
  });
  const rMovimientos = await subirEnLotes("movimientos_inventario", movimientos, {
    supabaseUrl: SUPABASE_URL,
    apiKey: SUPABASE_ANON_KEY,
  });

  console.log("");
  console.log("=== Resumen final ===");
  console.log(
    `productos: ${rProductos.insertados}/${rProductos.filasEnviadas} filas enviadas en ${rProductos.lotes} lote(s)` +
      (rProductos.errores.length ? ` — ${rProductos.errores.length} lote(s) con error` : "")
  );
  console.log(
    `movimientos_inventario: ${rMovimientos.insertados}/${rMovimientos.filasEnviadas} filas enviadas en ${rMovimientos.lotes} lote(s)` +
      (rMovimientos.errores.length ? ` — ${rMovimientos.errores.length} lote(s) con error` : "")
  );
  if (rProductos.errores.length || rMovimientos.errores.length) {
    console.log("Revisá los errores impresos arriba antes de reintentar.");
    process.exitCode = 1;
  }
}

main();
