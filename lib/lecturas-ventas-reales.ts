import { construirLecturasProductoVentas } from "./agentes-producto-ventas";
import type { Dataset, Producto, Venta, VentaLinea } from "./types";

export type FilaVenta = {
  id: string;
  etiqueta: string;
  valor: number;
  pedidos: number;
  ticket: number;
  primera: string | null;
  ultima: string | null;
};

export type PuntoVenta = { periodo: string; valor: number; pedidos: number };

export type LecturasVentas = {
  ventas: Venta[];
  total: number;
  pedidos: number;
  ticket: number;
  desde: string | null;
  hasta: string | null;
  actual: { valor: number; pedidos: number; inicio: string; fin: string } | null;
  comparable: { valor: number; pedidos: number; inicio: string; fin: string } | null;
  variacionValor: number | null;
  variacionPedidos: number | null;
  meses: PuntoVenta[];
  clientes: FilaVenta[];
  top5: number;
  participacionTop5: number;
  familiaLider: { nombre: string; pct: number; valor: number } | null;
};

const dos = (valor: number) => Math.round(valor * 100) / 100;
const fecha = (valor: string) => valor.slice(0, 10);
const montoOdoo = (venta: Venta) => venta.total_referencia?.valorParaMostrar() ?? 0;
const ventasConfirmadas = (dataset: Dataset) => (dataset.ventas ?? []).filter((venta) => venta.estado_odoo === "sale");

function periodoComparable(ventas: Venta[], desde: string, hasta: string) {
  const inicio = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  const anioAnterior = inicio.getUTCFullYear() - 1;
  const inicioAnterior = `${anioAnterior}-${String(inicio.getUTCMonth() + 1).padStart(2, "0")}-${String(inicio.getUTCDate()).padStart(2, "0")}`;
  const finAnterior = `${anioAnterior}-${String(fin.getUTCMonth() + 1).padStart(2, "0")}-${String(fin.getUTCDate()).padStart(2, "0")}`;
  const actual = ventas.filter((venta) => fecha(venta.fecha_venta) >= desde && fecha(venta.fecha_venta) <= hasta);
  const anterior = ventas.filter((venta) => fecha(venta.fecha_venta) >= inicioAnterior && fecha(venta.fecha_venta) <= finAnterior);
  return {
    actual: { valor: dos(actual.reduce((suma, venta) => suma + montoOdoo(venta), 0)), pedidos: actual.length, inicio: desde, fin: hasta },
    comparable: { valor: dos(anterior.reduce((suma, venta) => suma + montoOdoo(venta), 0)), pedidos: anterior.length, inicio: inicioAnterior, fin: finAnterior },
  };
}

export function leerVentasReales(dataset: Dataset): LecturasVentas {
  const ventas = ventasConfirmadas(dataset).sort((a, b) => a.fecha_venta.localeCompare(b.fecha_venta));
  const total = dos(ventas.reduce((suma, venta) => suma + montoOdoo(venta), 0));
  const clientesPorId = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const porCliente = new Map<string, FilaVenta>();
  const porMes = new Map<string, PuntoVenta>();
  for (const venta of ventas) {
    const actual = porCliente.get(venta.id_cliente) ?? {
      id: venta.id_cliente,
      etiqueta: clientesPorId.get(venta.id_cliente) ?? venta.id_cliente,
      valor: 0,
      pedidos: 0,
      ticket: 0,
      primera: null,
      ultima: null,
    };
    actual.valor += montoOdoo(venta);
    actual.pedidos += 1;
    const dia = fecha(venta.fecha_venta);
    actual.primera = !actual.primera || dia < actual.primera ? dia : actual.primera;
    actual.ultima = !actual.ultima || dia > actual.ultima ? dia : actual.ultima;
    porCliente.set(venta.id_cliente, actual);
    const periodo = dia.slice(0, 7);
    const mes = porMes.get(periodo) ?? { periodo, valor: 0, pedidos: 0 };
    mes.valor += montoOdoo(venta);
    mes.pedidos += 1;
    porMes.set(periodo, mes);
  }
  const clientes = [...porCliente.values()]
    .map((cliente) => ({ ...cliente, valor: dos(cliente.valor), ticket: cliente.pedidos ? dos(cliente.valor / cliente.pedidos) : 0 }))
    .sort((a, b) => b.valor - a.valor);
  const hasta = ventas.at(-1) ? fecha(ventas.at(-1)!.fecha_venta) : null;
  const desde = ventas[0] ? fecha(ventas[0].fecha_venta) : null;
  const anioActual = hasta?.slice(0, 4);
  const comparacion = hasta && anioActual ? periodoComparable(ventas, `${anioActual}-01-01`, hasta) : null;
  const top5 = dos(clientes.slice(0, 5).reduce((suma, cliente) => suma + cliente.valor, 0));
  const producto = construirLecturasProductoVentas(dataset).familia;
  const principal = producto.filas.find((fila) => fila.nombre !== "Sin clasificar") ?? null;
  return {
    ventas,
    total,
    pedidos: ventas.length,
    ticket: ventas.length ? dos(total / ventas.length) : 0,
    desde,
    hasta,
    actual: comparacion?.actual ?? null,
    comparable: comparacion?.comparable ?? null,
    variacionValor: comparacion && comparacion.comparable.valor > 0 ? dos(((comparacion.actual.valor - comparacion.comparable.valor) / comparacion.comparable.valor) * 100) : null,
    variacionPedidos: comparacion && comparacion.comparable.pedidos > 0 ? dos(((comparacion.actual.pedidos - comparacion.comparable.pedidos) / comparacion.comparable.pedidos) * 100) : null,
    meses: [...porMes.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-12).map((mes) => ({ ...mes, valor: dos(mes.valor) })),
    clientes,
    top5,
    participacionTop5: total > 0 ? dos((top5 / total) * 100) : 0,
    familiaLider: principal ? { nombre: principal.nombre, pct: principal.pct, valor: principal.valor } : null,
  };
}

export function perfilClienteVentas(dataset: Dataset, clienteId: string) {
  const lectura = leerVentasReales(dataset);
  const cliente = lectura.clientes.find((fila) => fila.id === clienteId) ?? lectura.clientes[0] ?? null;
  if (!cliente) return null;
  const ventas = lectura.ventas.filter((venta) => venta.id_cliente === cliente.id);
  const productos = new Map((dataset.productos ?? []).map((producto) => [producto.id_producto, producto]));
  const ids = new Set(ventas.map((venta) => venta.id_venta));
  const porProducto = new Map<string, { producto: Producto; valor: number; unidades: number }>();
  for (const linea of dataset.ventaLineas ?? []) {
    if (!ids.has(linea.id_venta)) continue;
    const producto = productos.get(linea.id_producto);
    if (!producto) continue;
    const actual = porProducto.get(producto.id_producto) ?? { producto, valor: 0, unidades: 0 };
    actual.valor += linea.cantidad * linea.precio_unitario;
    actual.unidades += linea.cantidad;
    porProducto.set(producto.id_producto, actual);
  }
  return {
    ...cliente,
    ventas: ventas.sort((a, b) => b.fecha_venta.localeCompare(a.fecha_venta)),
    productos: [...porProducto.values()].sort((a, b) => b.valor - a.valor).slice(0, 6).map((fila) => ({ etiqueta: `${fila.producto.sku} · ${fila.producto.nombre_producto}`, valor: dos(fila.valor), unidades: fila.unidades })),
  };
}

export function detalleVenta(dataset: Dataset, idVenta?: string) {
  const lectura = leerVentasReales(dataset);
  const venta = lectura.ventas.find((item) => item.id_venta === idVenta) ?? lectura.ventas.at(-1) ?? null;
  if (!venta) return null;
  const productos = new Map((dataset.productos ?? []).map((producto) => [producto.id_producto, producto]));
  const lineas = (dataset.ventaLineas ?? [])
    .filter((linea) => linea.id_venta === venta.id_venta)
    .flatMap((linea) => {
      const producto = productos.get(linea.id_producto);
      return producto ? [{ linea, producto, valor: dos(linea.cantidad * linea.precio_unitario) }] : [];
    });
  const composicion = dos(lineas.reduce((suma, item) => suma + item.valor, 0));
  return { venta, lineas, composicion, cliente: dataset.clientes.find((cliente) => cliente.id_cliente === venta.id_cliente)?.nombre_cliente ?? venta.id_cliente };
}
