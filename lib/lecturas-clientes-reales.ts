import { construirLecturasProductoVentas } from "./agentes-producto-ventas";
import type { Dataset, Venta } from "./types";

/**
 * LECTURAS DE CLIENTES — el hermano de `lecturas-ventas-reales.ts`.
 * ===========================================================================
 * Mismas convenciones que aquél, a propósito: dos decimales con `dos()`, día
 * con `fecha()`, universo con `ventasConfirmadas()` y monto con `montoOdoo()`.
 * Si las dos páginas leyeran el mismo hecho con dos reglas distintas, la
 * diferencia no se vería: se leería como negocio.
 *
 * ── LAS CAPAS, QUE NUNCA SE SUMAN ENTRE SÍ ──────────────────────────────────
 *   venta confirmada   `ventas.total_odoo_referencia` de los pedidos "sale".
 *                      Es la ÚNICA que es facturación. IVA 12% incluido.
 *   composición        Σ(cantidad × precio de lista) de las líneas. Sirve para
 *                      responder "qué compra"; NO es facturación.
 *
 * La tercera capa —cartera CxC— NO se lee acá. Contrato v2: `saldos_odoo`, la
 * fuente que sostiene cartera bruta, saldo a favor y neta, no forma parte del
 * dataset comercial de Clientes. Sumar saldos de factura y presentarlos como
 * un cálculo de esta pantalla sería dar por medido algo que no se midió acá;
 * la cartera vive en /aging, con su fuente y su corte.
 *
 * ── EL CORTE SE DERIVA, NUNCA SE ESCRIBE ────────────────────────────────────
 * `corte = max(fecha_venta)` sobre pedidos confirmados. Si el import cambia,
 * el corte cambia solo. Un corte escrito a mano sobrevive al dato que lo
 * justificaba y nadie lo nota.
 *
 * ── LÍMITE ESTRUCTURAL QUE NO SE ESCONDE ────────────────────────────────────
 * `id_cliente` se genera con `idClienteDesdeNombre()` (hash del nombre
 * normalizado). O sea: la identidad del cliente ES el nombre. Dos variantes de
 * la misma razón social ("X, SOCIEDAD ANONIMA" y "X, AG") son dos clientes
 * distintos para este snapshot. Eso INFLA el conteo de clientes y DESINFLA la
 * frecuencia por cliente. `variantesDeNombre` mide ese efecto en vez de
 * dejarlo como advertencia genérica.
 */

// ── Convenciones compartidas con lecturas-ventas-reales.ts ──────────────────

const dos = (valor: number) => Math.round(valor * 100) / 100;
const fecha = (valor: string) => valor.slice(0, 10);
const montoOdoo = (venta: Venta) => venta.total_referencia?.valorParaMostrar() ?? 0;
const ventasConfirmadas = (dataset: Dataset) =>
  (dataset.ventas ?? []).filter((venta) => venta.estado_odoo === "sale");

const DIA_EN_MS = 86400000;
const diaDe = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const ultimoDiaDelMes = (anio: number, mes: number) => isoDe(new Date(Date.UTC(anio, mes, 0)));
const diasEntre = (desde: string, hasta: string) =>
  Math.round((diaDe(hasta).getTime() - diaDe(desde).getTime()) / DIA_EN_MS);

/**
 * Mediana, NUNCA promedio. El promedio de pedidos por cliente lo arrastran las
 * cuentas grandes y termina describiendo a un cliente que no existe.
 */
function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return dos(orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2);
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-08" → "ago 26". Una sola forma de nombrar un mes en toda la página. */
export function etiquetaMesCliente(clave: string) {
  const [anio, mes] = clave.split("-");
  return `${MESES_CORTOS[Number(mes) - 1] ?? mes} ${anio.slice(2)}`;
}

// ── Tipos de la lectura ─────────────────────────────────────────────────────

/** Un cliente observado sobre una ventana. `dias` es recencia CONTRA EL CORTE. */
export type FilaClienteReal = {
  id: string;
  etiqueta: string;
  pedidos: number;
  valor: number;
  primera: string | null;
  ultima: string | null;
  dias: number | null;
};

/** Una ventana de días leída completa. */
export type VentanaClientes = {
  etiqueta: string;
  inicio: string;
  fin: string;
  /** Días corridos de la ventana, ambos extremos incluidos. */
  dias: number;
  valor: number;
  pedidos: number;
  compradores: number;
  /** Clientes con 2 o más pedidos DENTRO de la ventana. */
  recurrentes: number;
  /** Clientes con exactamente 1 pedido dentro de la ventana. */
  unaCompra: number;
  /**
   * Clientes cuya PRIMERA compra de todo el histórico cae dentro de la ventana.
   * Se llama "primera compra registrada", jamás "cliente nuevo": el snapshot no
   * trae fecha de alta real, así que un cliente dado de alta hace años que
   * compró por primera vez este año entra acá y NO es nuevo.
   */
  primeraCompraRegistrada: number;
  /** MEDIANA de pedidos por cliente dentro de la ventana. */
  medianaPedidos: number;
  /** MEDIANA del importe por pedido dentro de la ventana. */
  ticketMediano: number;
  /** Clientes de la ventana, mayor valor primero. */
  clientes: FilaClienteReal[];
};

export type ClaveRecenciaReal = "0-30" | "31-60" | "61-90" | "90+";
export type TramoRecenciaReal = {
  clave: ClaveRecenciaReal;
  etiqueta: string;
  /** Clientes del tramo, mayor valor histórico primero. */
  filas: FilaClienteReal[];
  /** Venta histórica acumulada de los clientes del tramo. */
  valor: number;
};

export type ClaveConcentracionReal = "top1" | "top5" | "top10" | "top20" | "top50";
export type CorteConcentracionReal = {
  clave: ClaveConcentracionReal;
  etiqueta: string;
  n: number;
  valor: number;
  /** Participación sobre la venta TOTAL del período. Nunca sobre el subconjunto. */
  pct: number;
  filas: FilaClienteReal[];
};

export type PuntoMesClientes = {
  /** "2026-08". */
  clave: string;
  etiqueta: string;
  anio: string;
  clientes: number;
  pedidos: number;
  valor: number;
  /** El mes no se ve entero: el histórico arranca a mitad, o el corte lo cortó. */
  parcial: boolean;
  nota: string | null;
};

export type FilaComposicionReal = {
  etiqueta: string;
  unidades: number;
  valor: number;
  pedidos: number;
};

export type PedidoCeroReal = { id: string; cliente: string; fecha: string };

export type LecturasClientes = {
  /** Primer día con venta confirmada. */
  desde: string | null;
  /** DERIVADO: max(fecha_venta) de los pedidos confirmados. */
  corte: string | null;
  pedidosConfirmados: number;
  clientesHistoricos: number;
  totalHistorico: number;
  /** Todos los clientes con venta histórica, mayor valor primero. */
  historico: FilaClienteReal[];
  medianaPedidosHistorico: number;
  ticketMedianoHistorico: number;
  /** Clientes con exactamente UN pedido en todo el histórico. */
  unaSolaCompraHistorica: FilaClienteReal[];
  ytd: VentanaClientes | null;
  comparable: VentanaClientes | null;
  variacion: { valor: number | null; pedidos: number | null; compradores: number | null };
  recencia: TramoRecenciaReal[];
  concentracion: CorteConcentracionReal[];
  /** Cuántos clientes hacen falta para juntar la mitad de la venta YTD. */
  clientesParaMitadYtd: number;
  meses: PuntoMesClientes[];
  composicion: {
    filas: FilaComposicionReal[];
    /** % de la composición con familia identificada. NO es cobertura de venta. */
    coberturaFamilia: number;
  };
  /** Pedidos confirmados con total Q0.00. Se listan, no se descartan. */
  pedidosCero: PedidoCeroReal[];
  /** Clientes del Top 50 histórico con más de 90 días sin comprar. */
  detenidosAltoValor: FilaClienteReal[];
  /**
   * Nombres distintos que normalizan a la misma raíz comercial. Mide el efecto
   * de que la identidad del cliente se derive del nombre.
   */
  variantesDeNombre: { raiz: string; nombres: string[] }[];
};

// ── Motor ───────────────────────────────────────────────────────────────────

type Movimiento = { id: string; cliente: string; dia: string; monto: number };

function acumularClientes(
  movimientos: Movimiento[],
  nombre: (id: string) => string,
  corte: string
): FilaClienteReal[] {
  const mapa = new Map<string, FilaClienteReal>();
  for (const mov of movimientos) {
    const fila = mapa.get(mov.cliente) ?? {
      id: mov.cliente,
      etiqueta: nombre(mov.cliente),
      pedidos: 0,
      valor: 0,
      primera: null,
      ultima: null,
      dias: null,
    };
    fila.pedidos += 1;
    fila.valor += mov.monto;
    if (!fila.primera || mov.dia < fila.primera) fila.primera = mov.dia;
    if (!fila.ultima || mov.dia > fila.ultima) fila.ultima = mov.dia;
    mapa.set(mov.cliente, fila);
  }
  return [...mapa.values()]
    .map((fila) => ({
      ...fila,
      valor: dos(fila.valor),
      dias: fila.ultima ? diasEntre(fila.ultima, corte) : null,
    }))
    .sort((a, b) => b.valor - a.valor);
}

function leerVentana(
  movimientos: Movimiento[],
  primeraCompraHistorica: Map<string, string>,
  nombre: (id: string) => string,
  corte: string,
  inicio: string,
  fin: string,
  etiqueta: string
): VentanaClientes {
  const dentro = movimientos.filter((mov) => mov.dia >= inicio && mov.dia <= fin);
  const clientes = acumularClientes(dentro, nombre, corte);
  return {
    etiqueta,
    inicio,
    fin,
    dias: diasEntre(inicio, fin) + 1,
    valor: dos(dentro.reduce((suma, mov) => suma + mov.monto, 0)),
    pedidos: dentro.length,
    compradores: clientes.length,
    recurrentes: clientes.filter((cliente) => cliente.pedidos >= 2).length,
    unaCompra: clientes.filter((cliente) => cliente.pedidos === 1).length,
    primeraCompraRegistrada: clientes.filter((cliente) => {
      const primera = primeraCompraHistorica.get(cliente.id);
      return primera !== undefined && primera >= inicio && primera <= fin;
    }).length,
    medianaPedidos: mediana(clientes.map((cliente) => cliente.pedidos)),
    ticketMediano: mediana(dentro.map((mov) => mov.monto)),
    clientes,
  };
}

/**
 * Raíz comercial de un nombre: sin acentos, sin puntuación y sin las formas
 * societarias que cambian entre exports. Es una HEURÍSTICA declarada, no una
 * deduplicación: no fusiona nada, sólo hace visible cuántas variantes hay.
 */
function raizComercial(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\b(SOCIEDAD ANONIMA|S DE RL|SA DE CV|LTDA|SRL|CIA|AG|SA|GT)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CORTES_CONCENTRACION: { clave: ClaveConcentracionReal; n: number }[] = [
  { clave: "top1", n: 1 },
  { clave: "top5", n: 5 },
  { clave: "top10", n: 10 },
  { clave: "top20", n: 20 },
  { clave: "top50", n: 50 },
];

const TRAMOS: { clave: ClaveRecenciaReal; etiqueta: string; min: number; max: number | null }[] = [
  { clave: "0-30", etiqueta: "0 a 30 días", min: 0, max: 30 },
  { clave: "31-60", etiqueta: "31 a 60 días", min: 31, max: 60 },
  { clave: "61-90", etiqueta: "61 a 90 días", min: 61, max: 90 },
  { clave: "90+", etiqueta: "Más de 90 días", min: 91, max: null },
];

const VACIO: LecturasClientes = {
  desde: null,
  corte: null,
  pedidosConfirmados: 0,
  clientesHistoricos: 0,
  totalHistorico: 0,
  historico: [],
  medianaPedidosHistorico: 0,
  ticketMedianoHistorico: 0,
  unaSolaCompraHistorica: [],
  ytd: null,
  comparable: null,
  variacion: { valor: null, pedidos: null, compradores: null },
  recencia: [],
  concentracion: [],
  clientesParaMitadYtd: 0,
  meses: [],
  composicion: { filas: [], coberturaFamilia: 0 },
  pedidosCero: [],
  detenidosAltoValor: [],
  variantesDeNombre: [],
};

const lecturaPorDataset = new WeakMap<Dataset, LecturasClientes>();

/**
 * Lectura única de la página de Clientes. Los cuatro agentes y los siete
 * paneles B18 se derivan de acá; nada se vuelve a calcular por separado.
 */
export function leerClientesReales(dataset: Dataset): LecturasClientes {
  const enCache = lecturaPorDataset.get(dataset);
  if (enCache) return enCache;

  const ventas = ventasConfirmadas(dataset);
  if (ventas.length === 0) return VACIO;

  const nombres = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const nombre = (id: string) => nombres.get(id) ?? id;

  const movimientos: Movimiento[] = ventas
    .map((venta) => ({
      id: venta.id_venta,
      cliente: venta.id_cliente,
      dia: fecha(venta.fecha_venta),
      monto: montoOdoo(venta),
    }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const desde = movimientos[0].dia;
  // EL CORTE SE DERIVA. Última venta confirmada del snapshot, nunca a mano.
  const corte = movimientos[movimientos.length - 1].dia;

  const historico = acumularClientes(movimientos, nombre, corte);
  const totalHistorico = dos(movimientos.reduce((suma, mov) => suma + mov.monto, 0));
  const primeraCompraHistorica = new Map(historico.map((fila) => [fila.id, fila.primera ?? corte]));

  // ── Ventana YTD y su comparable: mismo mes y día del año anterior ─────────
  const anioCorte = corte.slice(0, 4);
  const anioPrevio = String(Number(anioCorte) - 1);
  const ytd = leerVentana(
    movimientos,
    primeraCompraHistorica,
    nombre,
    corte,
    `${anioCorte}-01-01`,
    corte,
    `${anioCorte} · 1 ene → ${corte}`
  );
  const finPrevio = `${anioPrevio}${corte.slice(4)}`;
  const comparable = leerVentana(
    movimientos,
    primeraCompraHistorica,
    nombre,
    corte,
    `${anioPrevio}-01-01`,
    finPrevio,
    `${anioPrevio} · 1 ene → ${finPrevio}`
  );
  const variar = (hoy: number, antes: number) => (antes > 0 ? dos((hoy / antes - 1) * 100) : null);

  // ── Recencia: días entre la última compra y el corte ──────────────────────
  const recencia: TramoRecenciaReal[] = TRAMOS.map((tramo) => {
    const filas = historico.filter(
      (fila) => fila.dias !== null && fila.dias >= tramo.min && (tramo.max === null || fila.dias <= tramo.max)
    );
    return {
      clave: tramo.clave,
      etiqueta: tramo.etiqueta,
      filas,
      valor: dos(filas.reduce((suma, fila) => suma + fila.valor, 0)),
    };
  });

  // ── Concentración: el denominador es SIEMPRE la venta total del período ───
  const concentracion: CorteConcentracionReal[] = CORTES_CONCENTRACION.filter(
    (nivel) => nivel.n <= ytd.clientes.length
  ).map((nivel) => {
    const filas = ytd.clientes.slice(0, nivel.n);
    const valor = dos(filas.reduce((suma, fila) => suma + fila.valor, 0));
    return {
      clave: nivel.clave,
      etiqueta: `Top ${nivel.n}`,
      n: nivel.n,
      valor,
      pct: ytd.valor > 0 ? dos((valor / ytd.valor) * 100) : 0,
      filas,
    };
  });

  let acumulado = 0;
  let clientesParaMitadYtd = 0;
  for (const cliente of ytd.clientes) {
    if (acumulado >= ytd.valor / 2) break;
    acumulado += cliente.valor;
    clientesParaMitadYtd += 1;
  }

  // ── Serie mensual. Un mes se marca parcial cuando la VENTANA no lo cubre ──
  const acumMes = new Map<string, { valor: number; pedidos: number; clientes: Set<string> }>();
  for (const mov of movimientos) {
    const clave = mov.dia.slice(0, 7);
    const fila = acumMes.get(clave) ?? { valor: 0, pedidos: 0, clientes: new Set<string>() };
    fila.valor += mov.monto;
    fila.pedidos += 1;
    fila.clientes.add(mov.cliente);
    acumMes.set(clave, fila);
  }
  const meses: PuntoMesClientes[] = [...acumMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([clave, fila]) => {
      const cierre = ultimoDiaDelMes(Number(clave.slice(0, 4)), Number(clave.slice(5, 7)));
      const cortado = clave === corte.slice(0, 7) && corte < cierre;
      const truncado = clave === desde.slice(0, 7) && desde > `${clave}-01`;
      return {
        clave,
        etiqueta: etiquetaMesCliente(clave),
        anio: clave.slice(0, 4),
        clientes: fila.clientes.size,
        pedidos: fila.pedidos,
        valor: dos(fila.valor),
        parcial: cortado || truncado,
        nota: cortado
          ? `Mes en curso al corte ${corte}. No comparable contra un mes cerrado.`
          : truncado
            ? `Mes incompleto: el snapshot arranca el ${desde}, no el 1.`
            : null,
      };
    });

  // ── Composición de líneas. CAPA DISTINTA: qué compra, no cuánto facturó ───
  // Se reutiliza el clasificador único del proyecto en vez de escribir otro:
  // dos clasificadores con reglas parecidas divergen en silencio.
  const familia = construirLecturasProductoVentas(dataset).familia;
  const composicion = {
    filas: familia.filas.map((fila) => ({
      etiqueta: fila.nombre,
      unidades: fila.unidades,
      valor: fila.valor,
      pedidos: fila.pedidos,
    })),
    coberturaFamilia: familia.cobertura,
  };

  // ── Pedidos en Q0.00: se listan, no se descartan ──────────────────────────
  const pedidosCero: PedidoCeroReal[] = movimientos
    .filter((mov) => mov.monto === 0)
    .map((mov) => ({ id: mov.id, cliente: nombre(mov.cliente), fecha: mov.dia }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const detenidosAltoValor = historico
    .slice(0, 50)
    .filter((fila) => fila.dias !== null && fila.dias > 90);

  // ── Identidad derivada del nombre: se mide, no se advierte en abstracto ───
  const porRaiz = new Map<string, string[]>();
  for (const fila of historico) {
    const raiz = raizComercial(fila.etiqueta);
    porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), fila.etiqueta]);
  }
  const variantesDeNombre = [...porRaiz.entries()]
    .filter(([, lista]) => lista.length > 1)
    .map(([raiz, lista]) => ({ raiz, nombres: [...lista].sort() }))
    .sort((a, b) => a.raiz.localeCompare(b.raiz));

  const lectura: LecturasClientes = {
    desde,
    corte,
    pedidosConfirmados: movimientos.length,
    clientesHistoricos: historico.length,
    totalHistorico,
    historico,
    medianaPedidosHistorico: mediana(historico.map((fila) => fila.pedidos)),
    ticketMedianoHistorico: mediana(movimientos.map((mov) => mov.monto)),
    unaSolaCompraHistorica: historico.filter((fila) => fila.pedidos === 1),
    ytd,
    comparable,
    variacion: {
      valor: variar(ytd.valor, comparable.valor),
      pedidos: variar(ytd.pedidos, comparable.pedidos),
      compradores: variar(ytd.compradores, comparable.compradores),
    },
    recencia,
    concentracion,
    clientesParaMitadYtd,
    meses,
    composicion,
    pedidosCero,
    detenidosAltoValor,
    variantesDeNombre,
  };
  lecturaPorDataset.set(dataset, lectura);
  return lectura;
}
