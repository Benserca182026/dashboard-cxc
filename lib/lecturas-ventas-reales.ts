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

// ─────────────────────────────────────────────────────────────────────────────
// SERIE TEMPORAL DE VENTAS — una sola capa: `amount_total` (IVA 12% incluido)
//
// Todo lo de abajo se agrega SIN tocar `leerVentasReales`, que ya consumen
// /ventas/clientes y /ventas/detalle. `montoOdoo` lee
// ventas.total_odoo_referencia, que es el `amount_total` que cerró Odoo: trae el
// descuento aplicado y el IVA del 12% DENTRO. No se convierte, no se le resta
// impuesto y no se mezcla nunca con la composición de líneas
// (cantidad × precio_unitario) — otra magnitud, Q26.16M contra Q19.29M, que
// pertenece a /ventas/productos.
//
// Nada de acá está escrito a mano: años, meses, picos y variaciones se derivan
// de los pedidos en estado "sale". Si el import cambia, las cifras cambian.
// ─────────────────────────────────────────────────────────────────────────────

/** Un año calendario observado. `parcial` dice si el año NO se ve completo. */
export type PuntoAnualVenta = {
  anio: string;
  valor: number;
  pedidos: number;
  clientes: number;
  ticket: number;
  primera: string;
  ultima: string;
  /** true cuando la ventana de observación no cubre el año entero. */
  parcial: boolean;
  /** Por qué es parcial, en palabras, para mostrarlo pegado a la cifra. */
  razonParcial: string | null;
  /**
   * Pedidos del año registrados en una moneda distinta de GTQ.
   *
   * `montoOdoo` suma `amount_total` TAL CUAL viene de Odoo, sin convertir. Si
   * en un año hay aunque sea un pedido en otra moneda, la suma de ese año NO es
   * un total en quetzales: es una mezcla de unidades. Se cuenta acá para poder
   * decirlo pegado a la cifra en vez de dejarlo implícito.
   */
  pedidosOtraMoneda: number;
  /** Códigos de moneda distintos de GTQ observados en el año, sin repetir. */
  monedasOtras: string[];
  /** Ids de esos pedidos, para poder citarlos por nombre y no "en general". */
  idsOtraMoneda: string[];
};

/** Un mes calendario observado. Mismo criterio de `parcial` que el año. */
export type PuntoMesVenta = {
  periodo: string;
  anio: string;
  mes: number;
  etiqueta: string;
  valor: number;
  pedidos: number;
  clientes: number;
  ticket: number;
  parcial: boolean;
  razonParcial: string | null;
};

/** Lectura completa de una ventana de días (p. ej. 1-ene → corte). */
export type ResumenPeriodoVenta = {
  etiqueta: string;
  inicio: string;
  fin: string;
  valor: number;
  pedidos: number;
  clientes: number;
  ticket: number;
  /** Frecuencia: pedidos ÷ clientes compradores del período. */
  pedidosPorCliente: number;
  top5: number;
  /** Concentración Top 5 DEL PERÍODO — no la histórica. */
  participacionTop5: number;
  /** Clientes con 2 o más pedidos dentro del período. */
  recurrentes: number;
  /** Clientes del período cuya última compra quedó a más de 30 días del cierre. */
  porRecuperar: number;
  /** Clientes del período que ya compraban ANTES del período. */
  conHistorial: number;
  /** Pedido mediano: la mitad de los pedidos está por debajo de este importe. */
  ticketMediano: number;
  /** Parte del período que cae en meses cerrados (sin el mes cortado). */
  pedidosMesesCerrados: number;
  valorMesesCerrados: number;
};

export type ComparativoYtdVenta = {
  corte: string;
  /** Días de calendario comparados a cada lado. */
  dias: number;
  actual: ResumenPeriodoVenta;
  previo: ResumenPeriodoVenta;
  variacionValor: number | null;
  variacionPedidos: number | null;
  variacionClientes: number | null;
  variacionTicket: number | null;
  variacionFrecuencia: number | null;
};

export type SerieVentas = {
  desde: string | null;
  corte: string | null;
  total: number;
  pedidos: number;
  clientes: number;
  anios: PuntoAnualVenta[];
  meses: PuntoMesVenta[];
  /** Sólo los años que se ven enteros: los únicos que sostienen crecimiento anual. */
  aniosCompletos: PuntoAnualVenta[];
  /** Sólo los meses que se ven enteros: los únicos comparables contra otro mes. */
  mesesCerrados: PuntoMesVenta[];
  ytd: ComparativoYtdVenta | null;
};

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-07" → "jul 2026". Una sola forma de nombrar un mes en toda la página. */
export function etiquetaMesVenta(periodo: string) {
  const [anio, mes] = periodo.split("-");
  return `${MESES_CORTOS[Number(mes) - 1] ?? mes} ${anio}`;
}

const DIA_EN_MS = 86400000;
const diaDe = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const ultimoDiaDelMes = (anio: number, mes: number) => isoDe(new Date(Date.UTC(anio, mes, 0)));
const restarDias = (iso: string, dias: number) => {
  const d = diaDe(iso);
  d.setUTCDate(d.getUTCDate() - dias);
  return isoDe(d);
};

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return dos(orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2);
}

/**
 * Lectura de una ventana de días. `historial` es la lista COMPLETA de pedidos:
 * hace falta para distinguir un cliente que ya compraba de uno que aparece por
 * primera vez, y para saber cuándo compró por última vez.
 */
function resumenPeriodoVenta(
  ventas: Venta[],
  historial: Venta[],
  inicio: string,
  fin: string,
  etiqueta: string,
  mesesParciales: Set<string>
): ResumenPeriodoVenta {
  const dentro = ventas.filter((venta) => fecha(venta.fecha_venta) >= inicio && fecha(venta.fecha_venta) <= fin);
  const valor = dos(dentro.reduce((suma, venta) => suma + montoOdoo(venta), 0));
  const pedidos = dentro.length;
  const porCliente = new Map<string, { valor: number; pedidos: number }>();
  for (const venta of dentro) {
    const fila = porCliente.get(venta.id_cliente) ?? { valor: 0, pedidos: 0 };
    fila.valor += montoOdoo(venta);
    fila.pedidos += 1;
    porCliente.set(venta.id_cliente, fila);
  }
  const ordenados = [...porCliente.values()].sort((a, b) => b.valor - a.valor);
  const top5 = dos(ordenados.slice(0, 5).reduce((suma, fila) => suma + fila.valor, 0));
  // Historial ANTERIOR al período: separa "cliente que ya compraba" de "cliente
  // que aparece por primera vez". Sobre el segundo no se puede afirmar nada de
  // recurrencia ni de pérdida — todavía no tiene comportamiento observable.
  const previos = new Set(
    historial.filter((venta) => fecha(venta.fecha_venta) < inicio).map((venta) => venta.id_cliente)
  );
  const ultimaCompra = new Map<string, string>();
  for (const venta of historial) {
    const dia = fecha(venta.fecha_venta);
    if (dia > fin) continue;
    const previa = ultimaCompra.get(venta.id_cliente);
    if (!previa || dia > previa) ultimaCompra.set(venta.id_cliente, dia);
  }
  const limiteInactividad = restarDias(fin, 30);
  const cerrados = dentro.filter((venta) => !mesesParciales.has(fecha(venta.fecha_venta).slice(0, 7)));
  return {
    etiqueta,
    inicio,
    fin,
    valor,
    pedidos,
    clientes: porCliente.size,
    ticket: pedidos > 0 ? dos(valor / pedidos) : 0,
    pedidosPorCliente: porCliente.size > 0 ? Math.round((pedidos / porCliente.size) * 10000) / 10000 : 0,
    top5,
    participacionTop5: valor > 0 ? dos((top5 / valor) * 100) : 0,
    recurrentes: [...porCliente.values()].filter((fila) => fila.pedidos >= 2).length,
    porRecuperar: [...porCliente.keys()].filter((id) => (ultimaCompra.get(id) ?? "") < limiteInactividad).length,
    conHistorial: [...porCliente.keys()].filter((id) => previos.has(id)).length,
    ticketMediano: mediana(dentro.map((venta) => montoOdoo(venta))),
    pedidosMesesCerrados: cerrados.length,
    valorMesesCerrados: dos(cerrados.reduce((suma, venta) => suma + montoOdoo(venta), 0)),
  };
}

/**
 * Serie anual y mensual de venta, pedidos, clientes y ticket, más la comparación
 * YTD contra el mismo rango de días del año anterior.
 *
 * Un año o un mes se marca `parcial` cuando la VENTANA DE OBSERVACIÓN no lo
 * cubre entero — porque el histórico arranca a mitad o porque el corte lo
 * interrumpe. Un período parcial se muestra, pero nunca se compara contra uno
 * completo: esa comparación no mide negocio, mide calendario.
 */
export function leerSerieVentas(dataset: Dataset): SerieVentas {
  const ventas = ventasConfirmadas(dataset).slice().sort((a, b) => a.fecha_venta.localeCompare(b.fecha_venta));
  const desde = ventas[0] ? fecha(ventas[0].fecha_venta) : null;
  const corte = ventas.at(-1) ? fecha(ventas.at(-1)!.fecha_venta) : null;
  if (!desde || !corte) {
    return { desde: null, corte: null, total: 0, pedidos: 0, clientes: 0, anios: [], meses: [], aniosCompletos: [], mesesCerrados: [], ytd: null };
  }

  type Acumulado = {
    valor: number;
    pedidos: number;
    clientes: Set<string>;
    primera: string;
    ultima: string;
    /** moneda declarada → ids de los pedidos, sólo para monedas distintas de GTQ. */
    otraMoneda: Map<string, string[]>;
  };
  const acumMes = new Map<string, Acumulado>();
  const acumAnio = new Map<string, Acumulado>();
  for (const venta of ventas) {
    const dia = fecha(venta.fecha_venta);
    const destinos: [Map<string, Acumulado>, string][] = [[acumMes, dia.slice(0, 7)], [acumAnio, dia.slice(0, 4)]];
    for (const [mapa, clave] of destinos) {
      const fila = mapa.get(clave) ?? { valor: 0, pedidos: 0, clientes: new Set<string>(), primera: dia, ultima: dia, otraMoneda: new Map<string, string[]>() };
      fila.valor += montoOdoo(venta);
      fila.pedidos += 1;
      fila.clientes.add(venta.id_cliente);
      if (venta.moneda_id && venta.moneda_id !== "GTQ") {
        const lista = fila.otraMoneda.get(venta.moneda_id) ?? [];
        lista.push(venta.id_venta);
        fila.otraMoneda.set(venta.moneda_id, lista);
      }
      if (dia < fila.primera) fila.primera = dia;
      if (dia > fila.ultima) fila.ultima = dia;
      mapa.set(clave, fila);
    }
  }

  const meses: PuntoMesVenta[] = [...acumMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodo, fila]) => {
      const cierreDelMes = ultimoDiaDelMes(Number(periodo.slice(0, 4)), Number(periodo.slice(5, 7)));
      const cortado = periodo === corte.slice(0, 7) && corte < cierreDelMes;
      const truncado = periodo === desde.slice(0, 7) && desde > `${periodo}-01`;
      return {
        periodo,
        anio: periodo.slice(0, 4),
        mes: Number(periodo.slice(5, 7)),
        etiqueta: etiquetaMesVenta(periodo),
        valor: dos(fila.valor),
        pedidos: fila.pedidos,
        clientes: fila.clientes.size,
        ticket: fila.pedidos > 0 ? dos(fila.valor / fila.pedidos) : 0,
        parcial: cortado || truncado,
        razonParcial: cortado
          ? `mes cortado el ${corte}`
          : truncado
            ? `el histórico arranca el ${desde}`
            : null,
      };
    });

  const anios: PuntoAnualVenta[] = [...acumAnio.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([anio, fila]) => {
      const cortado = anio === corte.slice(0, 4) && corte < `${anio}-12-31`;
      const truncado = anio === desde.slice(0, 4) && desde > `${anio}-01-01`;
      return {
        anio,
        valor: dos(fila.valor),
        pedidos: fila.pedidos,
        clientes: fila.clientes.size,
        ticket: fila.pedidos > 0 ? dos(fila.valor / fila.pedidos) : 0,
        primera: fila.primera,
        ultima: fila.ultima,
        parcial: cortado || truncado,
        razonParcial: cortado
          ? `PARCIAL al corte ${corte}`
          : truncado
            ? `histórico incompleto desde ${desde}`
            : null,
        pedidosOtraMoneda: [...fila.otraMoneda.values()].reduce((suma, ids) => suma + ids.length, 0),
        monedasOtras: [...fila.otraMoneda.keys()].sort(),
        idsOtraMoneda: [...fila.otraMoneda.values()].flat().sort(),
      };
    });

  const mesesParciales = new Set(meses.filter((mes) => mes.parcial).map((mes) => mes.periodo));
  const anioCorte = corte.slice(0, 4);
  const anioPrevio = String(Number(anioCorte) - 1);
  const inicioActual = `${anioCorte}-01-01`;
  const inicioPrevio = `${anioPrevio}-01-01`;
  const finPrevio = `${anioPrevio}${corte.slice(4)}`;
  const actual = resumenPeriodoVenta(ventas, ventas, inicioActual, corte, `${anioCorte} · 1 ene → ${corte}`, mesesParciales);
  const previo = resumenPeriodoVenta(ventas, ventas, inicioPrevio, finPrevio, `${anioPrevio} · 1 ene → ${finPrevio}`, mesesParciales);
  const variacion = (hoy: number, antes: number) => (antes > 0 ? dos((hoy / antes - 1) * 100) : null);

  return {
    desde,
    corte,
    total: dos(ventas.reduce((suma, venta) => suma + montoOdoo(venta), 0)),
    pedidos: ventas.length,
    clientes: new Set(ventas.map((venta) => venta.id_cliente)).size,
    anios,
    meses,
    aniosCompletos: anios.filter((anio) => !anio.parcial),
    mesesCerrados: meses.filter((mes) => !mes.parcial),
    ytd: previo.pedidos > 0
      ? {
          corte,
          dias: Math.round((diaDe(corte).getTime() - diaDe(inicioActual).getTime()) / DIA_EN_MS) + 1,
          actual,
          previo,
          variacionValor: variacion(actual.valor, previo.valor),
          variacionPedidos: variacion(actual.pedidos, previo.pedidos),
          variacionClientes: variacion(actual.clientes, previo.clientes),
          variacionTicket: variacion(actual.ticket, previo.ticket),
          variacionFrecuencia: variacion(actual.pedidosPorCliente, previo.pedidosPorCliente),
        }
      : null,
  };
}
