#!/usr/bin/env node
/**
 * Reconstruye costo y margen por pedido a partir de un snapshot creado por
 * extraer-costos-historicos-odoo.mjs. No consulta ni modifica Odoo/Supabase.
 *
 * Ingreso: -account.move.line.balance, limitado a lineas contables publicadas
 * enlazadas con sale_line_ids. Asi queda neto de IVA, notas de credito y en
 * moneda de compania.
 *
 * Costo: -stock.valuation.layer.value, enlazado por stock_move_id y
 * stock.move.sale_line_id. Incluye salidas y devoluciones con su signo Odoo.
 * Solo se publica margen para lineas cuya cantidad facturada neta coincide
 * con la cantidad entregada neta.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TOLERANCIA = 1e-7;

function redondear(valor, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

function idRelacion(valor) {
  return Array.isArray(valor) ? Number(valor[0]) : null;
}

function nombreRelacion(valor) {
  return Array.isArray(valor) ? String(valor[1]) : null;
}

function numero(valor) {
  return Number(valor || 0);
}

function agrupar(filas, campo) {
  const mapa = new Map();
  for (const fila of filas) {
    const clave = campo(fila);
    const actual = mapa.get(clave) ?? [];
    actual.push(fila);
    mapa.set(clave, actual);
  }
  return mapa;
}

function sumar(filas, campo) {
  return filas.reduce((total, fila) => total + numero(campo(fila)), 0);
}

function porcentaje(parte, total) {
  return total === 0 ? null : redondear((parte / total) * 100, 4);
}

async function leerJson(directorio, nombre) {
  return JSON.parse(await readFile(path.join(directorio, `${nombre}.json`), "utf8"));
}

async function resolverDirectorio() {
  const argumento = process.argv.indexOf("--directorio");
  if (argumento >= 0) return path.resolve(process.argv[argumento + 1]);
  return (await readFile(path.resolve(process.cwd(), ".odoo-extracts", "ultima-corrida-costos.txt"), "utf8")).trim();
}

function estadoLinea({ tipoProducto, productoId, cantidadEntregada, cantidadFacturada, movimientosTerminados, capas }) {
  const sinActividad = Math.abs(cantidadEntregada) <= TOLERANCIA && Math.abs(cantidadFacturada) <= TOLERANCIA;
  if (sinActividad) return "sin-actividad";
  if (!productoId) return "sin-producto";
  if (tipoProducto === "service") return "servicio-sin-costo-inventario";
  if (movimientosTerminados.some((movimiento) => (capas.get(movimiento.id) ?? []).length === 0)) {
    return "movimiento-terminado-sin-valoracion";
  }
  if (Math.abs(cantidadEntregada - cantidadFacturada) <= TOLERANCIA) return "conciliada";
  if (cantidadEntregada > cantidadFacturada) return "entregada-no-facturada";
  if (cantidadFacturada > cantidadEntregada) return "facturada-no-entregada";
  return "cantidad-no-conciliada";
}

async function principal() {
  const directorio = await resolverDirectorio();
  const [
    manifiesto,
    ordenes,
    lineas,
    productos,
    categorias,
    movimientos,
    capasVenta,
    capasGlobales,
    apuntesIngreso,
    asientosIngreso,
    apuntesCosto,
    apuntesIngresoNoPublicados,
    asientosIngresoNoPublicados,
  ] = await Promise.all([
    leerJson(directorio, "manifest"),
    leerJson(directorio, "sale-order"),
    leerJson(directorio, "sale-order-line"),
    leerJson(directorio, "product-product"),
    leerJson(directorio, "product-category"),
    leerJson(directorio, "stock-move"),
    leerJson(directorio, "stock-valuation-layer"),
    leerJson(directorio, "stock-valuation-layer-global"),
    leerJson(directorio, "account-move-line-revenue"),
    leerJson(directorio, "account-move-revenue"),
    leerJson(directorio, "account-move-line-cogs"),
    leerJson(directorio, "account-move-line-revenue-unposted"),
    leerJson(directorio, "account-move-revenue-unposted"),
  ]);

  const productosPorId = new Map(productos.map((fila) => [fila.id, fila]));
  const categoriasPorId = new Map(categorias.map((fila) => [fila.id, fila]));
  const asientosPorId = new Map(asientosIngreso.map((fila) => [fila.id, fila]));
  const movimientosPorLinea = agrupar(movimientos, (fila) => idRelacion(fila.sale_line_id));
  const capasPorMovimiento = agrupar(capasVenta, (fila) => idRelacion(fila.stock_move_id));
  const apuntesPorLinea = new Map();

  let apuntesConMultiplesLineas = 0;
  for (const apunte of apuntesIngreso) {
    if ((apunte.sale_line_ids ?? []).length > 1) apuntesConMultiplesLineas++;
    for (const lineaId of apunte.sale_line_ids ?? []) {
      const actuales = apuntesPorLinea.get(lineaId) ?? [];
      actuales.push(apunte);
      apuntesPorLinea.set(lineaId, actuales);
    }
  }

  const detalleLineas = [];
  for (const linea of lineas) {
    const productoId = idRelacion(linea.product_id);
    const producto = productosPorId.get(productoId);
    const movimientosLinea = movimientosPorLinea.get(linea.id) ?? [];
    const movimientosTerminados = movimientosLinea.filter((fila) => fila.state === "done");
    const capasLinea = movimientosTerminados.flatMap((fila) => capasPorMovimiento.get(fila.id) ?? []);
    const apuntesLinea = apuntesPorLinea.get(linea.id) ?? [];

    const cantidadEntregada = -sumar(capasLinea, (fila) => fila.quantity);
    const costoValorado = -sumar(capasLinea, (fila) => fila.value);
    const ingresoNeto = -sumar(apuntesLinea, (fila) => fila.balance);
    const cantidadFacturada = apuntesLinea.reduce((total, apunte) => {
      const asiento = asientosPorId.get(idRelacion(apunte.move_id));
      const signo = asiento?.move_type === "out_refund" ? -1 : 1;
      return total + numero(apunte.quantity) * signo;
    }, 0);
    const tipoProducto = producto?.detailed_type ?? null;
    const estado = estadoLinea({
      tipoProducto,
      productoId,
      cantidadEntregada,
      cantidadFacturada,
      movimientosTerminados,
      capas: capasPorMovimiento,
    });
    const conciliada = estado === "conciliada";

    detalleLineas.push({
      id: linea.id,
      orderId: idRelacion(linea.order_id),
      productId: productoId,
      sku: producto?.default_code || null,
      tipoProducto,
      estado,
      cantidadPedida: numero(linea.product_uom_qty),
      cantidadEntregada: redondear(cantidadEntregada, 6),
      cantidadFacturada: redondear(cantidadFacturada, 6),
      cantidadFacturadaOdoo: redondear(numero(linea.qty_invoiced), 6),
      ingresoNetoEmpresa: redondear(ingresoNeto),
      costoValoradoHistorico: redondear(costoValorado),
      margenBruto: conciliada ? redondear(ingresoNeto - costoValorado) : null,
      margenPct: conciliada && ingresoNeto !== 0 ? redondear(((ingresoNeto - costoValorado) / ingresoNeto) * 100, 4) : null,
      movimientos: movimientosLinea.length,
      movimientosTerminados: movimientosTerminados.length,
      capas: capasLinea.length,
      tieneDevolucion: capasLinea.some((fila) => numero(fila.quantity) > 0),
      facturas: [...new Set(apuntesLinea.map((fila) => idRelacion(fila.move_id)).filter(Boolean))],
    });
  }

  const lineasPorOrden = agrupar(detalleLineas, (fila) => fila.orderId);
  const detalleOrdenes = ordenes.map((orden) => {
    const lineasOrden = lineasPorOrden.get(orden.id) ?? [];
    const activas = lineasOrden.filter((fila) => fila.estado !== "sin-actividad");
    const conciliadas = activas.filter((fila) => fila.estado === "conciliada");
    const ingresoNeto = sumar(lineasOrden, (fila) => fila.ingresoNetoEmpresa);
    const costoValorado = sumar(lineasOrden, (fila) => fila.costoValoradoHistorico);
    const ingresoConciliado = sumar(conciliadas, (fila) => fila.ingresoNetoEmpresa);
    const costoConciliado = sumar(conciliadas, (fila) => fila.costoValoradoHistorico);
    const completa = activas.length > 0 && activas.every((fila) => fila.estado === "conciliada");
    const estadosExcluidos = Object.fromEntries(
      [...agrupar(activas.filter((fila) => fila.estado !== "conciliada"), (fila) => fila.estado)]
        .map(([estado, filasEstado]) => [estado, filasEstado.length]),
    );
    return {
      id: orden.id,
      pedido: orden.name,
      clienteId: idRelacion(orden.partner_id),
      cliente: nombreRelacion(orden.partner_id),
      fecha: orden.date_order,
      monedaPedido: nombreRelacion(orden.currency_id),
      ventaPedidoSinIva: redondear(numero(orden.amount_untaxed)),
      ventaNetaFacturadaEmpresa: redondear(ingresoNeto),
      costoValoradoHistorico: redondear(costoValorado),
      margenBruto: completa ? redondear(ingresoNeto - costoValorado) : null,
      margenPct: completa && ingresoNeto !== 0 ? redondear(((ingresoNeto - costoValorado) / ingresoNeto) * 100, 4) : null,
      poblacionConciliada: {
        ingresoNeto: redondear(ingresoConciliado),
        costo: redondear(costoConciliado),
        margen: redondear(ingresoConciliado - costoConciliado),
      },
      estado: activas.length === 0 ? "sin-actividad-contable-o-fisica" : completa ? "conciliado" : "parcial",
      estadosExcluidos,
      lineas: lineasOrden.length,
      lineasActivas: activas.length,
      lineasConciliadas: conciliadas.length,
      tieneDevolucion: lineasOrden.some((fila) => fila.tieneDevolucion),
    };
  });

  const lineasConciliadas = detalleLineas.filter((fila) => fila.estado === "conciliada");
  const lineasActivas = detalleLineas.filter((fila) => fila.estado !== "sin-actividad");
  const ingresoTotal = sumar(detalleLineas, (fila) => fila.ingresoNetoEmpresa);
  const costoTotal = sumar(detalleLineas, (fila) => fila.costoValoradoHistorico);
  const ingresoConciliado = sumar(lineasConciliadas, (fila) => fila.ingresoNetoEmpresa);
  const costoConciliado = sumar(lineasConciliadas, (fila) => fila.costoValoradoHistorico);
  const cantidadEntregada = sumar(detalleLineas, (fila) => fila.cantidadEntregada);
  const cantidadFacturada = sumar(detalleLineas, (fila) => fila.cantidadFacturada);
  const capasConMovimiento = capasGlobales.filter((fila) => idRelacion(fila.stock_move_id));
  const capasSinMovimiento = capasGlobales.filter((fila) => !idRelacion(fila.stock_move_id));
  const movimientosTerminados = movimientos.filter((fila) => fila.state === "done");
  const movimientosTerminadosSinCapa = movimientosTerminados.filter((fila) => (capasPorMovimiento.get(fila.id) ?? []).length === 0);
  const idsMovimientosVenta = new Set(movimientos.map((fila) => fila.id));
  const capasGlobalesDeVenta = capasGlobales.filter((fila) => idsMovimientosVenta.has(idRelacion(fila.stock_move_id)));
  const configuracionesCategorias = categorias.map((categoria) => ({
    id: categoria.id,
    categoria: categoria.complete_name || categoria.name,
    metodoCosto: categoria.property_cost_method,
    valoracion: categoria.property_valuation,
  }));
  const estadosLinea = Object.fromEntries(
    [...agrupar(detalleLineas, (fila) => fila.estado)].map(([estado, filasEstado]) => [estado, filasEstado.length]),
  );
  const tiposAsiento = Object.fromEntries(
    [...agrupar(asientosIngreso, (fila) => fila.move_type)].map(([tipo, filasTipo]) => [tipo, filasTipo.length]),
  );
  const asientosNoPublicadosPorId = new Map(asientosIngresoNoPublicados.map((fila) => [fila.id, fila]));
  const cantidadNoPublicada = apuntesIngresoNoPublicados.reduce((total, apunte) => {
    const asiento = asientosNoPublicadosPorId.get(idRelacion(apunte.move_id));
    if (!asiento || asiento.state === "cancel") return total;
    return total + numero(apunte.quantity) * (asiento.move_type === "out_refund" ? -1 : 1);
  }, 0);
  const estadosNoPublicados = Object.fromEntries(
    [...agrupar(asientosIngresoNoPublicados, (fila) => fila.state)].map(([estado, filasEstado]) => [estado, filasEstado.length]),
  );

  const resumen = {
    schemaVersion: 1,
    estado: "parcial-conciliado",
    generadoEn: new Date().toISOString(),
    snapshot: {
      corrida: manifiesto.corrida,
      inicioUtc: manifiesto.inicioUtc,
      finUtc: manifiesto.finUtc,
      host: manifiesto.host,
      company: "Benserca 18 SA",
      monedaEmpresa: "GTQ",
      metodosOdoo: manifiesto.metodosPermitidos,
    },
    formula: {
      ingresoNetoEmpresa: "-Σ account.move.line.balance (posted, sale_line_ids; facturas y notas de credito)",
      costoValoradoHistorico: "-Σ stock.valuation.layer.value por stock_move_id -> sale_line_id",
      margenBruto: "ingreso neto empresa - costo valorado historico, solo donde cantidad facturada neta = cantidad entregada neta",
    },
    configuracionOdoo: {
      categorias: configuracionesCategorias,
      metodoCostoUnico: configuracionesCategorias.every((fila) => fila.metodoCosto === "standard") ? "standard" : "mixto",
      valoracionUnica: configuracionesCategorias.every((fila) => fila.valoracion === "manual_periodic") ? "manual_periodic" : "mixta",
      campoCostoEnCapas: "unit_cost/value historico de stock.valuation.layer",
      esCostoRealFifoOAvco: false,
    },
    cobertura: {
      pedidosSale: ordenes.length,
      pedidosConciliados: detalleOrdenes.filter((fila) => fila.estado === "conciliado").length,
      pedidosParciales: detalleOrdenes.filter((fila) => fila.estado === "parcial").length,
      pedidosSinActividad: detalleOrdenes.filter((fila) => fila.estado === "sin-actividad-contable-o-fisica").length,
      lineasVenta: lineas.length,
      lineasActivas: lineasActivas.length,
      lineasConciliadas: lineasConciliadas.length,
      estadosLinea,
      movimientos: movimientos.length,
      movimientosTerminados: movimientosTerminados.length,
      movimientosTerminadosSinCapa: movimientosTerminadosSinCapa.length,
      capasValoracionVenta: capasVenta.length,
      capasSalida: capasVenta.filter((fila) => numero(fila.quantity) < 0).length,
      capasDevolucion: capasVenta.filter((fila) => numero(fila.quantity) > 0).length,
      lineasConDevolucion: detalleLineas.filter((fila) => fila.tieneDevolucion).length,
      facturasPublicadas: tiposAsiento.out_invoice ?? 0,
      notasCreditoPublicadas: tiposAsiento.out_refund ?? 0,
      apuntesIngreso: apuntesIngreso.length,
      apuntesIngresoNoPublicados: apuntesIngresoNoPublicados.length,
      asientosIngresoNoPublicados: estadosNoPublicados,
    },
    poblacionConciliada: {
      ingresoNetoSinIvaGTQ: redondear(ingresoConciliado),
      costoHistoricoEstandarGTQ: redondear(costoConciliado),
      margenBrutoGTQ: redondear(ingresoConciliado - costoConciliado),
      margenPct: ingresoConciliado !== 0 ? redondear(((ingresoConciliado - costoConciliado) / ingresoConciliado) * 100, 4) : null,
      coberturaIngresoPct: porcentaje(ingresoConciliado, ingresoTotal),
      coberturaCostoPct: porcentaje(costoConciliado, costoTotal),
    },
    poblacionCompletaObservada: {
      ingresoNetoSinIvaGTQ: redondear(ingresoTotal),
      costoHistoricoEstandarGTQ: redondear(costoTotal),
      cantidadFacturadaNeta: redondear(cantidadFacturada, 6),
      cantidadEntregadaNeta: redondear(cantidadEntregada, 6),
    },
    reconciliacion: {
      cantidadEntregadaSaleOrderLine: redondear(sumar(lineas, (fila) => fila.qty_delivered), 6),
      cantidadEntregadaDesdeSVL: redondear(-sumar(capasVenta, (fila) => fila.quantity), 6),
      diferenciaCantidadEntrega: redondear(sumar(lineas, (fila) => fila.qty_delivered) + sumar(capasVenta, (fila) => fila.quantity), 6),
      valorCapasVenta: redondear(sumar(capasVenta, (fila) => fila.value)),
      costoReconstruido: redondear(costoTotal),
      diferenciaValor: redondear(sumar(capasVenta, (fila) => fila.value) + costoTotal),
      apuntesConMultiplesLineasVenta: apuntesConMultiplesLineas,
      diferenciaQtyInvoicedVsApuntes: redondear(sumar(lineas, (fila) => fila.qty_invoiced) - cantidadFacturada, 6),
      cantidadEnAsientosNoPublicadosNoCancelados: redondear(cantidadNoPublicada, 6),
      lineasQtyInvoicedNoReconstruibleDesdeSaleLineIds: detalleLineas.filter(
        (fila) => Math.abs(fila.cantidadFacturadaOdoo - fila.cantidadFacturada) > TOLERANCIA,
      ).length,
    },
    universoValoracion: {
      capasGlobales: capasGlobales.length,
      capasConMovimiento: capasConMovimiento.length,
      capasSinMovimiento: capasSinMovimiento.length,
      capasVenta: capasGlobalesDeVenta.length,
      capasNoVenta: capasGlobales.length - capasGlobalesDeVenta.length,
      ajustesManualesSinMovimientoValorGTQ: redondear(sumar(capasSinMovimiento, (fila) => fila.value)),
      valorNetoGlobalGTQ: redondear(sumar(capasGlobales, (fila) => fila.value)),
    },
    controlContableCosto: {
      disponible: apuntesCosto.length > 0,
      apuntes: apuntesCosto.length,
      razon: apuntesCosto.length === 0
        ? "Todas las capas de venta tienen account_move_id=false; las categorias usan valoracion manual_periodic y Odoo no genero asientos automaticos COGS enlazables."
        : null,
    },
    limitaciones: [
      "El costo es el costo estandar historico que Odoo grabo en cada capa, no FIFO/AVCO ni costo de compra identificado por lote.",
      "La valoracion de inventario es manual_periodic; no existe un asiento COGS automatico por capa para control contable independiente.",
      `${capasSinMovimiento.length} ajustes manuales de valor no tienen stock_move_id y no se asignan a pedidos sin inventar una regla.`,
      "El margen publicado corresponde solo a lineas con igualdad entre cantidad facturada neta y cantidad entregada neta.",
      "166 lineas tienen qty_invoiced historico que no se reconstruye solo con sale_line_ids; se excluyen si impiden conciliar cantidades.",
    ],
  };

  await mkdir(directorio, { recursive: true });
  await writeFile(path.join(directorio, "costo-historico-lineas.json"), `${JSON.stringify(detalleLineas, null, 2)}\n`, "utf8");
  await writeFile(path.join(directorio, "costo-historico-pedidos.json"), `${JSON.stringify(detalleOrdenes, null, 2)}\n`, "utf8");
  await writeFile(path.join(directorio, "costo-historico-resumen.json"), `${JSON.stringify(resumen, null, 2)}\n`, "utf8");
  await writeFile(
    path.resolve(process.cwd(), "fixtures", "costo-historico-odoo-resumen.json"),
    `${JSON.stringify(resumen, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify({ directorio, resumen }, null, 2));
}

principal().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
