import { TIPO_CAMBIO_REFERENCIA } from "./tipo-cambio";
import type { Dataset, Moneda, MovimientoInventario, Producto, Venta } from "./types";

export interface FilaComercial {
  id: string;
  etiqueta: string;
  valor: number;
  pct: number;
  detalle?: string;
}

export interface PuntoTendencia {
  periodo: string;
  valor: number;
}

/** Total histórico por cliente en la moneda de registro. Mantiene la misma
 * regla que la analítica comercial: total cerrado por Odoo, no suma de líneas
 * a precio de lista. Esta salida permite construir vistas nuevas sin inventar
 * una clasificación que el dataset no trae. */
export interface AcumuladoClienteVenta {
  id: string;
  etiqueta: string;
  valor: number;
  pedidos: number;
  desde: string | null;
  hasta: string | null;
}

export interface AnaliticaVentas {
  disponible: boolean;
  pedidos: number;
  pedidosConReferencia: number;
  pedidosSinReferencia: number;
  vendidoOdoo: number;
  precioLista: number;
  costoCatalogo: number;
  brechaNoDesagregada: number;
  brechaPct: number | null;
  contribucionLista: number;
  tendencia: PuntoTendencia[];
  variacionUltimoPeriodo: number | null;
  periodoComparacionActual: string | null;
  periodoComparacionAnterior: string | null;
  diaCorteComparacion: number | null;
  ventaPeriodoActualComparable: number;
  ventaPeriodoAnteriorComparable: number;
  topClientes: FilaComercial[];
  topProductos: FilaComercial[];
  concentracionTop5: number | null;
  desde: string | null;
  hasta: string | null;
  vinculoFacturaDisponible: boolean;
  vendedorDisponible: false;
  monedaPedidoDisponible: boolean;
  pedidosPorMoneda: Record<Moneda, number>;
  ventaOriginalPorMoneda: Record<Moneda, number>;
}

export interface FilaInventarioComercial extends FilaComercial {
  unidadesEntrada: number;
  unidadesSalida: number;
  variacion: number;
  claseAbc?: "A" | "B" | "C";
}

export interface AnaliticaInventario {
  disponible: boolean;
  desde: string | null;
  hasta: string | null;
  productos: number;
  productosConCostoCero: number;
  productosConMovimiento: number;
  productosConSalidaValorizada: number;
  movimientos: number;
  movimientosSalida: number;
  existenciaAfirmable: boolean;
  minimoAfirmable: boolean;
  valorExistencia: number | null;
  productosBajoMinimo: number | null;
  valorSalidas: number;
  unidadesSalida: number;
  salidasSinVenta: number;
  movimientosSalidaSinCosto: number;
  unidadesSalidaSinCosto: number;
  seriesTruncadas: number;
  candidatosSinSalida: number;
  valorEntradasSinSalida: number;
  movimientosConUbicacion: number;
  ubicacionesObservadas: string[];
  distribucionAbc: Record<"A" | "B" | "C", number>;
  topSalidas: FilaInventarioComercial[];
  entradasSinSalida: FilaInventarioComercial[];
  topExistencia: FilaInventarioComercial[];
}

export interface PuntoForecastComercial {
  semana: number;
  optimista: number;
  base: number;
  pesimista: number;
}

export interface OportunidadReactivacion extends FilaComercial {
  ultimaVenta: string | null;
}

export interface AnaliticaForecast {
  puntos: PuntoForecastComercial[];
  saldoAbierto: number;
  saldoElegible: number;
  saldoSinVencimiento: number;
  facturasAbiertas: number;
  facturasElegibles: number;
  base13: number;
  optimista13: number;
  pesimista13: number;
  brechaHorizonte: number;
  brechaEscenarios: number;
  saldoDisputado: number;
  topContribuyentes: FilaComercial[];
  reactivacion: OportunidadReactivacion[];
  reactivacionTotal: number;
  reactivacionValorHistorico: number;
  metaDisponible: false;
  probabilidadValidada: false;
}

const DOS_DECIMALES = (n: number) => Number(n.toFixed(2));

function topFilas(
  valores: Iterable<[string, { etiqueta: string; valor: number; detalle?: string }]>,
  total: number,
  limite = 10
): FilaComercial[] {
  return [...valores]
    .filter(([, fila]) => fila.valor > 0)
    .sort((a, b) => b[1].valor - a[1].valor || a[0].localeCompare(b[0]))
    .slice(0, limite)
    .map(([id, fila]) => ({
      id,
      etiqueta: fila.etiqueta,
      valor: DOS_DECIMALES(fila.valor),
      pct: total > 0 ? (fila.valor / total) * 100 : 0,
      detalle: fila.detalle,
    }));
}

function ventaNoCancelada(venta: Venta): boolean {
  const estado = venta.estado_odoo?.trim().toLocaleLowerCase("es") ?? "";
  return !estado.includes("cancel") && estado !== "anulada" && estado !== "cancelled";
}

function valorReferencia(venta: Venta): number | null {
  return venta.total_referencia?.valorParaMostrar() ?? null;
}

function monedaDeVenta(venta: Venta, dataset: Dataset): Moneda | null {
  if (venta.moneda_id === "GTQ" || venta.moneda_id === "USD") return venta.moneda_id;
  return dataset.fuente === "demo-ficticio" ? "USD" : null;
}

/** Normaliza a la moneda de registro sólo para construir una vista comparable. */
function equivalenteEnMonedaRegistro(valor: number, moneda: Moneda | null, dataset: Dataset): number {
  if (moneda === null) return valor;
  const monedaRegistro: Moneda = dataset.fuente === "odoo-real" ? "GTQ" : "USD";
  if (moneda === monedaRegistro) return valor;
  return monedaRegistro === "GTQ"
    ? valor * TIPO_CAMBIO_REFERENCIA.quetzalesPorDolar
    : valor / TIPO_CAMBIO_REFERENCIA.quetzalesPorDolar;
}

export function acumuladosVentasPorCliente(dataset: Dataset): AcumuladoClienteVenta[] {
  const nombres = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const acumulados = new Map<string, AcumuladoClienteVenta>();

  for (const venta of (dataset.ventas ?? []).filter(ventaNoCancelada)) {
    const referencia = valorReferencia(venta);
    if (referencia === null) continue;
    const actual = acumulados.get(venta.id_cliente) ?? {
      id: venta.id_cliente,
      etiqueta: nombres.get(venta.id_cliente) ?? venta.id_cliente,
      valor: 0,
      pedidos: 0,
      desde: null,
      hasta: null,
    };
    actual.valor += equivalenteEnMonedaRegistro(referencia, monedaDeVenta(venta, dataset), dataset);
    actual.pedidos += 1;
    if (!actual.desde || venta.fecha_venta < actual.desde) actual.desde = venta.fecha_venta;
    if (!actual.hasta || venta.fecha_venta > actual.hasta) actual.hasta = venta.fecha_venta;
    acumulados.set(venta.id_cliente, actual);
  }

  return [...acumulados.values()]
    .map((fila) => ({ ...fila, valor: DOS_DECIMALES(fila.valor) }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta));
}

const cacheVentas = new WeakMap<Dataset, AnaliticaVentas>();

/**
 * Índices de una pasada para ventas. No usa ventasConTotal(): esa función hace
 * búsquedas lineales de productos/líneas/facturas por cada pedido.
 */
export function analiticaVentas(dataset: Dataset): AnaliticaVentas {
  const previa = cacheVentas.get(dataset);
  if (previa) return previa;

  const clientes = new Map(dataset.clientes.map((c) => [c.id_cliente, c.nombre_cliente]));
  const productos = new Map((dataset.productos ?? []).map((p) => [p.id_producto, p]));
  const ventasValidas = (dataset.ventas ?? []).filter(ventaNoCancelada);
  const ventasPorId = new Map(ventasValidas.map((v) => [v.id_venta, v]));
  const monedaPedidoDisponible = ventasValidas.every((v) => monedaDeVenta(v, dataset) !== null);
  const pedidosPorMoneda: Record<Moneda, number> = { GTQ: 0, USD: 0 };
  const ventaOriginalPorMoneda: Record<Moneda, number> = { GTQ: 0, USD: 0 };
  const totalesListaPorVenta = new Map<string, number>();
  const porProducto = new Map<string, { etiqueta: string; valor: number; unidades: number }>();
  let precioLista = 0;
  let costoCatalogo = 0;

  for (const linea of dataset.ventaLineas ?? []) {
    const venta = ventasPorId.get(linea.id_venta);
    if (!venta) continue;
    const producto = productos.get(linea.id_producto);
    const importeOriginal = linea.cantidad * linea.precio_unitario;
    const importe = equivalenteEnMonedaRegistro(
      importeOriginal,
      monedaDeVenta(venta, dataset),
      dataset
    );
    const costo = linea.cantidad * (producto?.costo_unitario ?? 0);
    precioLista += importe;
    costoCatalogo += costo;
    totalesListaPorVenta.set(linea.id_venta, (totalesListaPorVenta.get(linea.id_venta) ?? 0) + importe);
    const actual = porProducto.get(linea.id_producto) ?? {
      etiqueta: producto ? `${producto.sku} · ${producto.nombre_producto}` : linea.id_producto,
      valor: 0,
      unidades: 0,
    };
    actual.valor += importe;
    actual.unidades += linea.cantidad;
    porProducto.set(linea.id_producto, actual);
  }

  const porCliente = new Map<string, { etiqueta: string; valor: number }>();
  const porMes = new Map<string, number>();
  const referenciasConFecha: { fecha: string; valor: number }[] = [];
  const fechas: string[] = [];
  let vendidoOdoo = 0;
  let pedidosConReferencia = 0;

  for (const venta of ventasValidas) {
    fechas.push(venta.fecha_venta);
    const referencia = valorReferencia(venta);
    if (referencia === null) continue;
    const moneda = monedaDeVenta(venta, dataset);
    if (moneda) {
      pedidosPorMoneda[moneda] += 1;
      ventaOriginalPorMoneda[moneda] += referencia;
    }
    const referenciaEquivalente = equivalenteEnMonedaRegistro(referencia, moneda, dataset);
    pedidosConReferencia++;
    vendidoOdoo += referenciaEquivalente;
    const nombre = clientes.get(venta.id_cliente) ?? venta.id_cliente;
    const actual = porCliente.get(venta.id_cliente) ?? { etiqueta: nombre, valor: 0 };
    actual.valor += referenciaEquivalente;
    porCliente.set(venta.id_cliente, actual);
    const mes = venta.fecha_venta.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + referenciaEquivalente);
    referenciasConFecha.push({ fecha: venta.fecha_venta, valor: referenciaEquivalente });
  }

  const tendencia = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, valor]) => ({ periodo, valor: DOS_DECIMALES(valor) }));
  const ultimoMes = tendencia.at(-1);
  const periodoComparacionActual = ultimoMes?.periodo ?? null;
  const fechaHasta = fechas.length > 0 ? [...fechas].sort().at(-1) ?? null : null;
  const diaCorteComparacion = fechaHasta ? Number(fechaHasta.slice(8, 10)) : null;
  const periodoComparacionAnterior = periodoComparacionActual
    ? (() => {
        const [anio, mes] = periodoComparacionActual.split("-").map(Number);
        const anterior = new Date(Date.UTC(anio, mes - 2, 1));
        return `${anterior.getUTCFullYear()}-${String(anterior.getUTCMonth() + 1).padStart(2, "0")}`;
      })()
    : null;
  let ventaPeriodoActualComparable = 0;
  let ventaPeriodoAnteriorComparable = 0;
  if (periodoComparacionActual && periodoComparacionAnterior && diaCorteComparacion) {
    for (const referencia of referenciasConFecha) {
      const periodo = referencia.fecha.slice(0, 7);
      const dia = Number(referencia.fecha.slice(8, 10));
      if (dia > diaCorteComparacion) continue;
      if (periodo === periodoComparacionActual) ventaPeriodoActualComparable += referencia.valor;
      if (periodo === periodoComparacionAnterior) ventaPeriodoAnteriorComparable += referencia.valor;
    }
  }
  const variacionUltimoPeriodo =
    ventaPeriodoAnteriorComparable !== 0
      ? ((ventaPeriodoActualComparable - ventaPeriodoAnteriorComparable) / ventaPeriodoAnteriorComparable) * 100
      : null;
  const topClientes = topFilas(porCliente.entries(), vendidoOdoo);
  const topProductos = topFilas(
    [...porProducto.entries()].map(([id, p]) => [
      id,
      { etiqueta: p.etiqueta, valor: p.valor, detalle: `${Math.round(p.unidades).toLocaleString("es-GT")} unidades` },
    ]),
    precioLista
  );
  const top5 = topClientes.slice(0, 5).reduce((s, f) => s + f.valor, 0);
  fechas.sort();

  const resultado: AnaliticaVentas = {
    disponible: ventasValidas.length > 0 && (dataset.ventaLineas?.length ?? 0) > 0,
    pedidos: ventasValidas.length,
    pedidosConReferencia,
    pedidosSinReferencia: ventasValidas.length - pedidosConReferencia,
    vendidoOdoo: DOS_DECIMALES(vendidoOdoo),
    precioLista: DOS_DECIMALES(precioLista),
    costoCatalogo: DOS_DECIMALES(costoCatalogo),
    brechaNoDesagregada: DOS_DECIMALES(vendidoOdoo - precioLista),
    brechaPct: precioLista > 0 ? ((vendidoOdoo - precioLista) / precioLista) * 100 : null,
    contribucionLista: DOS_DECIMALES(precioLista - costoCatalogo),
    tendencia,
    variacionUltimoPeriodo,
    periodoComparacionActual,
    periodoComparacionAnterior,
    diaCorteComparacion,
    ventaPeriodoActualComparable: DOS_DECIMALES(ventaPeriodoActualComparable),
    ventaPeriodoAnteriorComparable: DOS_DECIMALES(ventaPeriodoAnteriorComparable),
    topClientes,
    topProductos,
    concentracionTop5: vendidoOdoo > 0 ? (top5 / vendidoOdoo) * 100 : null,
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
    vinculoFacturaDisponible: dataset.facturas.some((f) => Boolean(f.id_venta)),
    vendedorDisponible: false,
    monedaPedidoDisponible,
    pedidosPorMoneda,
    ventaOriginalPorMoneda: {
      GTQ: DOS_DECIMALES(ventaOriginalPorMoneda.GTQ),
      USD: DOS_DECIMALES(ventaOriginalPorMoneda.USD),
    },
  };
  cacheVentas.set(dataset, resultado);
  return resultado;
}

interface AcumuladoInventario {
  producto: Producto;
  entradas: number;
  salidas: number;
  valorEntradas: number;
  valorSalidas: number;
  variacion: number;
  primerMovimiento: MovimientoInventario | null;
}

const cacheInventario = new WeakMap<Dataset, AnaliticaInventario>();

export function analiticaInventario(dataset: Dataset): AnaliticaInventario {
  const previa = cacheInventario.get(dataset);
  if (previa) return previa;

  const productos = dataset.productos ?? [];
  const porId = new Map<string, AcumuladoInventario>(
    productos.map((p) => [
      p.id_producto,
      { producto: p, entradas: 0, salidas: 0, valorEntradas: 0, valorSalidas: 0, variacion: 0, primerMovimiento: null },
    ])
  );
  const fechas: string[] = [];
  let salidasSinVenta = 0;
  let movimientosSalida = 0;
  let movimientosSalidaSinCosto = 0;
  let unidadesSalidaSinCosto = 0;
  let movimientosConUbicacion = 0;
  const ubicacionesObservadas = new Set<string>();

  const movimientos = [...(dataset.movimientosInventario ?? [])].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id_movimiento.localeCompare(b.id_movimiento)
  );
  for (const movimiento of movimientos) {
    fechas.push(movimiento.fecha);
    const ubicaciones = [movimiento.ubicacion_desde, movimiento.ubicacion_hasta]
      .filter((ubicacion): ubicacion is string => Boolean(ubicacion?.trim()));
    if (ubicaciones.length > 0) movimientosConUbicacion++;
    for (const ubicacion of ubicaciones) ubicacionesObservadas.add(ubicacion);
    const acumulado = porId.get(movimiento.id_producto);
    if (!acumulado) continue;
    if (!acumulado.primerMovimiento) acumulado.primerMovimiento = movimiento;
    acumulado.variacion += movimiento.cantidad;
    if (movimiento.tipo === "entrada") {
      const unidades = Math.abs(movimiento.cantidad);
      acumulado.entradas += unidades;
      acumulado.valorEntradas += unidades * acumulado.producto.costo_unitario;
    } else if (movimiento.tipo === "salida") {
      movimientosSalida++;
      const unidades = Math.abs(movimiento.cantidad);
      acumulado.salidas += unidades;
      acumulado.valorSalidas += unidades * acumulado.producto.costo_unitario;
      if (!movimiento.id_venta) salidasSinVenta++;
      if (acumulado.producto.costo_unitario <= 0) {
        movimientosSalidaSinCosto++;
        unidadesSalidaSinCosto += unidades;
      }
    }
  }

  const conMovimiento = [...porId.values()].filter((x) => x.primerMovimiento);
  const seriesTruncadas = conMovimiento.filter((x) => x.primerMovimiento?.tipo === "salida").length;
  const existenciaAfirmable = conMovimiento.length > 0 && seriesTruncadas === 0;
  const minimoAfirmable = productos.some((p) => p.stock_minimo > 0);
  const valorSalidas = conMovimiento.reduce((s, x) => s + x.valorSalidas, 0);
  const unidadesSalida = conMovimiento.reduce((s, x) => s + x.salidas, 0);

  const salidaOrdenada = conMovimiento
    .filter((x) => x.valorSalidas > 0)
    .sort((a, b) => b.valorSalidas - a.valorSalidas || a.producto.sku.localeCompare(b.producto.sku));
  let acumuladoAbc = 0;
  const salidasClasificadas: FilaInventarioComercial[] = salidaOrdenada.map((x) => {
    acumuladoAbc += x.valorSalidas;
    const pctAcumulado = valorSalidas > 0 ? (acumuladoAbc / valorSalidas) * 100 : 100;
    const claseAbc: "A" | "B" | "C" = pctAcumulado <= 80 ? "A" : pctAcumulado <= 95 ? "B" : "C";
    return {
      id: x.producto.id_producto,
      etiqueta: `${x.producto.sku} · ${x.producto.nombre_producto}`,
      valor: DOS_DECIMALES(x.valorSalidas),
      pct: valorSalidas > 0 ? (x.valorSalidas / valorSalidas) * 100 : 0,
      detalle: `${Math.round(x.salidas).toLocaleString("es-GT")} unidades de salida`,
      unidadesEntrada: x.entradas,
      unidadesSalida: x.salidas,
      variacion: x.variacion,
      claseAbc,
    };
  });
  const distribucionAbc = salidasClasificadas.reduce<Record<"A" | "B" | "C", number>>(
    (conteo, fila) => {
      conteo[fila.claseAbc ?? "C"]++;
      return conteo;
    },
    { A: 0, B: 0, C: 0 }
  );
  const topSalidas = salidasClasificadas.slice(0, 10);

  const candidatosSinSalida = conMovimiento
    .filter((x) => x.entradas > 0 && x.salidas === 0)
    .sort((a, b) => b.valorEntradas - a.valorEntradas || a.producto.sku.localeCompare(b.producto.sku));
  const valorEntradasSinSalida = candidatosSinSalida.reduce((s, x) => s + x.valorEntradas, 0);
  const entradasSinSalida: FilaInventarioComercial[] = candidatosSinSalida
    .map((x) => ({
      id: x.producto.id_producto,
      etiqueta: `${x.producto.sku} · ${x.producto.nombre_producto}`,
      valor: DOS_DECIMALES(x.valorEntradas),
      pct: valorEntradasSinSalida > 0 ? (x.valorEntradas / valorEntradasSinSalida) * 100 : 0,
      detalle: `${Math.round(x.entradas).toLocaleString("es-GT")} unidades ingresadas sin salida en la ventana`,
      unidadesEntrada: x.entradas,
      unidadesSalida: x.salidas,
      variacion: x.variacion,
    }));

  const topExistencia: FilaInventarioComercial[] = existenciaAfirmable
    ? conMovimiento
        .filter((x) => x.variacion > 0)
        .sort((a, b) => b.variacion * b.producto.costo_unitario - a.variacion * a.producto.costo_unitario)
        .slice(0, 10)
        .map((x) => ({
          id: x.producto.id_producto,
          etiqueta: `${x.producto.sku} · ${x.producto.nombre_producto}`,
          valor: DOS_DECIMALES(x.variacion * x.producto.costo_unitario),
          pct: 0,
          detalle: `${Math.round(x.variacion).toLocaleString("es-GT")} unidades`,
          unidadesEntrada: x.entradas,
          unidadesSalida: x.salidas,
          variacion: x.variacion,
        }))
    : [];
  const valorExistencia = existenciaAfirmable
    ? DOS_DECIMALES(conMovimiento.reduce((s, x) => s + x.variacion * x.producto.costo_unitario, 0))
    : null;
  for (const fila of topExistencia) fila.pct = valorExistencia && valorExistencia > 0 ? (fila.valor / valorExistencia) * 100 : 0;
  const productosBajoMinimo = existenciaAfirmable && minimoAfirmable
    ? conMovimiento.filter((x) => x.variacion <= x.producto.stock_minimo).length
    : null;

  const resultado: AnaliticaInventario = {
    disponible: productos.length > 0 && movimientos.length > 0,
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
    productos: productos.length,
    productosConCostoCero: productos.filter((producto) => producto.costo_unitario <= 0).length,
    productosConMovimiento: conMovimiento.length,
    productosConSalidaValorizada: salidaOrdenada.length,
    movimientos: movimientos.length,
    movimientosSalida,
    existenciaAfirmable,
    minimoAfirmable,
    valorExistencia,
    productosBajoMinimo,
    valorSalidas: DOS_DECIMALES(valorSalidas),
    unidadesSalida,
    salidasSinVenta,
    movimientosSalidaSinCosto,
    unidadesSalidaSinCosto,
    seriesTruncadas,
    candidatosSinSalida: candidatosSinSalida.length,
    valorEntradasSinSalida: DOS_DECIMALES(valorEntradasSinSalida),
    movimientosConUbicacion,
    ubicacionesObservadas: [...ubicacionesObservadas].sort((a, b) => a.localeCompare(b)),
    distribucionAbc,
    topSalidas,
    entradasSinSalida,
    topExistencia,
  };
  cacheInventario.set(dataset, resultado);
  return resultado;
}

const cacheForecast = new WeakMap<Dataset, Map<string, AnaliticaForecast>>();

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86_400_000) : 0;
}

export function analiticaForecast(dataset: Dataset, fechaCorte: string): AnaliticaForecast {
  const porFecha = cacheForecast.get(dataset) ?? new Map<string, AnaliticaForecast>();
  const previa = porFecha.get(fechaCorte);
  if (previa) return previa;

  const pagosPorFactura = new Map<string, number>();
  for (const pago of dataset.pagos) {
    if (!pago.id_factura || pago.estado_aplicacion === "no_aplicado") continue;
    pagosPorFactura.set(pago.id_factura, (pagosPorFactura.get(pago.id_factura) ?? 0) + pago.monto_pago);
  }
  const notasPorFactura = new Map<string, number>();
  for (const nota of dataset.notasCredito) {
    if (!nota.id_factura || nota.estado_nota_credito !== "aplicada") continue;
    notasPorFactura.set(nota.id_factura, (notasPorFactura.get(nota.id_factura) ?? 0) + nota.monto_nota_credito);
  }
  const disputadas = new Set(
    dataset.disputas
      .filter((d) => d.estado_disputa === "abierta" || d.estado_disputa === "en_revision")
      .map((d) => d.id_factura)
  );
  const clientes = new Map(dataset.clientes.map((c) => [c.id_cliente, c]));
  const acumulados = Array.from({ length: 13 }, (_, i) => ({ semana: i + 1, optimista: 0, base: 0, pesimista: 0 }));
  const porCliente = new Map<string, { etiqueta: string; valor: number }>();
  let saldoAbierto = 0;
  let saldoElegible = 0;
  let saldoSinVencimiento = 0;
  let saldoDisputado = 0;
  let facturasAbiertas = 0;
  let facturasElegibles = 0;

  for (const factura of dataset.facturas) {
    if (factura.estado_factura === "anulada") continue;
    const saldo = Math.max(
      0,
      factura.monto_original - (pagosPorFactura.get(factura.id_factura) ?? 0) - (notasPorFactura.get(factura.id_factura) ?? 0)
    );
    if (saldo <= 0) continue;
    facturasAbiertas++;
    saldoAbierto += saldo;
    // La tabla de disputas es la fuente operativa: una marca base "disputada"
    // no mantiene bloqueada una factura cuya disputa ya fue resuelta.
    const enDisputa = disputadas.has(factura.id_factura);
    if (enDisputa) saldoDisputado += saldo;
    if (!factura.fecha_vencimiento) {
      saldoSinVencimiento += saldo;
      continue;
    }
    facturasElegibles++;
    saldoElegible += saldo;
    const diasAlVencimiento = diasEntre(fechaCorte, factura.fecha_vencimiento);
    const diasDesdeCorte = (desplazamiento: number) => (diasAlVencimiento <= 0 ? desplazamiento : diasAlVencimiento + desplazamiento);
    const diasOpt = diasDesdeCorte(10);
    const diasBase = diasDesdeCorte(30);
    const diasPes = diasDesdeCorte(60);
    for (const punto of acumulados) {
      const limite = punto.semana * 7;
      if (diasOpt <= limite) punto.optimista += saldo;
      if (diasBase <= limite) punto.base += saldo;
      if (!enDisputa && diasPes <= limite) punto.pesimista += saldo;
    }
    if (diasBase <= 91) {
      const cliente = clientes.get(factura.id_cliente);
      const actual = porCliente.get(factura.id_cliente) ?? {
        etiqueta: cliente?.nombre_cliente ?? factura.id_cliente,
        valor: 0,
      };
      actual.valor += saldo;
      porCliente.set(factura.id_cliente, actual);
    }
  }

  const puntos = acumulados.map((p) => ({
    semana: p.semana,
    optimista: DOS_DECIMALES(p.optimista),
    base: DOS_DECIMALES(p.base),
    pesimista: DOS_DECIMALES(p.pesimista),
  }));
  const ultimo = puntos.at(-1) ?? { semana: 13, optimista: 0, base: 0, pesimista: 0 };
  const topContribuyentes = topFilas(porCliente.entries(), ultimo.base);

  // Reactivación verificable: clientes que facturaron el año anterior y no
  // han facturado en el año del corte. No depende de una bandera de catálogo
  // que puede seguir "activa" aunque el cliente haya dejado de comprar.
  const anioActual = fechaCorte.slice(0, 4);
  const anioAnterior = String(Number(anioActual) - 1);
  const conFacturaActual = new Set<string>();
  const facturacionAnterior = new Map<string, { etiqueta: string; valor: number; ultimaVenta: string | null }>();
  for (const factura of dataset.facturas) {
    if (factura.estado_factura === "anulada") continue;
    if (factura.fecha_emision > fechaCorte) continue;
    const anio = factura.fecha_emision.slice(0, 4);
    if (anio === anioActual) conFacturaActual.add(factura.id_cliente);
    if (anio !== anioAnterior) continue;
    const cliente = clientes.get(factura.id_cliente);
    const actual = facturacionAnterior.get(factura.id_cliente) ?? {
      etiqueta: cliente?.nombre_cliente ?? factura.id_cliente,
      valor: 0,
      ultimaVenta: null,
    };
    actual.valor += factura.monto_original;
    if (!actual.ultimaVenta || factura.fecha_emision > actual.ultimaVenta) actual.ultimaVenta = factura.fecha_emision;
    facturacionAnterior.set(factura.id_cliente, actual);
  }
  const candidatosReactivacion = [...facturacionAnterior.entries()].filter(([id]) => !conFacturaActual.has(id));
  const totalHistoricoInactivos = candidatosReactivacion.reduce((s, [, x]) => s + x.valor, 0);
  const reactivacion: OportunidadReactivacion[] = candidatosReactivacion
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, 10)
    .map(([id, x]) => ({
      id,
      etiqueta: x.etiqueta,
      valor: DOS_DECIMALES(x.valor),
      pct: totalHistoricoInactivos > 0 ? (x.valor / totalHistoricoInactivos) * 100 : 0,
      detalle: x.ultimaVenta ? `última factura ${x.ultimaVenta}` : undefined,
      ultimaVenta: x.ultimaVenta,
    }));

  const resultado: AnaliticaForecast = {
    puntos,
    saldoAbierto: DOS_DECIMALES(saldoAbierto),
    saldoElegible: DOS_DECIMALES(saldoElegible),
    saldoSinVencimiento: DOS_DECIMALES(saldoSinVencimiento),
    facturasAbiertas,
    facturasElegibles,
    base13: ultimo.base,
    optimista13: ultimo.optimista,
    pesimista13: ultimo.pesimista,
    brechaHorizonte: DOS_DECIMALES(Math.max(0, saldoAbierto - ultimo.base)),
    brechaEscenarios: DOS_DECIMALES(Math.max(0, ultimo.optimista - ultimo.pesimista)),
    saldoDisputado: DOS_DECIMALES(saldoDisputado),
    topContribuyentes,
    reactivacion,
    reactivacionTotal: candidatosReactivacion.length,
    reactivacionValorHistorico: DOS_DECIMALES(totalHistoricoInactivos),
    metaDisponible: false,
    probabilidadValidada: false,
  };
  porFecha.set(fechaCorte, resultado);
  cacheForecast.set(dataset, porFecha);
  return resultado;
}
