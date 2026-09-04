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

// ─────────────────────────────────────────────────────────────────────────────
// SUB-LECTURAS DE EVOLUCIÓN — lo que un solo YoY no alcanza a contestar
//
// El agente de Evolución publica UN número: la venta comparable se mueve
// +24.67%. Ese número es correcto y, solo, se puede leer mal de cuatro maneras
// distintas. Cada sub-lectura de acá ataca UNA de ellas y todas salen de los
// MISMOS pedidos en estado "sale" que ya lee `leerSerieVentas`: no hay una
// fuente nueva, ni una capa nueva, ni un supuesto nuevo.
//
//   1. ¿Crece el negocio o crecen cinco cuentas?   → venta sin el Top 5
//   2. ¿Es un mes suelto o una racha?              → 6 meses, cada uno contra el suyo
//   3. ¿Es tendencia o es temporada?               → TTM, total móvil de 12 meses
//   4. ¿Se está acelerando o frenando?             → diferencia de dos tasas interanuales
//
// POR QUÉ TTM Y NO MEDIA MÓVIL DE 3 MESES: una MA3 mezcla tendencia con
// estacionalidad — si noviembre y diciembre son fuertes, la MA3 de diciembre
// "sube" sin que el negocio haya crecido nada, y vuelve a "bajar" en enero por
// la misma razón. El TTM abarca los doce meses del calendario de un lado y del
// otro, así que la estacionalidad se cancela POR CONSTRUCCIÓN: lo que queda del
// movimiento es nivel de negocio, no qué mes cayó dentro de la ventana.
//
// POR QUÉ CADA MES CONTRA SU MISMO MES, Y NO 3 MESES CONTRA LOS 3 ANTERIORES:
// comparar jun-jul-ago contra mar-abr-may compara dos temporadas distintas y
// después llama "aceleración" a la diferencia entre ellas. Los dos bloques de
// acá se miden SIEMPRE contra su propio período del año anterior, y recién esas
// dos tasas se restan: la diferencia ya no puede venir del calendario.
//
// FRAGILIDAD DECLARADA, NO IMPLÍCITA: el negocio hace del orden de 60 pedidos
// al mes. Un pedido grande mueve un mes entero y puede dar vuelta un "creció".
// Por eso cada sub-lectura carga sobre cuántos pedidos se calcula y cuánto se
// movería el número si se quitara el pedido más grande. Un dato que se da
// vuelta al quitar UN pedido no es una tendencia, y hay que poder verlo.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un cálculo que puede no tener base. O hay dato, o hay motivo: nunca los dos
 * ni ninguno. La forma obliga a quien consume esto a decir por qué falta el
 * número en vez de rellenar con un cero o con un guion.
 */
export type CalculoVenta<T> = { dato: T; motivo: null } | { dato: null; motivo: string };

const conDato = <T>(dato: T): CalculoVenta<T> => ({ dato, motivo: null });
const sinBase = <T>(motivo: string): CalculoVenta<T> => ({ dato: null, motivo });

/** "2026-07" + (-12) → "2025-07". Aritmética de calendario, no de días. */
const mesDesplazado = (periodo: string, meses: number) => {
  const indice = Number(periodo.slice(0, 4)) * 12 + Number(periodo.slice(5, 7)) - 1 + meses;
  return `${String(Math.floor(indice / 12)).padStart(4, "0")}-${String((indice % 12) + 1).padStart(2, "0")}`;
};

const rangoMeses = (inicio: string, fin: string) => {
  const periodos: string[] = [];
  for (let periodo = inicio; periodo <= fin; periodo = mesDesplazado(periodo, 1)) periodos.push(periodo);
  return periodos;
};

/** Misma regla que la variación del YTD: sin base positiva no hay porcentaje. */
const tasaVenta = (hoy: number, antes: number) => (antes > 0 ? dos((hoy / antes - 1) * 100) : null);

export type ClienteExcluidoVenta = { id: string; nombre: string; valor: number };

export type LecturaSinTop5 = {
  /** Las cinco cuentas mayores DEL PERÍODO ACTUAL, que se sacan de los dos lados. */
  clientes: ClienteExcluidoVenta[];
  actual: number;
  previo: number;
  variacion: number;
  /** La misma ventana con todos los clientes dentro, para poder contrastar. */
  variacionCompleta: number | null;
  pedidos: number;
  pedidosPrevio: number;
  pedidosExcluidos: number;
  mayorPedido: number;
  /** La variación recalculada sin el pedido más grande de los que quedan. */
  variacionSinMayor: number;
};

/** Un mes cerrado enfrentado a SU mismo mes del año anterior. */
export type ParMesInteranual = {
  periodo: string;
  etiqueta: string;
  valor: number;
  pedidos: number;
  /** null cuando el histórico observado no llega al mes equivalente. */
  previo: { periodo: string; etiqueta: string; valor: number; pedidos: number } | null;
  variacion: number | null;
  mayorPedido: number;
  /** Cuánto del mes es UN solo pedido. Sobre 20% el mes no describe al negocio. */
  pesoMayorPedido: number;
};

export type LecturaMesesInteranuales = {
  meses: ParMesInteranual[];
  /** Meses que superan su equivalente del año anterior. */
  arriba: number;
  /** De los meses observados, cuántos tienen equivalente contra el cual medirse. */
  conComparable: number;
  pedidos: number;
  /** Los meses donde un solo pedido pesó más del 20% del mes. */
  dominados: ParMesInteranual[];
  mayorPedido: { monto: number; etiqueta: string } | null;
  /** El mismo marcador después de quitar ese pedido de su mes. */
  arribaSinMayor: number;
};

export type LecturaTtm = {
  etiqueta: string;
  etiquetaPrevio: string;
  actual: number;
  previo: number;
  variacion: number;
  pedidos: number;
  pedidosPrevio: number;
  mayorPedido: number;
  variacionSinMayor: number;
};

export type BloqueInteranual = {
  etiqueta: string;
  /** Los mismos meses del año anterior contra los que se mide el bloque. */
  etiquetaBase: string;
  valor: number;
  base: number;
  tasa: number;
  pedidos: number;
};

export type LecturaAceleracion = {
  reciente: BloqueInteranual;
  anterior: BloqueInteranual;
  /** Diferencia de las dos tasas, en puntos porcentuales. */
  aceleracion: number;
  mayorPedido: number;
  aceleracionSinMayor: number;
  pedidos: number;
};

export type EvolucionDetalladaVenta = {
  sinTop5: CalculoVenta<LecturaSinTop5>;
  mesesInteranuales: CalculoVenta<LecturaMesesInteranuales>;
  ttm: CalculoVenta<LecturaTtm>;
  aceleracion: CalculoVenta<LecturaAceleracion>;
};

/**
 * Las cuatro sub-lecturas de Evolución sobre la MISMA serie que ya se leyó.
 *
 * Recibe `serie` en vez de recalcularla: la ventana comparable (qué días contra
 * qué días) y qué meses están cerrados ya los decidió `leerSerieVentas`, y
 * volver a decidirlos acá abriría la puerta a que dos partes de la misma página
 * comparen rangos distintos y nadie lo note mirando los números.
 */
export function leerEvolucionDetallada(dataset: Dataset, serie: SerieVentas): EvolucionDetalladaVenta {
  const ventas = ventasConfirmadas(dataset);
  const ytd = serie.ytd;
  const primerCerrado = serie.mesesCerrados[0]?.periodo ?? null;
  const ultimoCerrado = serie.mesesCerrados.at(-1)?.periodo ?? null;

  // Acumulado mensual con el pedido MÁS GRANDE de cada mes. Sin ese máximo no
  // se puede decir cuánto de un mes es un solo pedido, que es exactamente la
  // fragilidad de una serie de ~60 pedidos mensuales.
  const porMes = new Map<string, { valor: number; pedidos: number; mayor: number }>();
  for (const venta of ventas) {
    const periodo = fecha(venta.fecha_venta).slice(0, 7);
    const fila = porMes.get(periodo) ?? { valor: 0, pedidos: 0, mayor: 0 };
    const monto = montoOdoo(venta);
    fila.valor += monto;
    fila.pedidos += 1;
    if (monto > fila.mayor) fila.mayor = monto;
    porMes.set(periodo, fila);
  }
  // Un mes sin pedidos vale cero, no "no existe": si se lo saltara, una ventana
  // de 12 meses podría terminar sumando 13 meses de calendario sin avisar.
  const leerMes = (periodo: string) => porMes.get(periodo) ?? { valor: 0, pedidos: 0, mayor: 0 };
  const bloque = (periodos: string[]) =>
    periodos.reduce(
      (suma, periodo) => {
        const fila = leerMes(periodo);
        return { valor: suma.valor + fila.valor, pedidos: suma.pedidos + fila.pedidos, mayor: Math.max(suma.mayor, fila.mayor) };
      },
      { valor: 0, pedidos: 0, mayor: 0 }
    );
  // Observado = mes calendario que se ve ENTERO. El primer mes del histórico
  // suele arrancar a mitad y el mes del corte está cortado: ninguno de los dos
  // puede entrar en una suma que se compara contra otro mes completo.
  const observado = (periodo: string) =>
    primerCerrado !== null && ultimoCerrado !== null && periodo >= primerCerrado && periodo <= ultimoCerrado;
  const rotulo = (periodos: string[]) =>
    periodos.length === 0 ? "sin meses" : `${etiquetaMesVenta(periodos[0])} → ${etiquetaMesVenta(periodos[periodos.length - 1])}`;

  const faltaCalendario = "No hay ningún mes calendario cerrado dentro de la ventana observada: todos los meses están cortados por el inicio del histórico o por el corte.";

  // ── 1 · La venta comparable sin las cinco cuentas mayores ─────────────────
  // Se excluye el MISMO conjunto de clientes de los dos lados. Sacar el Top 5
  // de cada período por separado compararía dos carteras distintas y el
  // resultado no diría nada sobre el resto de la cartera, que es la pregunta.
  let sinTop5: CalculoVenta<LecturaSinTop5>;
  if (!ytd) {
    sinTop5 = sinBase("No hay una ventana equivalente del año anterior: sin los dos lados no se puede quitar el Top 5 de ninguno.");
  } else {
    const nombres = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
    const enVentana = (inicio: string, fin: string) =>
      ventas.filter((venta) => fecha(venta.fecha_venta) >= inicio && fecha(venta.fecha_venta) <= fin);
    const actuales = enVentana(ytd.actual.inicio, ytd.actual.fin);
    const previos = enVentana(ytd.previo.inicio, ytd.previo.fin);
    const porCliente = new Map<string, number>();
    for (const venta of actuales) porCliente.set(venta.id_cliente, (porCliente.get(venta.id_cliente) ?? 0) + montoOdoo(venta));
    const cinco = [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const excluidos = new Set(cinco.map(([id]) => id));
    const restoActual = actuales.filter((venta) => !excluidos.has(venta.id_cliente));
    const restoPrevio = previos.filter((venta) => !excluidos.has(venta.id_cliente));
    const valorActual = dos(restoActual.reduce((suma, venta) => suma + montoOdoo(venta), 0));
    const valorPrevio = dos(restoPrevio.reduce((suma, venta) => suma + montoOdoo(venta), 0));
    const mayorPedido = dos(Math.max(0, ...restoActual.map(montoOdoo)));
    const variacion = tasaVenta(valorActual, valorPrevio);
    const variacionSinMayor = tasaVenta(dos(valorActual - mayorPedido), valorPrevio);
    sinTop5 =
      variacion === null || variacionSinMayor === null
        ? sinBase("Fuera de esas cinco cuentas el año anterior no registra venta en la misma ventana de días: no hay base contra la cual medir.")
        : conDato({
            clientes: cinco.map(([id, valor]) => ({ id, nombre: nombres.get(id) ?? id, valor: dos(valor) })),
            actual: valorActual,
            previo: valorPrevio,
            variacion,
            variacionCompleta: ytd.variacionValor,
            pedidos: restoActual.length,
            pedidosPrevio: restoPrevio.length,
            pedidosExcluidos: actuales.length - restoActual.length,
            mayorPedido,
            variacionSinMayor,
          });
  }

  // ── 2 · Los últimos seis meses cerrados, cada uno contra el suyo ──────────
  let mesesInteranuales: CalculoVenta<LecturaMesesInteranuales>;
  if (!ultimoCerrado) {
    mesesInteranuales = sinBase(faltaCalendario);
  } else {
    const periodos = rangoMeses(mesDesplazado(ultimoCerrado, -5), ultimoCerrado).filter(observado);
    const pares: ParMesInteranual[] = periodos.map((periodo) => {
      const fila = leerMes(periodo);
      const anterior = mesDesplazado(periodo, -12);
      const filaAnterior = leerMes(anterior);
      const previo = observado(anterior)
        ? { periodo: anterior, etiqueta: etiquetaMesVenta(anterior), valor: dos(filaAnterior.valor), pedidos: filaAnterior.pedidos }
        : null;
      return {
        periodo,
        etiqueta: etiquetaMesVenta(periodo),
        valor: dos(fila.valor),
        pedidos: fila.pedidos,
        previo,
        variacion: previo ? tasaVenta(dos(fila.valor), previo.valor) : null,
        mayorPedido: dos(fila.mayor),
        pesoMayorPedido: fila.valor > 0 ? dos((fila.mayor / fila.valor) * 100) : 0,
      };
    });
    const conComparable = pares.filter((par) => par.previo !== null);
    if (conComparable.length === 0) {
      mesesInteranuales = sinBase(
        `Ninguno de los ${pares.length || 0} meses cerrados observados tiene su mismo mes del año anterior dentro del histórico: no hay contra qué compararlos.`
      );
    } else {
      const mayor = pares.reduce((a, b) => (b.mayorPedido > a.mayorPedido ? b : a));
      mesesInteranuales = conDato({
        meses: pares,
        arriba: pares.filter((par) => par.previo !== null && par.valor > par.previo.valor).length,
        conComparable: conComparable.length,
        pedidos: pares.reduce((suma, par) => suma + par.pedidos, 0),
        dominados: pares.filter((par) => par.pesoMayorPedido > 20),
        mayorPedido: mayor.mayorPedido > 0 ? { monto: mayor.mayorPedido, etiqueta: mayor.etiqueta } : null,
        // El mismo marcador quitando ese único pedido de SU mes: si "5 de 6"
        // pasa a "4 de 6", la racha la sostenía un pedido, no el negocio.
        arribaSinMayor: pares.filter((par) => {
          if (!par.previo) return false;
          const valor = par.periodo === mayor.periodo ? dos(par.valor - mayor.mayorPedido) : par.valor;
          return valor > par.previo.valor;
        }).length,
      });
    }
  }

  // ── 3 · TTM · total móvil de doce meses contra los doce anteriores ────────
  let ttm: CalculoVenta<LecturaTtm>;
  if (!ultimoCerrado || !primerCerrado) {
    ttm = sinBase(faltaCalendario);
  } else {
    const arranquePrevio = mesDesplazado(ultimoCerrado, -23);
    if (arranquePrevio < primerCerrado) {
      ttm = sinBase(
        `El bloque anterior tendría que arrancar en ${etiquetaMesVenta(arranquePrevio)} y el primer mes calendario completo del histórico es ${etiquetaMesVenta(primerCerrado)}: no hay dos ventanas de doce meses enteros que comparar.`
      );
    } else {
      const periodosActual = rangoMeses(mesDesplazado(ultimoCerrado, -11), ultimoCerrado);
      const periodosPrevio = rangoMeses(arranquePrevio, mesDesplazado(ultimoCerrado, -12));
      const hoy = bloque(periodosActual);
      const antes = bloque(periodosPrevio);
      const variacion = tasaVenta(dos(hoy.valor), dos(antes.valor));
      const variacionSinMayor = tasaVenta(dos(hoy.valor - hoy.mayor), dos(antes.valor));
      ttm =
        variacion === null || variacionSinMayor === null
          ? sinBase("Los doce meses anteriores no registran venta: sin base no hay variación de TTM.")
          : conDato({
              etiqueta: rotulo(periodosActual),
              etiquetaPrevio: rotulo(periodosPrevio),
              actual: dos(hoy.valor),
              previo: dos(antes.valor),
              variacion,
              pedidos: hoy.pedidos,
              pedidosPrevio: antes.pedidos,
              mayorPedido: dos(hoy.mayor),
              variacionSinMayor,
            });
    }
  }

  // ── 4 · Aceleración: dos tasas interanuales, restadas ─────────────────────
  let aceleracion: CalculoVenta<LecturaAceleracion>;
  if (!ultimoCerrado || !primerCerrado) {
    aceleracion = sinBase(faltaCalendario);
  } else {
    // El mes más viejo que hace falta es la base del bloque anterior: seis
    // meses hacia atrás, más los doce de su propio comparable.
    const masViejo = mesDesplazado(ultimoCerrado, -17);
    if (masViejo < primerCerrado) {
      aceleracion = sinBase(
        `Restar dos tasas interanuales exige seis meses cerrados y sus seis equivalentes del año anterior, o sea desde ${etiquetaMesVenta(masViejo)}. El histórico completo empieza en ${etiquetaMesVenta(primerCerrado)}.`
      );
    } else {
      const recientes = rangoMeses(mesDesplazado(ultimoCerrado, -2), ultimoCerrado);
      const anteriores = rangoMeses(mesDesplazado(ultimoCerrado, -5), mesDesplazado(ultimoCerrado, -3));
      const baseRecientes = recientes.map((periodo) => mesDesplazado(periodo, -12));
      const baseAnteriores = anteriores.map((periodo) => mesDesplazado(periodo, -12));
      const hoy = bloque(recientes);
      const baseHoy = bloque(baseRecientes);
      const antes = bloque(anteriores);
      const baseAntes = bloque(baseAnteriores);
      const tasaReciente = tasaVenta(dos(hoy.valor), dos(baseHoy.valor));
      const tasaAnterior = tasaVenta(dos(antes.valor), dos(baseAntes.valor));
      if (tasaReciente === null || tasaAnterior === null) {
        aceleracion = sinBase("Uno de los dos trimestres del año anterior no registra venta: sin base no hay dos tasas que restar.");
      } else {
        // El pedido más grande sale del bloque donde realmente está: quitarlo
        // del otro sería inventar de dónde viene la fragilidad.
        const enReciente = hoy.mayor >= antes.mayor;
        const mayorPedido = dos(Math.max(hoy.mayor, antes.mayor));
        const tasaRecienteSin = enReciente ? tasaVenta(dos(hoy.valor - hoy.mayor), dos(baseHoy.valor)) : tasaReciente;
        const tasaAnteriorSin = enReciente ? tasaAnterior : tasaVenta(dos(antes.valor - antes.mayor), dos(baseAntes.valor));
        aceleracion = conDato({
          reciente: {
            etiqueta: rotulo(recientes),
            etiquetaBase: rotulo(baseRecientes),
            valor: dos(hoy.valor),
            base: dos(baseHoy.valor),
            tasa: tasaReciente,
            pedidos: hoy.pedidos,
          },
          anterior: {
            etiqueta: rotulo(anteriores),
            etiquetaBase: rotulo(baseAnteriores),
            valor: dos(antes.valor),
            base: dos(baseAntes.valor),
            tasa: tasaAnterior,
            pedidos: antes.pedidos,
          },
          aceleracion: dos(tasaReciente - tasaAnterior),
          mayorPedido,
          aceleracionSinMayor: dos((tasaRecienteSin ?? tasaReciente) - (tasaAnteriorSin ?? tasaAnterior)),
          pedidos: hoy.pedidos + antes.pedidos,
        });
      }
    }
  }

  return { sinTop5, mesesInteranuales, ttm, aceleracion };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALCANCE TEMPORAL — el candado de "días equivalentes", convertido en tipo
//
// Toda esta página descansa en UNA regla: se comparan rangos de días
// equivalentes, nunca un año parcial contra uno entero. Hasta acá esa regla
// vivía en un solo lugar (la ventana YTD de `leerSerieVentas`) porque había un
// solo alcance posible. Al dejar elegir el alcance —2022, 2023, 2024, 2025,
// 2026 o todo— la regla pasa a tener que resolverse SEIS veces, y ahí es donde
// se cuela el error: 2022 arranca el 2022-08-08 y 2026 llega sólo al
// 2026-08-19, así que "2023 contra 2022" a secas compararía doce meses contra
// cinco y le llamaría crecimiento a la diferencia de calendario.
//
// Por eso el alcance NO es un string suelto que después cada cálculo interpreta
// como quiera: es un objeto que ya trae resuelta la ventana comparable, y esa
// ventana es siempre la INTERSECCIÓN de los días observados de los dos años.
// Si la intersección no existe (2022 no tiene 2021 en el histórico), no hay
// ventana: hay `motivo`, y quien consume el alcance queda obligado por el tipo
// a decirlo en vez de mostrar un porcentaje que no significa nada.
//
// La ventana observada de un año NO se deriva de la primera y la última venta
// de ese año, sino de `desde`/`corte` del histórico completo. La diferencia
// importa: un enero sin ventas dentro de un año observado entero es un cero
// REAL —no vendimos— y un enero fuera de la ventana es ausencia de dato. Si la
// ventana saliera de las ventas del propio año, los dos casos se verían igual.
// ─────────────────────────────────────────────────────────────────────────────

/** Los dos rangos de días que se enfrentan, ya igualados. */
export type VentanaComparableVenta = {
  etiqueta: string;
  inicio: string;
  fin: string;
  inicioPrevio: string;
  finPrevio: string;
  /** Días de calendario a CADA lado. Los dos lados tienen los mismos. */
  dias: number;
  /** true cuando hubo que recortar días para igualar los dos lados. */
  recortada: boolean;
  /** Qué días quedaron fuera y por qué. Null sólo si se comparan años enteros. */
  razonRecorte: string | null;
};

/** Un alcance elegible del filtro: un año, o todo el histórico. */
export type AlcanceVenta = {
  id: string;
  etiqueta: string;
  /** null en "Todo el período". */
  anio: string | null;
  /** Ventana OBSERVADA del alcance: lo que el histórico alcanza a ver de él. */
  inicio: string;
  fin: string;
  dias: number;
  /** true cuando la ventana observada no cubre el alcance entero. */
  parcial: boolean;
  razonParcial: string | null;
  /** Contra qué se mide. O ventana equivalente, o motivo por el que no la hay. */
  comparable: CalculoVenta<VentanaComparableVenta>;
};

const diasEntre = (inicio: string, fin: string) =>
  Math.round((diaDe(fin).getTime() - diaDe(inicio).getTime()) / DIA_EN_MS) + 1;

/** "2026-08-19" → "08-19". El día del año sin el año: lo que hay que igualar. */
const diaDelAnio = (iso: string) => iso.slice(5);
const elMayor = (a: string, b: string) => (a >= b ? a : b);
const elMenor = (a: string, b: string) => (a <= b ? a : b);

/**
 * Los alcances elegibles y, para cada uno, contra qué se puede comparar.
 *
 * "Todo el período" no tiene un comparable propio —no existe un histórico
 * anterior contra el cual medir el histórico entero— así que reutiliza la
 * ventana YTD: 1 de enero al corte contra los mismos días del año anterior. Se
 * dice explícitamente en `razonRecorte` para que nadie lea "todo el período" y
 * suponga que ese porcentaje abarca los cuatro años.
 */
export function construirAlcancesVenta(serie: SerieVentas): AlcanceVenta[] {
  const desde = serie.desde;
  const corte = serie.corte;
  if (!desde || !corte) return [];

  /** Los días del año `anio` que el histórico alcanza a observar. */
  const observada = (anio: string) => ({
    inicio: elMayor(desde, `${anio}-01-01`),
    fin: elMenor(corte, `${anio}-12-31`),
  });

  const primerAnio = Number(desde.slice(0, 4));
  const anios = serie.anios.map((punto) => punto.anio);

  const porAnio: AlcanceVenta[] = anios.map((anio) => {
    const propia = observada(anio);
    const truncado = propia.inicio > `${anio}-01-01`;
    const cortado = propia.fin < `${anio}-12-31`;
    const previo = String(Number(anio) - 1);

    let comparable: CalculoVenta<VentanaComparableVenta>;
    if (Number(previo) < primerAnio) {
      comparable = sinBase(
        `${anio} no tiene contra qué medirse: el histórico arranca el ${desde} y de ${previo} no hay ni un día registrado. Cualquier crecimiento que se mostrara acá compararía ${anio} contra la nada.`
      );
    } else {
      const ajena = observada(previo);
      // La intersección de los dos calendarios observados. Comparar fuera de
      // ella sería enfrentar días que un lado tiene y el otro no.
      const arranque = elMayor(diaDelAnio(propia.inicio), diaDelAnio(ajena.inicio));
      const cierre = elMenor(diaDelAnio(propia.fin), diaDelAnio(ajena.fin));
      if (arranque > cierre) {
        comparable = sinBase(
          `Los días observados de ${anio} (${diaDelAnio(propia.inicio)} → ${diaDelAnio(propia.fin)}) y los de ${previo} (${diaDelAnio(ajena.inicio)} → ${diaDelAnio(ajena.fin)}) no se solapan en ninguna fecha: no hay un solo día que los dos años tengan en común.`
        );
      } else {
        const recortada = arranque !== "01-01" || cierre !== "12-31";
        const dias = diasEntre(`${anio}-${arranque}`, `${anio}-${cierre}`);
        const culpas: string[] = [];
        if (arranque !== "01-01") {
          culpas.push(truncado ? `el histórico arranca el ${desde}` : `de ${previo} sólo se observa desde el ${ajena.inicio}`);
        }
        if (cierre !== "12-31") {
          culpas.push(cortado ? `${anio} se corta el ${corte}` : `${previo} se corta el ${ajena.fin}`);
        }
        comparable = conDato({
          etiqueta: `${anio} ${arranque} → ${cierre} contra ${previo} ${arranque} → ${cierre}`,
          inicio: `${anio}-${arranque}`,
          fin: `${anio}-${cierre}`,
          inicioPrevio: `${previo}-${arranque}`,
          finPrevio: `${previo}-${cierre}`,
          dias,
          recortada,
          razonRecorte: recortada
            ? `Se comparan sólo los días ${arranque} → ${cierre} (${dias} por lado) porque ${culpas.join(" y ")}: el resto del calendario lo tiene un año y el otro no.`
            : null,
        });
      }
    }

    return {
      id: anio,
      etiqueta: anio,
      anio,
      inicio: propia.inicio,
      fin: propia.fin,
      dias: diasEntre(propia.inicio, propia.fin),
      parcial: truncado || cortado,
      razonParcial: truncado
        ? `PARCIAL · de ${anio} sólo se observan ${diasEntre(propia.inicio, propia.fin)} días, desde el ${propia.inicio}: el histórico no llega más atrás.`
        : cortado
          ? `PARCIAL · de ${anio} sólo se observan ${diasEntre(propia.inicio, propia.fin)} días, hasta el ${propia.fin}: el año todavía no termina.`
          : null,
      comparable,
    };
  });

  // ── Todo el período ───────────────────────────────────────────────────────
  const anioCorte = corte.slice(0, 4);
  const anioPrevio = String(Number(anioCorte) - 1);
  const inicioYtd = `${anioCorte}-01-01`;
  const diasYtd = diasEntre(inicioYtd, corte);
  const todo: AlcanceVenta = {
    id: "todo",
    etiqueta: "Todo el período",
    anio: null,
    inicio: desde,
    fin: corte,
    dias: diasEntre(desde, corte),
    // El histórico entero SÍ es parcial en sus dos extremos, y decirlo importa:
    // el total de "todo el período" no es la venta de cuatro años y medio de
    // negocio, es la de la ventana que se alcanzó a observar.
    parcial: true,
    razonParcial: `PARCIAL en los dos extremos · el histórico arranca el ${desde} (a ${desde.slice(0, 4)} le faltan sus primeros meses) y se corta el ${corte} (${anioCorte} todavía no termina).`,
    comparable:
      Number(anioPrevio) < primerAnio
        ? sinBase(`El histórico arranca el ${desde}: no hay un año anterior contra el cual medir el período.`)
        : conDato({
            etiqueta: `${anioCorte} 01-01 → ${corte.slice(5)} contra ${anioPrevio} 01-01 → ${corte.slice(5)}`,
            inicio: inicioYtd,
            fin: corte,
            inicioPrevio: `${anioPrevio}-01-01`,
            finPrevio: `${anioPrevio}${corte.slice(4)}`,
            dias: diasYtd,
            recortada: true,
            razonRecorte: `«Todo el período» abarca ${desde} → ${corte}, pero un crecimiento exige dos ventanas de días equivalentes y el histórico no tiene dos períodos de ese tamaño para enfrentar. La tasa se mide sobre 1 ene → ${corte} contra los mismos ${diasYtd} días de ${anioPrevio}; el resto del alcance entra en la concentración y en el conteo de meses, no en esta tasa.`,
          }),
  };

  return [todo, ...porAnio];
}

// ─────────────────────────────────────────────────────────────────────────────
// LAS CUATRO SUB-LECTURAS, AHORA SENSIBLES AL ALCANCE
//
// Son cuatro preguntas sobre el mismo número, recalculadas dentro del alcance
// elegido en vez de sobre el año en curso:
//
//   1. ¿El negocio depende de pocas cuentas?  → Top 5 DEL ALCANCE y qué queda sin ellas
//   2. ¿El crecimiento es parejo?             → meses cerrados del alcance, cada uno contra el suyo
//   3. ¿A qué ritmo se mueve?                 → TTM (todo el período) o año contra año (un año)
//   4. ¿Qué tan bueno es este año?            → su tasa contra la de cada año del histórico
//
// Ninguna inventa una fuente nueva: todas leen los mismos pedidos en estado
// "sale" y la misma ventana comparable que ya resolvió `construirAlcancesVenta`.
// ─────────────────────────────────────────────────────────────────────────────

export type CrecimientoSinTop5 = {
  etiqueta: string;
  actual: number;
  previo: number;
  variacion: number;
  /** La misma ventana con todos los clientes dentro, para poder contrastar. */
  variacionCompleta: number | null;
  pedidos: number;
  pedidosPrevio: number;
  mayorPedido: number;
  variacionSinMayor: number;
  dias: number;
};

export type LecturaDependencia = {
  clientes: ClienteExcluidoVenta[];
  valorTop5: number;
  valorAlcance: number;
  participacion: number;
  /** Cuánto pesa la cuenta mayor SOLA: el primer escalón de la dependencia. */
  participacionMayor: number;
  nombreMayor: string;
  clientesTotales: number;
  pedidos: number;
  pedidosTop5: number;
  crecimiento: CalculoVenta<CrecimientoSinTop5>;
};

export type LecturaConsistencia = {
  meses: ParMesInteranual[];
  arriba: number;
  conComparable: number;
  sinComparable: ParMesInteranual[];
  mejor: ParMesInteranual | null;
  peor: ParMesInteranual | null;
  pedidos: number;
  dominados: ParMesInteranual[];
  mayorPedido: { monto: number; etiqueta: string } | null;
  arribaSinMayor: number;
};

/** Crecimiento de un año contra el anterior sobre la ventana ya igualada. */
export type RitmoAnualVenta = {
  ventana: VentanaComparableVenta;
  actual: number;
  previo: number;
  variacion: number;
  pedidos: number;
  pedidosPrevio: number;
  mayorPedido: number;
  variacionSinMayor: number;
};

/** El ritmo cambia de forma con el alcance: TTM para todo, año contra año para un año. */
export type LecturaRitmo =
  | { tipo: "ttm"; ttm: LecturaTtm }
  | { tipo: "anual"; anio: string; anual: RitmoAnualVenta };

export type PosicionAnualVenta = {
  anio: string;
  tasa: number;
  valor: number;
  previo: number;
  pedidos: number;
  ventana: VentanaComparableVenta;
};

export type LecturaCalidad = {
  /** Años con tasa calculable, de mayor a menor. */
  ranking: PosicionAnualVenta[];
  /** El año del alcance dentro de ese ranking, cuando el alcance es un año comparable. */
  elegido: PosicionAnualVenta | null;
  posicion: number | null;
  /** Por qué el alcance no ocupa una posición (p. ej. "Todo el período" no es un año). */
  motivoElegido: string | null;
  /** Años fuera del ranking, cada uno con su razón. */
  excluidos: { anio: string; motivo: string }[];
  /** Años cuya tasa NO cubre el año calendario entero: la tasa vale, pero no cubre la misma porción del año que las demás. */
  recortados: { anio: string; dias: number; ventana: string }[];
  mediana: number | null;
};

export type EvolucionPorAlcance = {
  alcance: AlcanceVenta;
  dependencia: CalculoVenta<LecturaDependencia>;
  consistencia: CalculoVenta<LecturaConsistencia>;
  ritmo: CalculoVenta<LecturaRitmo>;
  calidad: CalculoVenta<LecturaCalidad>;
};

/**
 * Las cuatro sub-lecturas dentro de un alcance.
 *
 * `ttm` llega desde afuera a propósito: lo calcula `leerEvolucionDetallada`
 * sobre los meses cerrados de la serie entera, y recalcularlo acá una vez por
 * alcance duplicaría la regla de "qué mes se ve completo" en dos lugares. Una
 * regla escrita en dos lugares es una regla que en algún momento va a diferir.
 */
export function leerEvolucionPorAlcance(
  dataset: Dataset,
  serie: SerieVentas,
  alcance: AlcanceVenta,
  alcances: AlcanceVenta[],
  ttm: CalculoVenta<LecturaTtm>
): EvolucionPorAlcance {
  const ventas = ventasConfirmadas(dataset);
  const nombres = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const enVentana = (inicio: string, fin: string) =>
    ventas.filter((venta) => fecha(venta.fecha_venta) >= inicio && fecha(venta.fecha_venta) <= fin);
  const sumar = (lista: Venta[]) => dos(lista.reduce((total, venta) => total + montoOdoo(venta), 0));
  const mayorDe = (lista: Venta[]) => dos(Math.max(0, ...lista.map(montoOdoo)));

  // ── 1 · Dependencia de clientes ───────────────────────────────────────────
  // La concentración se mide SIEMPRE sobre el alcance entero, no sobre la
  // ventana comparable: la pregunta es de quién depende la venta de este
  // período, y recortarla a los días comparables contestaría otra cosa.
  // El crecimiento sin esas cuentas sí exige los dos lados, y por eso va
  // adentro con su propio CalculoVenta: puede haber concentración sin que haya
  // contra qué medir crecimiento — 2022 es exactamente ese caso.
  const dentro = enVentana(alcance.inicio, alcance.fin);
  let dependencia: CalculoVenta<LecturaDependencia>;
  if (dentro.length === 0) {
    dependencia = sinBase(
      `Entre el ${alcance.inicio} y el ${alcance.fin} no hay ningún pedido confirmado: no hay venta que repartir entre clientes.`
    );
  } else {
    const porCliente = new Map<string, { valor: number; pedidos: number }>();
    for (const venta of dentro) {
      const fila = porCliente.get(venta.id_cliente) ?? { valor: 0, pedidos: 0 };
      fila.valor += montoOdoo(venta);
      fila.pedidos += 1;
      porCliente.set(venta.id_cliente, fila);
    }
    const ordenados = [...porCliente.entries()].sort((a, b) => b[1].valor - a[1].valor);
    const cinco = ordenados.slice(0, 5);
    const excluidos = new Set(cinco.map(([id]) => id));
    const valorAlcance = sumar(dentro);
    const valorTop5 = dos(cinco.reduce((total, [, fila]) => total + fila.valor, 0));

    let crecimiento: CalculoVenta<CrecimientoSinTop5>;
    if (!alcance.comparable.dato) {
      crecimiento = sinBase(alcance.comparable.motivo);
    } else {
      const ventana = alcance.comparable.dato;
      const actuales = enVentana(ventana.inicio, ventana.fin);
      const previos = enVentana(ventana.inicioPrevio, ventana.finPrevio);
      const restoActual = actuales.filter((venta) => !excluidos.has(venta.id_cliente));
      const restoPrevio = previos.filter((venta) => !excluidos.has(venta.id_cliente));
      const valorActual = sumar(restoActual);
      const valorPrevio = sumar(restoPrevio);
      const mayorPedido = mayorDe(restoActual);
      const variacion = tasaVenta(valorActual, valorPrevio);
      const variacionSinMayor = tasaVenta(dos(valorActual - mayorPedido), valorPrevio);
      crecimiento =
        variacion === null || variacionSinMayor === null
          ? sinBase(
              `Fuera de esas cinco cuentas, ${ventana.inicioPrevio.slice(0, 4)} no registra venta en la ventana equivalente (${ventana.inicioPrevio} → ${ventana.finPrevio}): no hay base contra la cual medir al resto de la cartera.`
            )
          : conDato({
              etiqueta: ventana.etiqueta,
              actual: valorActual,
              previo: valorPrevio,
              variacion,
              variacionCompleta: tasaVenta(sumar(actuales), sumar(previos)),
              pedidos: restoActual.length,
              pedidosPrevio: restoPrevio.length,
              mayorPedido,
              variacionSinMayor,
              dias: ventana.dias,
            });
    }

    dependencia = conDato({
      clientes: cinco.map(([id, fila]) => ({ id, nombre: nombres.get(id) ?? id, valor: dos(fila.valor) })),
      valorTop5,
      valorAlcance,
      participacion: valorAlcance > 0 ? dos((valorTop5 / valorAlcance) * 100) : 0,
      participacionMayor: valorAlcance > 0 && cinco[0] ? dos((cinco[0][1].valor / valorAlcance) * 100) : 0,
      nombreMayor: cinco[0] ? nombres.get(cinco[0][0]) ?? cinco[0][0] : "—",
      clientesTotales: porCliente.size,
      pedidos: dentro.length,
      pedidosTop5: cinco.reduce((total, [, fila]) => total + fila.pedidos, 0),
      crecimiento,
    });
  }

  // ── 2 · Consistencia del crecimiento ──────────────────────────────────────
  // Sólo meses CERRADOS del alcance, cada uno contra su mismo mes del año
  // anterior, y sólo si ese mes anterior también se ve entero. Un mes cerrado
  // contra un mes truncado no mide negocio: mide cuántos días se observaron.
  const porMes = new Map<string, { valor: number; pedidos: number; mayor: number }>();
  for (const venta of ventas) {
    const periodo = fecha(venta.fecha_venta).slice(0, 7);
    const fila = porMes.get(periodo) ?? { valor: 0, pedidos: 0, mayor: 0 };
    const monto = montoOdoo(venta);
    fila.valor += monto;
    fila.pedidos += 1;
    if (monto > fila.mayor) fila.mayor = monto;
    porMes.set(periodo, fila);
  }
  const leerMes = (periodo: string) => porMes.get(periodo) ?? { valor: 0, pedidos: 0, mayor: 0 };
  const cerrados = new Set(serie.mesesCerrados.map((mes) => mes.periodo));
  const delAlcance = serie.mesesCerrados.filter(
    (mes) => mes.periodo >= alcance.inicio.slice(0, 7) && mes.periodo <= alcance.fin.slice(0, 7)
  );

  let consistencia: CalculoVenta<LecturaConsistencia>;
  if (delAlcance.length === 0) {
    consistencia = sinBase(
      `Dentro de ${alcance.etiqueta} no hay ningún mes calendario cerrado: todos sus meses están cortados por el inicio del histórico (${serie.desde}) o por el corte (${serie.corte}).`
    );
  } else {
    const pares: ParMesInteranual[] = delAlcance.map((mes) => {
      const fila = leerMes(mes.periodo);
      const anterior = mesDesplazado(mes.periodo, -12);
      const filaAnterior = leerMes(anterior);
      const previo = cerrados.has(anterior)
        ? { periodo: anterior, etiqueta: etiquetaMesVenta(anterior), valor: dos(filaAnterior.valor), pedidos: filaAnterior.pedidos }
        : null;
      return {
        periodo: mes.periodo,
        etiqueta: mes.etiqueta,
        valor: dos(fila.valor),
        pedidos: fila.pedidos,
        previo,
        variacion: previo ? tasaVenta(dos(fila.valor), previo.valor) : null,
        mayorPedido: dos(fila.mayor),
        pesoMayorPedido: fila.valor > 0 ? dos((fila.mayor / fila.valor) * 100) : 0,
      };
    });
    const conComparable = pares.filter((par) => par.variacion !== null);
    if (conComparable.length === 0) {
      consistencia = sinBase(
        `Ninguno de los ${pares.length} meses cerrados de ${alcance.etiqueta} tiene su mismo mes del año anterior cerrado dentro del histórico: compararlos enfrentaría un mes entero contra uno truncado.`
      );
    } else {
      const mayor = pares.reduce((a, b) => (b.mayorPedido > a.mayorPedido ? b : a));
      const mejor = conComparable.reduce((a, b) => ((b.variacion ?? 0) > (a.variacion ?? 0) ? b : a));
      const peor = conComparable.reduce((a, b) => ((b.variacion ?? 0) < (a.variacion ?? 0) ? b : a));
      consistencia = conDato({
        meses: pares,
        arriba: conComparable.filter((par) => (par.variacion ?? 0) > 0).length,
        conComparable: conComparable.length,
        sinComparable: pares.filter((par) => par.variacion === null),
        mejor,
        peor,
        pedidos: pares.reduce((total, par) => total + par.pedidos, 0),
        dominados: pares.filter((par) => par.pesoMayorPedido > 20),
        mayorPedido: mayor.mayorPedido > 0 ? { monto: mayor.mayorPedido, etiqueta: mayor.etiqueta } : null,
        arribaSinMayor: conComparable.filter((par) => {
          if (!par.previo) return false;
          const valor = par.periodo === mayor.periodo ? dos(par.valor - mayor.mayorPedido) : par.valor;
          return valor > par.previo.valor;
        }).length,
      });
    }
  }

  // ── 3 · Ritmo ─────────────────────────────────────────────────────────────
  // Dos formas distintas porque son dos preguntas distintas. Sobre todo el
  // período la pregunta es a qué nivel corre el negocio hoy, y eso lo contesta
  // el TTM: doce meses de un lado y doce del otro, así que la estacionalidad se
  // cancela por construcción. Sobre un año concreto la pregunta es cuánto
  // creció ESE año, y eso se contesta con su ventana equivalente contra el año
  // anterior — la misma que ya resolvió el alcance, no una nueva.
  const ritmoAnual = (ventana: VentanaComparableVenta): CalculoVenta<RitmoAnualVenta> => {
    const actuales = enVentana(ventana.inicio, ventana.fin);
    const previos = enVentana(ventana.inicioPrevio, ventana.finPrevio);
    const valorActual = sumar(actuales);
    const valorPrevio = sumar(previos);
    const mayorPedido = mayorDe(actuales);
    const variacion = tasaVenta(valorActual, valorPrevio);
    const variacionSinMayor = tasaVenta(dos(valorActual - mayorPedido), valorPrevio);
    if (variacion === null || variacionSinMayor === null) {
      return sinBase(
        `${ventana.inicioPrevio.slice(0, 4)} no registra venta entre el ${ventana.inicioPrevio} y el ${ventana.finPrevio}: sin base positiva no hay porcentaje de crecimiento que mostrar.`
      );
    }
    return conDato({
      ventana,
      actual: valorActual,
      previo: valorPrevio,
      variacion,
      pedidos: actuales.length,
      pedidosPrevio: previos.length,
      mayorPedido,
      variacionSinMayor,
    });
  };

  let ritmo: CalculoVenta<LecturaRitmo>;
  if (alcance.anio === null) {
    ritmo = ttm.dato ? conDato<LecturaRitmo>({ tipo: "ttm", ttm: ttm.dato }) : sinBase(ttm.motivo);
  } else if (!alcance.comparable.dato) {
    ritmo = sinBase(alcance.comparable.motivo);
  } else {
    const anual = ritmoAnual(alcance.comparable.dato);
    ritmo = anual.dato ? conDato<LecturaRitmo>({ tipo: "anual", anio: alcance.anio, anual: anual.dato }) : sinBase(anual.motivo);
  }

  // ── 4 · Calidad del alcance contra la historia de la empresa ──────────────
  // Cada año se mide contra el anterior sobre SU propia ventana equivalente, y
  // recién esas tasas se ordenan. Los años sin ventana quedan FUERA del ranking
  // con su motivo escrito: no se los manda al último puesto, porque eso
  // afirmaría que crecieron poco y lo que pasa es que no se sabe.
  const posiciones: PosicionAnualVenta[] = [];
  const excluidos: { anio: string; motivo: string }[] = [];
  for (const otro of alcances) {
    if (otro.anio === null) continue;
    if (!otro.comparable.dato) {
      excluidos.push({ anio: otro.anio, motivo: otro.comparable.motivo });
      continue;
    }
    const calculo = ritmoAnual(otro.comparable.dato);
    if (!calculo.dato) {
      excluidos.push({ anio: otro.anio, motivo: calculo.motivo });
      continue;
    }
    posiciones.push({
      anio: otro.anio,
      tasa: calculo.dato.variacion,
      valor: calculo.dato.actual,
      previo: calculo.dato.previo,
      pedidos: calculo.dato.pedidos,
      ventana: otro.comparable.dato,
    });
  }
  const ranking = posiciones.slice().sort((a, b) => b.tasa - a.tasa);
  let calidad: CalculoVenta<LecturaCalidad>;
  if (ranking.length === 0) {
    calidad = sinBase(
      `Ningún año del histórico tiene una ventana equivalente del año anterior contra la cual medirse: sin al menos una tasa comparable no hay historia de la empresa donde ubicar a ${alcance.etiqueta}.`
    );
  } else {
    const elegido = alcance.anio ? ranking.find((fila) => fila.anio === alcance.anio) ?? null : null;
    const indice = elegido ? ranking.indexOf(elegido) : -1;
    calidad = conDato({
      ranking,
      elegido,
      posicion: indice >= 0 ? indice + 1 : null,
      motivoElegido:
        elegido !== null
          ? null
          : alcance.anio === null
            ? "«Todo el período» no es un año: no ocupa un puesto en un ranking de años. Lo que se muestra es el ranking completo, con el año líder arriba."
            : excluidos.find((fila) => fila.anio === alcance.anio)?.motivo ??
              `${alcance.anio} no tiene tasa comparable y por eso no ocupa un puesto.`,
      excluidos,
      recortados: ranking
        .filter((fila) => fila.ventana.recortada)
        .map((fila) => ({
          anio: fila.anio,
          dias: fila.ventana.dias,
          ventana: `${fila.ventana.inicio.slice(5)} → ${fila.ventana.fin.slice(5)}`,
        })),
      mediana: mediana(ranking.map((fila) => fila.tasa)),
    });
  }

  return { alcance, dependencia, consistencia, ritmo, calidad };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTACIONALIDAD MES × AÑO
//
// Compara el MISMO mes entre todos los años: enero de 2023 contra enero de 2024
// contra enero de 2025… Es la única forma de separar "vendimos más" de "llegó
// la temporada", y por eso las casillas que faltan son el punto delicado.
//
// 2022 sólo tiene ago-dic y 2026 sólo ene-ago. Esas casillas NO valen cero:
// valen "no observado". Un cero dibujado ahí se lee como "ese mes no vendimos"
// y hundiría el promedio de enero con un enero de 2022 que nunca existió en los
// datos. Se distinguen tres estados, y los tres se dicen:
//   · observado completo → barra normal, entra en promedios y en el mejor año
//   · observado parcial  → barra rayada, con lo que le falta; fuera de promedios
//   · no observado       → hueco marcado "sin dato", sin barra y sin número
// ─────────────────────────────────────────────────────────────────────────────

export type CeldaEstacionalVenta = {
  anio: string;
  periodo: string;
  observado: boolean;
  parcial: boolean;
  /** null SÓLO cuando el mes no fue observado. Un mes observado sin venta vale 0. */
  valor: number | null;
  pedidos: number;
  /** 0-100 sobre el máximo de toda la matriz. 0 cuando no hay dato. */
  alto: number;
  /** Siempre una frase: por qué falta, qué le falta, o que está completo. */
  nota: string;
};

export type FilaEstacionalVenta = {
  mes: number;
  etiqueta: string;
  celdas: CeldaEstacionalVenta[];
  /** Cuántos años observaron este mes entero. Es la base de cualquier promedio. */
  completos: number;
  sinDato: number;
  mejor: { anio: string; valor: number } | null;
  /** Media de los años que observaron el mes ENTERO. null si no hay ninguno. */
  promedioCompletos: number | null;
};

export type EstacionalidadVenta = {
  anios: string[];
  filas: FilaEstacionalVenta[];
  maximo: number;
  celdasSinDato: number;
  celdasParciales: number;
  /** El mes más fuerte y el más flojo, sobre meses observados enteros. */
  mesFuerte: FilaEstacionalVenta | null;
  mesFlojo: FilaEstacionalVenta | null;
  nota: string;
};

export function leerEstacionalidadVenta(serie: SerieVentas): EstacionalidadVenta {
  const desde = serie.desde;
  const corte = serie.corte;
  const anios = serie.anios.map((punto) => punto.anio);
  if (!desde || !corte || anios.length === 0) {
    return { anios: [], filas: [], maximo: 0, celdasSinDato: 0, celdasParciales: 0, mesFuerte: null, mesFlojo: null, nota: "Sin histórico observado." };
  }
  const porPeriodo = new Map(serie.meses.map((mes) => [mes.periodo, mes]));
  // El máximo sale de los meses OBSERVADOS. Un mes ausente no puede empujar la
  // escala hacia abajo entrando como cero, y uno parcial se dibuja con lo que
  // realmente lleva vendido — marcado, para que su barra corta no se lea como
  // una caída del negocio.
  const maximo = Math.max(0, ...serie.meses.map((mes) => mes.valor));

  let celdasSinDato = 0;
  let celdasParciales = 0;
  const filas: FilaEstacionalVenta[] = [];
  for (let mes = 1; mes <= 12; mes += 1) {
    const mm = String(mes).padStart(2, "0");
    const celdas: CeldaEstacionalVenta[] = anios.map((anio) => {
      const periodo = `${anio}-${mm}`;
      const primerDia = `${periodo}-01`;
      const ultimoDia = ultimoDiaDelMes(Number(anio), mes);
      const observado = ultimoDia >= desde && primerDia <= corte;
      if (!observado) {
        celdasSinDato += 1;
        return {
          anio,
          periodo,
          observado: false,
          parcial: false,
          valor: null,
          pedidos: 0,
          alto: 0,
          nota:
            primerDia > corte
              ? `sin dato · ${etiquetaMesVenta(periodo)} es posterior al corte ${corte}`
              : `sin dato · ${etiquetaMesVenta(periodo)} es anterior al inicio del histórico ${desde}`,
        };
      }
      const punto = porPeriodo.get(periodo);
      const parcial = punto ? punto.parcial : primerDia < desde || ultimoDia > corte;
      if (parcial) celdasParciales += 1;
      const valor = punto?.valor ?? 0;
      return {
        anio,
        periodo,
        observado: true,
        parcial,
        valor,
        pedidos: punto?.pedidos ?? 0,
        alto: maximo > 0 ? Math.max((valor / maximo) * 100, valor > 0 ? 2 : 0) : 0,
        nota: parcial
          ? `PARCIAL · ${punto?.razonParcial ?? `de ${etiquetaMesVenta(periodo)} sólo se observa una parte`}: no se compara contra un mes entero`
          : punto
            ? `mes completo · ${punto.pedidos} pedidos`
            : "mes completo observado, sin ningún pedido confirmado",
      };
    });
    const completos = celdas.filter((celda) => celda.observado && !celda.parcial);
    const lider = completos.length > 0 ? completos.reduce((a, b) => ((b.valor ?? 0) > (a.valor ?? 0) ? b : a)) : null;
    filas.push({
      mes,
      etiqueta: MESES_CORTOS[mes - 1],
      celdas,
      completos: completos.length,
      sinDato: celdas.filter((celda) => !celda.observado).length,
      mejor: lider ? { anio: lider.anio, valor: lider.valor ?? 0 } : null,
      promedioCompletos:
        completos.length > 0 ? dos(completos.reduce((total, celda) => total + (celda.valor ?? 0), 0) / completos.length) : null,
    });
  }

  const conPromedio = filas.filter((fila) => fila.promedioCompletos !== null);
  return {
    anios,
    filas,
    maximo,
    celdasSinDato,
    celdasParciales,
    mesFuerte: conPromedio.length > 0 ? conPromedio.reduce((a, b) => ((b.promedioCompletos ?? 0) > (a.promedioCompletos ?? 0) ? b : a)) : null,
    mesFlojo: conPromedio.length > 0 ? conPromedio.reduce((a, b) => ((b.promedioCompletos ?? 0) < (a.promedioCompletos ?? 0) ? b : a)) : null,
    nota: `${celdasSinDato} de las ${12 * anios.length} casillas no se observaron y quedan vacías: ${anios[0]} arranca el ${desde} y ${anios.at(-1)} se corta el ${corte}. Una casilla vacía NO es un cero — dibujarla en cero diría que ese mes no se vendió, y lo que pasa es que no hay dato.`,
  };
}
