#!/usr/bin/env node
// Importa pedidos de venta exportados de Odoo (Ventas -> Presupuestos, sin
// filtro "Mis presupuestos", modelo sale.order) hacia Supabase (mismo
// proyecto REAL que _esquema-cxc-real.sql, jfvmuemyjcdesnoqeaix). Mismo
// patrón de _esquema-ventas-inventario.sql / importar-facturas-odoo.mjs:
// fecha ilegible se declara y nunca se inventa, fila sin dato clave se
// descarta con motivo, nada se asume en silencio.
//
// Uso:
//   node scripts/importar-ventas-odoo.mjs "C:\ruta\a\sale_order.xlsx"
//
// Columnas esperadas en la hoja 1 (exactamente como las exporta Odoo):
//   Referencia del pedido | Fecha de Creación | Cliente | Comercial |
//   Actividades | Total | Estado
//
// Notas de mapeo (deliberadas, no accidentales):
//   - "Comercial" (vendedor) se lee pero no tiene campo destino en Venta
//     (ver lib/types.ts) — igual que Serie FEL en facturas, se ignora.
//   - id_cliente usa la MISMA idClienteDesdeNombre() que
//     importar-facturas-odoo.mjs / importar-pagos-odoo.mjs, para que el
//     mismo nombre de cliente caiga en el mismo id sin importar de qué
//     pipeline salió. NO se inserta en la tabla `clientes` desde este
//     script (ver _esquema-ventas-inventario.sql: sin FK a propósito) —
//     eso es territorio del otro pipeline.
//   - "Total" mezcla monedas en pantalla ("$ 1,234.56" vs "1,234.56 Q"),
//     pero ese símbolo es solo formato visual de Excel — el valor crudo de
//     la celda es un número pelado, sin moneda. Probado: no se puede
//     recuperar la moneda desde este archivo tal cual está exportado.
//     moneda_id queda SIEMPRE null (ver detectarMoneda más abajo) — no se
//     inventa "todo GTQ" solo porque es la mayoría.
//   - Se descarta explícitamente el patrón de "fila fantasma" ya
//     encontrado en este archivo: una fila sin Referencia/Cliente/Total
//     pero con texto suelto en Actividades (residuo de una nota de Odoo,
//     no un pedido real).

import { basename } from "node:path";
import {
  leerXlsxHoja1,
  autoMapearEncabezados,
  normalizarMonto,
  interpretarColumnaFechas,
  idClienteDesdeNombre,
  subirEnLotes,
} from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY;

const PALABRAS_CLAVE = {
  numero_venta: ["referencia"],
  nombre_cliente: ["cliente"],
  fecha_venta: ["fecha"],
  monto_total_odoo: ["total"],
  estado_odoo: ["estado"],
};

function idVentaDesdeNumero(numero) {
  return `VTA-${String(numero).trim().toUpperCase()}`;
}

// Se probó detectar la moneda por el símbolo ("$" vs "Q") que se ve en
// pantalla en Odoo — no funciona: ese símbolo es formato visual de Excel
// (numFmt en styles.xml), no texto dentro del valor de la celda. El lector
// mínimo de XLSX de este proyecto (deliberadamente sin dependencias) solo
// lee el valor crudo <v>, no el estilo aplicado. Resultado real probado:
// 3211/3211 filas sin moneda detectable. Por eso moneda_id queda SIEMPRE
// null en este import — no se inventa "GTQ por defecto" solo porque es la
// mayoría. Para resolverlo de raíz hace falta reexportar agregando una
// columna de Moneda explícita en la vista de Odoo antes de exportar, o
// extender el lector para parsear estilos — ninguna de las dos se hizo acá.
function detectarMoneda() {
  return null;
}

function main() {
  const rutaArchivo = process.argv[2];
  if (!rutaArchivo) {
    console.error("Uso: node scripts/importar-ventas-odoo.mjs <ruta-al-xlsx-de-sale_order>");
    process.exit(1);
  }

  console.log(`Leyendo ${basename(rutaArchivo)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaArchivo);
  const mapeo = autoMapearEncabezados(encabezados, PALABRAS_CLAVE);

  const idx = (campo) => mapeo.indexOf(campo);
  const iNumero = idx("numero_venta");
  const iCliente = idx("nombre_cliente");
  const iFecha = idx("fecha_venta");
  const iTotal = idx("monto_total_odoo");
  const iEstado = idx("estado_odoo");

  console.log("Mapeo detectado:", encabezados.map((e, i) => `${e} -> ${mapeo[i]}`).join(" | "));

  if (iNumero === -1 || iCliente === -1 || iFecha === -1 || iTotal === -1) {
    console.error(
      "No se pudieron detectar todas las columnas requeridas (Referencia, Cliente, Fecha, Total). " +
        "Revisá los encabezados del archivo — no se asume ningún mapeo por defecto."
    );
    process.exit(1);
  }

  const fechas = interpretarColumnaFechas(filas.map((f) => f[iFecha] ?? ""));

  const ventas = [];
  const descartadas = [];
  const vistos = new Set();
  const estadosOdooVistos = new Map();
  let sinMonedaDetectada = 0;

  filas.forEach((fila, i) => {
    const numeroLinea = i + 2;
    const numero = String(fila[iNumero] ?? "").trim();
    const nombreCliente = String(fila[iCliente] ?? "").trim();
    const totalCrudo = fila[iTotal];
    const estadoOdoo = iEstado !== -1 ? String(fila[iEstado] ?? "").trim() : "";

    if (numero === "") {
      // Cubre exactamente la fila fantasma encontrada en la verificación
      // (sin Referencia/Cliente/Total, solo texto suelto en Actividades).
      descartadas.push({ numeroLinea, motivo: "sin referencia de pedido (probable residuo de actividad/nota de Odoo, no un pedido real)" });
      return;
    }
    if (nombreCliente === "") {
      descartadas.push({ numeroLinea, motivo: `pedido ${numero} sin cliente` });
      return;
    }

    const fecha = fechas[i];
    if (fecha === null) {
      descartadas.push({ numeroLinea, motivo: `pedido ${numero}: fecha ilegible o ambigua "${fila[iFecha]}" (no se inventa)` });
      return;
    }

    const monto = normalizarMonto(totalCrudo ?? "");
    if (monto === null) {
      descartadas.push({ numeroLinea, motivo: `pedido ${numero}: monto ilegible en "Total": "${totalCrudo}"` });
      return;
    }

    const idVenta = idVentaDesdeNumero(numero);
    if (vistos.has(idVenta)) {
      descartadas.push({ numeroLinea, motivo: `posible duplicado: pedido ${numero} ya cargado en este archivo` });
      return;
    }
    vistos.add(idVenta);

    const moneda = detectarMoneda(totalCrudo);
    if (moneda === null) sinMonedaDetectada++;

    if (estadoOdoo !== "") {
      estadosOdooVistos.set(estadoOdoo, (estadosOdooVistos.get(estadoOdoo) ?? 0) + 1);
    }

    ventas.push({
      id_venta: idVenta,
      id_cliente: idClienteDesdeNombre(nombreCliente),
      fecha_venta: fecha,
      total_odoo_referencia: monto,
      moneda_id: moneda,
      estado_odoo: estadoOdoo || null,
      origen: "odoo-sale-order",
    });
  });

  console.log("");
  console.log("=== Resumen de la transformación (nada subido todavía) ===");
  console.log(`Filas leídas: ${filas.length}`);
  console.log(`Ventas listas para subir: ${ventas.length}`);
  console.log(`Filas descartadas: ${descartadas.length}`);
  for (const d of descartadas) console.log(`  - línea ${d.numeroLinea}: ${d.motivo}`);
  console.log(`Ventas sin moneda detectable en "Total" (queda null, no se asume): ${sinMonedaDetectada}`);
  if (estadosOdooVistos.size > 0) {
    console.log('Valores de "Estado" vistos en Odoo (se guardan tal cual, sin mapear a un enum propio):');
    for (const [estado, n] of estadosOdooVistos) console.log(`  - "${estado}": ${n}`);
  }
  console.log("");
  console.log(
    "NO se cargó venta_lineas en esta corrida: este export de Odoo (Presupuestos, sale.order) " +
      "solo trae el encabezado del pedido, no el detalle por producto. sale.order.line no tiene " +
      "vista de lista propia en el menú de Odoo — hace falta otra vía (abrir cada pedido, o expandir " +
      "el pivot de Análisis de ventas por producto) para poblar esa tabla."
  );

  if (ventas.length === 0) {
    console.log("Nada para subir — no se hizo ninguna llamada a Supabase.");
    return;
  }

  console.log("");
  console.log(`Subiendo a ${SUPABASE_URL} ...`);
  return (async () => {
    const rVentas = await subirEnLotes("ventas", ventas, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
    });

    console.log("");
    console.log("=== Resumen final ===");
    console.log(
      `ventas: ${rVentas.insertados}/${rVentas.filasEnviadas} filas enviadas en ${rVentas.lotes} lote(s)` +
        (rVentas.errores.length ? ` — ${rVentas.errores.length} lote(s) con error` : "")
    );
    if (rVentas.errores.length) {
      console.log("Revisá los errores impresos arriba antes de reintentar.");
      process.exitCode = 1;
    }
  })();
}

main();
