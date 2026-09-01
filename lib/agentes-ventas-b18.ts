import {
  etiquetaMesVenta,
  leerSerieVentas,
  type ComparativoYtdVenta,
  type PuntoAnualVenta,
  type PuntoMesVenta,
  type SerieVentas,
} from "./lecturas-ventas-reales";
import type { Dataset } from "./types";

/**
 * Adaptador de lectura para el mapa B18 de Ventas.
 *
 * ── DECISIÓN DE CAPA (no se discute acá) ────────────────────────────────────
 * Toda la página lee `amount_total` de sale.order — el total que Odoo cerró,
 * CON el IVA del 12% incluido y con el descuento ya aplicado. No se convierte,
 * no se le resta impuesto y no se mezcla con la composición de líneas
 * (cantidad × precio_unitario). Esa otra capa da Q26.16M contra Q19.29M reales
 * y vive en /ventas/productos, no acá.
 *
 * ── LOS CUATRO AGENTES CONTESTAN UNA SOLA PREGUNTA ──────────────────────────
 * De dónde viene el crecimiento. La venta comparable se mueve un %, y ese % se
 * descompone en clientes × frecuencia × ticket. Cada agente sostiene un factor
 * de esa identidad; ninguno es un indicador suelto.
 *
 * PORTAFOLIO NO ES UN AGENTE DE VENTAS. La composición por familia/modelo es
 * otra capa y otra página: acá sólo queda un enlace contextual.
 *
 * Nada está escrito a mano: series, picos, variaciones y coberturas salen de
 * `leerSerieVentas`, que a su vez sale de los pedidos en estado "sale".
 */

export type AgenteVentasB18 = "venta" | "pedidos" | "clientes" | "ticket";
export type SlotVentasB18 = "detecta" | "explica" | "prioriza" | "recomienda";

/** Una barra de serie, anual o mensual. `ancho` es 0-100 sobre el máximo de su serie. */
export type BarraSerieB18 = {
  clave: string;
  etiqueta: string;
  valor: number;
  texto: string;
  ancho: number;
  parcial: boolean;
  nota: string | null;
  detalle: string;
};

export type PicoSerieB18 = { etiqueta: string; texto: string; nota: string } | null;
export type MetricaVentasB18 = { valor: string; etiqueta: string };
export type BarraComparativa = { etiqueta: string; texto: string; ancho: number };
export type ComparativoVentasB18 = {
  titulo: string;
  delta: string;
  actual: BarraComparativa;
  previo: BarraComparativa;
};

export type LecturaAgenteVentasB18 = {
  id: AgenteVentasB18;
  slot: SlotVentasB18;
  iniciales: string;
  nombre: string;
  titulo: string;
  color: string;
  /** UNA línea. El agente lateral no explica: señala. */
  senal: string;
  pregunta: string;
  kpi: string;
  kpiEtiqueta: string;
  /** Micrográfico de la tarjeta lateral: la serie anual, normalizada 0-100. */
  micro: { etiqueta: string; alto: number; parcial: boolean }[];
  anual: BarraSerieB18[];
  mensual: BarraSerieB18[];
  picoAnual: PicoSerieB18;
  picoMensual: PicoSerieB18;
  comparativo: ComparativoVentasB18;
  metricas: MetricaVentasB18[];
  hallazgo: string;
  problema: string;
  accion: string;
  formula: string;
  fuente: string;
  periodo: string;
  capa: string;
  limite: string;
  cobertura: number;
  /**
   * CÓMO SE LLAMA ese porcentaje. No todos son "cobertura de datos": tres de
   * los cuatro miden qué parte del período se observa entera, pero el de Ticket
   * mide DISPERSIÓN (mediana sobre promedio) y llamarlo cobertura hacía leer
   * "37.91% de los datos" donde en realidad dice "la mediana es el 37.91% del
   * promedio". Cada agente nombra su propia métrica.
   */
  coberturaNombre: string;
  coberturaEtiqueta: string;
  /** Qué significa esa cobertura. Nunca "hay algún dato": qué tan confiable es. */
  coberturaExplicacion: string;
  /**
   * Límite estructural que NO se ve en la cifra y que hay que mostrar al lado
   * de ella, no en un pie de página. Hoy sólo Clientes lo tiene: la identidad
   * del cliente es derivada, así que el conteo puede estar inflado.
   */
  notaIdentidad: { titulo: string; texto: string; casos: string[] } | null;
};

/** Un factor de la descomposición del crecimiento. */
export type FactorCrecimiento = {
  id: AgenteVentasB18;
  etiqueta: string;
  delta: string;
  valor: number | null;
  detalle: string;
  color: string;
};

export type MapaVentasB18 = {
  serie: SerieVentas;
  ytd: ComparativoYtdVenta | null;
  agentes: LecturaAgenteVentasB18[];
  /** Serie anual completa, para el gráfico de barras del B18. */
  anios: PuntoAnualVenta[];
  /** Meses agrupados por año, para el desglose que abre al pulsar una barra. */
  mesesPorAnio: Record<string, PuntoMesVenta[]>;
  corte: string;
  fuente: string;
  moneda: string;
  capa: string;
  /** Rótulo obligatorio en toda la página. */
  declaracion: string;
  /**
   * Años cuya suma NO es un total en quetzales porque incluyen un pedido
   * registrado en otra moneda que no se convierte. Derivado de la serie, no
   * escrito a mano: si el import cambia, el aviso cambia o desaparece.
   */
  avisoMoneda: string | null;
  historia: {
    titulo: string;
    resultado: string;
    factores: FactorCrecimiento[];
    /** Diferencia entre el % de venta y el producto de los tres factores, en pp. */
    residuo: string;
  };
  enlaceProductos: { texto: string; href: string };
};

const dos = (valor: number) => Math.round(valor * 100) / 100;
const pct = (valor: number) => `${valor.toFixed(2)}%`;
const firmado = (valor: number | null) => (valor === null ? "sin base" : `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}%`);
const entero = (valor: number) => valor.toLocaleString("es-GT", { maximumFractionDigits: 0 });
const decimal = (valor: number) => valor.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ancho = (valor: number, maximo: number) => (maximo > 0 ? Math.max(3, Math.min(100, (valor / maximo) * 100)) : 3);

type Magnitud = "valor" | "pedidos" | "clientes" | "ticket";

/** Qué mide cada agente sobre un punto de la serie. Una sola tabla, sin ramas sueltas. */
const LEE: Record<Magnitud, (punto: PuntoAnualVenta | PuntoMesVenta) => number> = {
  valor: (punto) => punto.valor,
  pedidos: (punto) => punto.pedidos,
  clientes: (punto) => punto.clientes,
  ticket: (punto) => punto.ticket,
};

function detalleDePunto(punto: PuntoAnualVenta | PuntoMesVenta, fmt: (valor: number) => string) {
  return `${fmt(punto.valor)} · ${entero(punto.pedidos)} pedidos · ${entero(punto.clientes)} clientes · ticket ${fmt(punto.ticket)}`;
}

function serieDe(
  puntos: (PuntoAnualVenta | PuntoMesVenta)[],
  magnitud: Magnitud,
  fmt: (valor: number) => string
): BarraSerieB18[] {
  const maximo = Math.max(0, ...puntos.map((punto) => LEE[magnitud](punto)));
  return puntos.map((punto) => {
    const valor = LEE[magnitud](punto);
    return {
      clave: "periodo" in punto ? punto.periodo : punto.anio,
      etiqueta: "periodo" in punto ? punto.etiqueta : punto.anio,
      valor,
      texto: magnitud === "valor" || magnitud === "ticket" ? fmt(valor) : entero(valor),
      ancho: ancho(valor, maximo),
      parcial: punto.parcial,
      nota: punto.razonParcial,
      detalle: detalleDePunto(punto, fmt),
    };
  });
}

/**
 * Pico sobre períodos COMPLETOS únicamente.
 *
 * Un mes cortado a 19 días o un año cortado en agosto no compiten contra uno
 * entero: si se dejaran entrar, el "pico" podría ser el período con menos días
 * observados y nadie lo notaría mirando la barra.
 */
function picoDe(
  puntos: (PuntoAnualVenta | PuntoMesVenta)[],
  magnitud: Magnitud,
  fmt: (valor: number) => string,
  queEs: string
): PicoSerieB18 {
  const completos = puntos.filter((punto) => !punto.parcial);
  if (completos.length === 0) return null;
  const mejor = completos.reduce((a, b) => (LEE[magnitud](b) > LEE[magnitud](a) ? b : a));
  const valor = LEE[magnitud](mejor);
  const excluidos = puntos.filter((punto) => punto.parcial);
  return {
    etiqueta: "periodo" in mejor ? mejor.etiqueta : mejor.anio,
    texto: magnitud === "valor" || magnitud === "ticket" ? fmt(valor) : entero(valor),
    nota:
      excluidos.length === 0
        ? `${queEs} sobre ${completos.length} períodos completos`
        : `${queEs} sobre ${completos.length} períodos completos · fuera del cálculo: ${excluidos.map((punto) => ("periodo" in punto ? punto.etiqueta : punto.anio)).join(", ")}`,
  };
}

function comparativoDe(
  titulo: string,
  ytd: ComparativoYtdVenta | null,
  magnitud: Magnitud,
  variacion: number | null,
  fmt: (valor: number) => string
): ComparativoVentasB18 {
  const lee = (lado: "actual" | "previo") => {
    if (!ytd) return 0;
    const resumen = ytd[lado];
    return magnitud === "valor" ? resumen.valor : magnitud === "pedidos" ? resumen.pedidos : magnitud === "clientes" ? resumen.clientes : resumen.ticket;
  };
  const hoy = lee("actual");
  const antes = lee("previo");
  const tope = Math.max(hoy, antes);
  const texto = (valor: number) => (magnitud === "valor" || magnitud === "ticket" ? fmt(valor) : entero(valor));
  return {
    titulo,
    delta: firmado(variacion),
    actual: { etiqueta: ytd ? ytd.actual.etiqueta : "sin período", texto: texto(hoy), ancho: ancho(hoy, tope) },
    previo: { etiqueta: ytd ? `${ytd.previo.etiqueta} · mismos ${ytd.dias} días` : "sin comparable", texto: texto(antes), ancho: ancho(antes, tope) },
  };
}

const AZUL = "#0789e6";
const MORADO = "#7b2bf4";
const VERDE = "#16a34a";
const NARANJA = "#f97316";

/** Fuente única de los cuatro agentes de Ventas: pedidos Odoo confirmados. */
export function construirMapaVentasB18(dataset: Dataset, fmt: (valor: number) => string): MapaVentasB18 {
  const serie = leerSerieVentas(dataset);
  const ytd = serie.ytd;
  const corte = serie.corte ?? "sin ventas confirmadas";
  const anios = serie.anios;
  const mesesDelAnioCorte = serie.meses.filter((mes) => mes.anio === corte.slice(0, 4));
  const periodo = ytd ? `${ytd.actual.etiqueta} vs ${ytd.previo.etiqueta}` : `hasta ${corte}`;
  const fuente = "Supabase · ventas (sale.order de Odoo, estado sale)";
  const capa = "amount_total — total confirmado por Odoo, IVA 12% incluido";
  const declaracion = "Facturación confirmada · IVA 12% incluido";

  const mesesPorAnio: Record<string, PuntoMesVenta[]> = {};
  for (const mes of serie.meses) (mesesPorAnio[mes.anio] ??= []).push(mes);

  // ── Cobertura: cuánto de la lectura descansa en período completo ───────────
  // NO se usa "hay alguna venta" ni "el total es mayor que cero": las dos dan
  // 100% siempre y no miden nada. Cada agente declara su propio punto débil.
  const valorAniosCompletos = serie.aniosCompletos.reduce((suma, anio) => suma + anio.valor, 0);
  const coberturaVenta = serie.total > 0 ? dos((valorAniosCompletos / serie.total) * 100) : 0;
  const aniosParciales = anios.filter((anio) => anio.parcial);

  const coberturaPedidos = ytd && ytd.actual.pedidos > 0 ? dos((ytd.actual.pedidosMesesCerrados / ytd.actual.pedidos) * 100) : 0;
  const coberturaClientes = ytd && ytd.actual.clientes > 0 ? dos((ytd.actual.conHistorial / ytd.actual.clientes) * 100) : 0;
  const coberturaTicket = ytd && ytd.actual.ticket > 0 ? dos((ytd.actual.ticketMediano / ytd.actual.ticket) * 100) : 0;

  // ── 1 · DETECTA · Evolución de ventas ─────────────────────────────────────
  const venta: LecturaAgenteVentasB18 = {
    id: "venta",
    slot: "detecta",
    iniciales: "VE",
    nombre: "Evolución de ventas",
    titulo: "Evolución",
    color: AZUL,
    senal: ytd
      ? `${fmt(ytd.actual.valor)} en ${ytd.dias} días · ${firmado(ytd.variacionValor)} vs ${ytd.previo.inicio.slice(0, 4)}`
      : "Sin período comparable",
    pregunta: "¿De dónde viene el crecimiento de la venta?",
    kpi: firmado(ytd?.variacionValor ?? null),
    kpiEtiqueta: `venta comparable ${corte.slice(0, 4)}`,
    micro: anios.map((anio) => ({
      etiqueta: anio.anio,
      alto: ancho(anio.valor, Math.max(0, ...anios.map((item) => item.valor))),
      parcial: anio.parcial,
    })),
    anual: serieDe(anios, "valor", fmt),
    mensual: serieDe(mesesDelAnioCorte, "valor", fmt),
    picoAnual: picoDe(anios, "valor", fmt, "mayor venta anual"),
    picoMensual: picoDe(serie.meses, "valor", fmt, "mayor venta mensual"),
    comparativo: comparativoDe("Venta acumulada al mismo corte", ytd, "valor", ytd?.variacionValor ?? null, fmt),
    metricas: [
      { valor: ytd ? fmt(ytd.actual.valor) : "—", etiqueta: `venta ${corte.slice(0, 4)} al corte` },
      { valor: ytd ? fmt(ytd.previo.valor) : "—", etiqueta: `mismos ${ytd?.dias ?? 0} días del año previo` },
      { valor: entero(serie.mesesCerrados.length), etiqueta: "meses cerrados observados" },
    ],
    hallazgo: ytd
      ? `Entre el 1 de enero y el ${corte} la venta confirmada suma ${fmt(ytd.actual.valor)} contra ${fmt(ytd.previo.valor)} de los mismos ${ytd.dias} días del año anterior: ${firmado(ytd.variacionValor)}.`
      : "No hay un rango equivalente del año anterior con venta confirmada.",
    problema: aniosParciales.length > 0
      ? `${aniosParciales.map((anio) => `${anio.anio} (${anio.razonParcial})`).join(" y ")}: esos años no pueden compararse contra un año entero.`
      : "Todos los años observados se ven completos.",
    accion: "Comparar sólo rangos de días equivalentes; el año en curso nunca contra un año cerrado.",
    formula: "venta = Σ ventas.total_odoo_referencia (amount_total) de los pedidos con estado_odoo = 'sale', agrupada por año y por mes de fecha_venta",
    fuente,
    periodo,
    capa,
    limite: `${corte.slice(0, 4)} PARCIAL al ${corte} · ${serie.desde?.slice(0, 4)} arranca el ${serie.desde}`,
    cobertura: coberturaVenta,
    coberturaNombre: "Histórico en años completos",
    coberturaEtiqueta: "de la venta observada cae en años calendario completos",
    coberturaExplicacion: `${fmt(dos(valorAniosCompletos))} de ${fmt(serie.total)} está en años que se ven enteros (${serie.aniosCompletos.map((anio) => anio.anio).join(", ")}). El resto vive en años cortados y no sostiene una tasa de crecimiento anual.`,
    notaIdentidad: null,
  };

  // ── 2 · EXPLICA · Pedidos ─────────────────────────────────────────────────
  const brechaPedidos =
    ytd && ytd.variacionValor !== null && ytd.variacionPedidos !== null ? dos(ytd.variacionValor - ytd.variacionPedidos) : null;
  const pedidos: LecturaAgenteVentasB18 = {
    id: "pedidos",
    slot: "explica",
    iniciales: "PE",
    nombre: "Pedidos",
    titulo: "Pedidos",
    color: MORADO,
    senal: ytd
      ? `${entero(ytd.actual.pedidos)} pedidos · ${firmado(ytd.variacionPedidos)} vs ${entero(ytd.previo.pedidos)}`
      : "Sin período comparable",
    pregunta: "¿El crecimiento viene de más pedidos o de pedidos más grandes?",
    kpi: firmado(ytd?.variacionPedidos ?? null),
    kpiEtiqueta: `pedidos comparables ${corte.slice(0, 4)}`,
    micro: anios.map((anio) => ({
      etiqueta: anio.anio,
      alto: ancho(anio.pedidos, Math.max(0, ...anios.map((item) => item.pedidos))),
      parcial: anio.parcial,
    })),
    anual: serieDe(anios, "pedidos", fmt),
    mensual: serieDe(mesesDelAnioCorte, "pedidos", fmt),
    picoAnual: picoDe(anios, "pedidos", fmt, "mayor número de pedidos anual"),
    picoMensual: picoDe(serie.meses, "pedidos", fmt, "mayor número de pedidos mensual"),
    comparativo: comparativoDe("Pedidos confirmados al mismo corte", ytd, "pedidos", ytd?.variacionPedidos ?? null, fmt),
    metricas: [
      { valor: ytd ? entero(ytd.actual.pedidos) : "—", etiqueta: `pedidos ${corte.slice(0, 4)} al corte` },
      { valor: firmado(ytd?.variacionTicket ?? null), etiqueta: "ticket sobre el mismo rango" },
      { valor: brechaPedidos === null ? "—" : `${brechaPedidos >= 0 ? "+" : ""}${brechaPedidos.toFixed(2)} pp`, etiqueta: "brecha venta − pedidos" },
    ],
    hallazgo: ytd
      ? `La venta se mueve ${firmado(ytd.variacionValor)} y los pedidos ${firmado(ytd.variacionPedidos)} sobre los mismos ${ytd.dias} días: ${brechaPedidos !== null && brechaPedidos > 0 ? "el resto lo pone el tamaño del pedido" : "el volumen explica el movimiento"}.`
      : "No hay un rango equivalente del año anterior con pedidos confirmados.",
    problema: brechaPedidos === null
      ? "Sin comparable equivalente no se puede separar volumen de tamaño de pedido."
      : `De ${firmado(ytd?.variacionValor ?? null)} de venta, sólo ${firmado(ytd?.variacionPedidos ?? null)} es volumen: quedan ${brechaPedidos.toFixed(2)} pp que no vienen de vender más veces.`,
    accion: "Fijar la meta sobre pedidos y sobre ticket por separado: son dos palancas distintas.",
    formula: "pedidos = cuenta de sale.order con estado_odoo = 'sale', agrupada por año y por mes de fecha_venta · brecha = variación de venta − variación de pedidos",
    fuente,
    periodo,
    capa,
    limite: `${etiquetaMesVenta(corte.slice(0, 7))} llega sólo al día ${corte.slice(8)}: no se compara contra un mes entero`,
    cobertura: coberturaPedidos,
    coberturaNombre: "Pedidos dentro de meses cerrados",
    coberturaEtiqueta: "de los pedidos del período están en meses cerrados",
    coberturaExplicacion: ytd
      ? `${entero(ytd.actual.pedidosMesesCerrados)} de ${entero(ytd.actual.pedidos)} pedidos caen en meses completos. Los ${entero(ytd.actual.pedidos - ytd.actual.pedidosMesesCerrados)} restantes están en el mes cortado por el corte y todavía pueden subir.`
      : "Sin período no hay nada que cubrir.",
    notaIdentidad: null,
  };

  // ── 3 · PRIORIZA · Clientes ───────────────────────────────────────────────
  //
  // "Cliente nuevo" es una CONCLUSIÓN, y esta lectura no la sostiene: lo único
  // observable es que el cliente no aparece antes del período DENTRO DEL
  // HISTÓRICO DISPONIBLE, que arranca a mitad de 2022. Puede haber comprado
  // antes, en Odoo o fuera de él. Por eso la frase es siempre la misma y dice
  // exactamente hasta dónde llega el dato.
  const sinCompraPrevia = ytd ? ytd.actual.clientes - ytd.actual.conHistorial : 0;
  const fraseSinCompraPrevia = `${entero(sinCompraPrevia)} clientes sin compra previa registrada en el histórico disponible`;
  const clientes: LecturaAgenteVentasB18 = {
    id: "clientes",
    slot: "prioriza",
    iniciales: "CL",
    nombre: "Clientes",
    titulo: "Clientes",
    color: VERDE,
    senal: ytd
      ? `${entero(ytd.actual.clientes)} compradores · ${firmado(ytd.variacionClientes)} · Top 5 ${pct(ytd.actual.participacionTop5)}`
      : "Sin período comparable",
    pregunta: "¿La venta crece porque compran más clientes o los mismos de siempre?",
    kpi: firmado(ytd?.variacionClientes ?? null),
    kpiEtiqueta: `clientes compradores ${corte.slice(0, 4)}`,
    micro: anios.map((anio) => ({
      etiqueta: anio.anio,
      alto: ancho(anio.clientes, Math.max(0, ...anios.map((item) => item.clientes))),
      parcial: anio.parcial,
    })),
    anual: serieDe(anios, "clientes", fmt),
    mensual: serieDe(mesesDelAnioCorte, "clientes", fmt),
    picoAnual: picoDe(anios, "clientes", fmt, "mayor número de clientes activos anual"),
    picoMensual: picoDe(serie.meses, "clientes", fmt, "mayor número de clientes activos mensual"),
    comparativo: comparativoDe("Clientes con compra al mismo corte", ytd, "clientes", ytd?.variacionClientes ?? null, fmt),
    metricas: [
      { valor: ytd ? `${pct(ytd.actual.participacionTop5)}` : "—", etiqueta: `Top 5 del período · ${ytd ? fmt(ytd.actual.top5) : "—"}` },
      { valor: ytd ? entero(ytd.actual.recurrentes) : "—", etiqueta: "clientes con 2+ pedidos en el período" },
      { valor: ytd ? entero(ytd.actual.porRecuperar) : "—", etiqueta: "sin compra en más de 30 días al corte" },
    ],
    hallazgo: ytd
      ? `${entero(ytd.actual.clientes)} clientes compraron en el período contra ${entero(ytd.previo.clientes)} del año anterior (${firmado(ytd.variacionClientes)}). Cinco cuentas concentran ${pct(ytd.actual.participacionTop5)} — ${fmt(ytd.actual.top5)} — de la venta DEL PERÍODO. De esos compradores, ${fraseSinCompraPrevia}.`
      : "No hay un rango equivalente del año anterior con clientes compradores.",
    problema: ytd
      ? `${entero(ytd.actual.porRecuperar)} de los ${entero(ytd.actual.clientes)} clientes del período llevan más de 30 días sin comprar al ${corte}, y sólo ${entero(ytd.actual.recurrentes)} repitieron dentro del período.`
      : "Sin período no se puede afirmar recurrencia ni pérdida.",
    accion: "Separar la cartera en tres listas: Top 5 a proteger, recurrentes a sostener, inactivos a recuperar.",
    formula: "clientes = cuenta de id_cliente distintos con al menos un pedido 'sale' en el rango · Top 5 = Σ de las cinco cuentas de mayor venta DENTRO del período ÷ venta del período · recuperación = clientes del período cuya última compra es anterior al corte − 30 días",
    fuente,
    periodo,
    capa,
    limite: `Top 5 DEL PERÍODO, no la histórica · ${fraseSinCompraPrevia}: no tienen contra qué compararse`,
    cobertura: coberturaClientes,
    coberturaNombre: "Clientes con historial previo",
    coberturaEtiqueta: "de los clientes del período ya compraban antes del período",
    coberturaExplicacion: ytd
      ? `${entero(ytd.actual.conHistorial)} de ${entero(ytd.actual.clientes)} clientes tienen historial anterior al ${ytd.actual.inicio}. Sólo sobre ellos se puede afirmar si crecieron, cayeron o se perdieron. Los otros son ${fraseSinCompraPrevia}, que arranca el ${serie.desde ?? "—"}: antes de esa fecha no hay nada registrado sobre ellos, y pueden haber comprado fuera de la ventana observada.`
      : "Sin período no hay nada que cubrir.",
    notaIdentidad: {
      titulo: "Límite de identidad del cliente",
      texto:
        "La identidad depende de `id_cliente`, que se deriva del nombre del cliente. Si un mismo cliente está escrito de varias formas, se cuenta como varios clientes distintos: eso INFLA el conteo de clientes y DESINFLA la frecuencia (pedidos por cliente), porque reparte los mismos pedidos entre más cabezas. Los conteos de clientes y la frecuencia de esta página se leen con ese margen.",
      casos: [
        "«MOTOSVENTO GT, AG» vs «MOTOSVENTO GT, SOCIEDAD ANONIMA»",
        "«ENMOTO» vs «ENMOTO (ERIC ACU)»",
        "«WALMART» vs «Walmart»",
      ],
    },
  };

  // ── 4 · RECOMIENDA · Ticket ───────────────────────────────────────────────
  const ticket: LecturaAgenteVentasB18 = {
    id: "ticket",
    slot: "recomienda",
    iniciales: "TI",
    nombre: "Ticket",
    titulo: "Ticket",
    color: NARANJA,
    senal: ytd ? `${fmt(ytd.actual.ticket)} por pedido · ${firmado(ytd.variacionTicket)}` : "Sin período comparable",
    pregunta: "¿Qué palanca mueve más: frecuencia, ticket o recuperación?",
    kpi: firmado(ytd?.variacionTicket ?? null),
    kpiEtiqueta: `ticket comparable · ${ytd ? fmt(ytd.actual.ticket) : "—"}`,
    micro: anios.map((anio) => ({
      etiqueta: anio.anio,
      alto: ancho(anio.ticket, Math.max(0, ...anios.map((item) => item.ticket))),
      parcial: anio.parcial,
    })),
    anual: serieDe(anios, "ticket", fmt),
    mensual: serieDe(mesesDelAnioCorte, "ticket", fmt),
    picoAnual: picoDe(anios, "ticket", fmt, "mayor ticket promedio anual"),
    picoMensual: picoDe(serie.meses, "ticket", fmt, "mayor ticket promedio mensual"),
    comparativo: comparativoDe("Ticket promedio al mismo corte", ytd, "ticket", ytd?.variacionTicket ?? null, fmt),
    metricas: [
      { valor: ytd ? decimal(ytd.actual.pedidosPorCliente) : "—", etiqueta: `pedidos por cliente · ${firmado(ytd?.variacionFrecuencia ?? null)}` },
      { valor: ytd ? fmt(ytd.actual.ticket) : "—", etiqueta: "ticket promedio del período" },
      { valor: ytd ? fmt(ytd.actual.ticketMediano) : "—", etiqueta: "pedido mediano del período" },
    ],
    hallazgo: ytd
      ? `El ticket promedio pasa de ${fmt(ytd.previo.ticket)} a ${fmt(ytd.actual.ticket)} (${firmado(ytd.variacionTicket)}), mientras la frecuencia baja de ${decimal(ytd.previo.pedidosPorCliente)} a ${decimal(ytd.actual.pedidosPorCliente)} pedidos por cliente (${firmado(ytd.variacionFrecuencia)}).`
      : "No hay un rango equivalente del año anterior para el ticket.",
    problema: ytd
      ? `Ticket mediano ${fmt(ytd.actual.ticketMediano)} vs promedio ${fmt(ytd.actual.ticket)}: algunos pedidos grandes elevan la media. Una meta fijada sobre el promedio no describe al pedido típico.`
      : "Sin período no se puede juzgar el ticket.",
    accion: ytd
      ? (ytd.variacionFrecuencia ?? 0) < 0
        ? "Trabajar frecuencia antes que precio: el ticket ya sube solo, la frecuencia es la que cae."
        : "Sostener frecuencia y ticket a la vez; la recuperación de inactivos es la tercera palanca."
      : "Reunir un período comparable antes de decidir palanca.",
    formula: "ticket = venta del período ÷ pedidos del período · frecuencia = pedidos ÷ clientes compradores · pedido mediano = valor central de los importes del período",
    fuente,
    periodo,
    capa,
    limite: "Promedio: no describe ningún pedido concreto · el mes de corte sigue abierto",
    cobertura: coberturaTicket,
    // NO es cobertura de datos: los 3 agentes anteriores miden qué parte del
    // período se observa entera; éste mide la FORMA de la distribución. El
    // 37.91% no dice "falta el 62%": dice que la mediana vale ese porcentaje
    // del promedio. Se nombra por lo que es para que no se lea como un hueco.
    coberturaNombre: "Dispersión de ticket · mediana sobre promedio",
    coberturaEtiqueta: "la mediana vale ese porcentaje del ticket promedio (no es cobertura de datos)",
    coberturaExplicacion: ytd
      ? `Ticket mediano ${fmt(ytd.actual.ticketMediano)} vs promedio ${fmt(ytd.actual.ticket)}: algunos pedidos grandes elevan la media. La mitad de los ${entero(ytd.actual.pedidos)} pedidos del período está por debajo de la mediana. Este porcentaje NO mide cuántos datos hay —los ${entero(ytd.actual.pedidos)} pedidos están completos— sino cuán separadas quedan las dos medidas.`
      : "Sin período no hay dispersión que medir.",
    notaIdentidad: null,
  };

  // ── Moneda: qué años NO son un total GTQ comparable ───────────────────────
  // `amount_total` se suma tal cual llega de Odoo. Si un año trae aunque sea un
  // pedido en otra moneda, su suma mezcla unidades y deja de ser un total en
  // quetzales. Se dice con el año y el pedido por nombre, no "puede haber".
  const aniosMonedaMixta = anios.filter((anio) => anio.pedidosOtraMoneda > 0);
  const avisoMoneda = aniosMonedaMixta.length === 0
    ? null
    : aniosMonedaMixta
        .map((anio) =>
          `${anio.anio} incluye ${entero(anio.pedidosOtraMoneda)} ${anio.pedidosOtraMoneda === 1 ? "pedido" : "pedidos"} en ${anio.monedasOtras.join(" y ")} sin convertir (${anio.idsOtraMoneda.join(", ")}): su monto NO se presenta como total GTQ comparable.`
        )
        .join(" ");

  // ── La historia: +venta = clientes × frecuencia × ticket ───────────────────
  const factores: FactorCrecimiento[] = [
    {
      id: "clientes",
      etiqueta: "más clientes",
      delta: firmado(ytd?.variacionClientes ?? null),
      valor: ytd?.variacionClientes ?? null,
      detalle: ytd ? `${entero(ytd.actual.clientes)} vs ${entero(ytd.previo.clientes)}` : "sin base",
      color: VERDE,
    },
    {
      id: "pedidos",
      etiqueta: "frecuencia",
      delta: firmado(ytd?.variacionFrecuencia ?? null),
      valor: ytd?.variacionFrecuencia ?? null,
      detalle: ytd ? `${decimal(ytd.actual.pedidosPorCliente)} vs ${decimal(ytd.previo.pedidosPorCliente)} pedidos por cliente` : "sin base",
      color: MORADO,
    },
    {
      id: "ticket",
      etiqueta: "ticket por pedido",
      delta: firmado(ytd?.variacionTicket ?? null),
      valor: ytd?.variacionTicket ?? null,
      detalle: ytd ? `${fmt(ytd.actual.ticket)} vs ${fmt(ytd.previo.ticket)}` : "sin base",
      color: NARANJA,
    },
  ];
  // Identidad: venta = clientes × (pedidos ÷ clientes) × (venta ÷ pedidos).
  // El residuo se muestra en vez de esconderse: si no da cero, la lectura miente.
  const producto = factores.reduce((acumulado, factor) => acumulado * (1 + (factor.valor ?? 0) / 100), 1);
  const residuo = ytd && ytd.variacionValor !== null ? dos(ytd.variacionValor - (producto - 1) * 100) : null;

  return {
    serie,
    ytd,
    agentes: [venta, pedidos, clientes, ticket],
    anios,
    mesesPorAnio,
    corte,
    fuente,
    moneda: "GTQ · quetzales de registro, sin conversión",
    capa,
    declaracion,
    avisoMoneda,
    historia: {
      titulo: "De dónde viene el crecimiento",
      resultado: ytd ? `${firmado(ytd.variacionValor)} de venta comparable` : "Sin período comparable",
      factores,
      residuo: residuo === null ? "sin base" : `${residuo >= 0 ? "+" : ""}${residuo.toFixed(2)} pp de residuo`,
    },
    enlaceProductos: {
      texto: "Abrir Productos para explicar qué familia o modelo compuso este pico de venta",
      href: "/ventas/productos",
    },
  };
}
