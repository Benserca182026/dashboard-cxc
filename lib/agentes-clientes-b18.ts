import {
  CAPA_COMPOSICION,
  CAPA_CXC,
  CAPA_VENTA,
  CXC_PENDIENTE_ENLACE,
  CXC_PENDIENTE_MENSAJE,
  ESTADO_CONFIRMADO,
  FUENTE_CLIENTES,
  LIMITE_SNAPSHOT,
  MONEDA_CLIENTES,
  NO_AFIRMABLE,
  type AgenteClientesB18,
  type ClaveConcentracion,
  type ClaveRecencia,
  type ComparativoClientesB18,
  type CorteConcentracionB18,
  type FilaClienteB18,
  type FilaCoberturaB18,
  type LecturaAgenteClienteB18,
  type MapaClientesB18,
  type PanelCarteraB18,
  type PanelCoberturaB18,
  type PanelComposicionB18,
  type PanelConcentracionB18,
  type PanelCxcB18,
  type PanelRecenciaB18,
  type PanelSerieB18,
  type ProcedenciaClientes,
  type PuntoSerieClientesB18,
  type SlotClientesB18,
  type TramoRecenciaB18,
} from "./contrato-clientes-b18";
import { leerClientesReales, type FilaClienteReal } from "./lecturas-clientes-reales";
import type { Dataset } from "./types";

/**
 * ADAPTADOR B18 · CLIENTES
 * ===========================================================================
 * Traduce `leerClientesReales(dataset)` a los tipos del contrato congelado.
 * No calcula ninguna cifra por su cuenta: si un número no está en la lectura,
 * no aparece acá. Un segundo lugar donde se calcula lo mismo es un segundo
 * lugar donde puede empezar a divergir.
 *
 * ── LOS CUATRO AGENTES, SIN UN SOLO KPI REPETIDO ────────────────────────────
 *   detecta    · Recencia        cuánto hace que no compran, y quiénes
 *                                compraron una sola vez en toda su historia.
 *   explica    · Comparable      compradores, pedidos y valor contra la MISMA
 *                                ventana de días del año anterior.
 *   prioriza   · Concentración   de cuántas cuentas depende el año, y cuáles
 *                                de esas cuentas ya están detenidas.
 *   recomienda · Recuperación    a quién llamar, en qué orden, y qué pedidos
 *                                hay que auditar antes de creerles el ticket.
 *
 * Ningún número aparece en dos agentes. Si dos agentes mostraran el mismo
 * número, uno de los dos sobra.
 *
 * ── LAS TRES CAPAS NUNCA SE SUMAN ENTRE SÍ ──────────────────────────────────
 * Venta confirmada (CAPA_VENTA) es la única que es facturación. Composición de
 * líneas (CAPA_COMPOSICION) responde "qué compra" y NO es dinero facturado.
 * Cartera (CAPA_CXC) es saldo, no venta del período. Cada panel declara la
 * suya en su `procedencia.capa`, visible en pantalla.
 *
 * ── LO QUE NO SE PUEDE AFIRMAR NO SE CONSTRUYE ──────────────────────────────
 * Segmento, canal, vendedor, meta, geografía, alta real del cliente y la
 * relación factura↔pedido no están en el snapshot. Ningún KPI de acá los usa;
 * viven declarados en el panel de cobertura, con nombre y motivo.
 */

// ── Formato. El componente no formatea: recibe `texto` ya escrito ───────────

const q = (valor: number) =>
  `Q${valor.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const entero = (valor: number) => valor.toLocaleString("es-GT", { maximumFractionDigits: 0 });
const pct = (valor: number) => `${valor.toFixed(2)}%`;
const firmado = (valor: number | null) =>
  valor === null ? "sin base comparable" : `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}%`;
/** 0-100 sobre el máximo de SU serie, con piso para que una barra chica se vea. */
const ancho = (valor: number, maximo: number) =>
  maximo > 0 ? Math.max(3, Math.min(100, Math.round((valor / maximo) * 10000) / 100)) : 3;
const parte = (valor: number, base: number) => (base > 0 ? Math.round((valor / base) * 10000) / 100 : 0);

const AZUL = "#4b80ee";

/** Cuántas filas se muestran por tramo de recencia. La truncación se declara. */
const TOPE_FILAS_TRAMO = 25;
/** Cuántas filas lleva la lista lateral de un agente. */
const TOPE_LISTA = 12;

const fila = (cliente: FilaClienteReal): FilaClienteB18 => ({
  id: cliente.id,
  etiqueta: cliente.etiqueta,
  pedidos: cliente.pedidos,
  valor: cliente.valor,
  texto: q(cliente.valor),
  ultima: cliente.ultima,
  dias: cliente.dias,
});

const filas = (lista: FilaClienteReal[], tope: number) => lista.slice(0, tope).map(fila);

// ── Mapa degenerado pero VÁLIDO cuando no hay pedidos confirmados ───────────
// Devolver `null` obligaría al componente a tener un segundo modo de dibujo.
// Devolver ceros mudos sería peor: un 0 sin explicación se lee igual que un 0
// verdadero. Se devuelve la estructura completa, con el motivo escrito.

const SIN_DATOS = "Sin pedidos confirmados en el snapshot: no hay corte que derivar.";

function procedenciaSinDatos(): ProcedenciaClientes {
  return {
    fuente: FUENTE_CLIENTES,
    periodo: "sin ventana observable",
    corte: "sin corte derivable",
    moneda: MONEDA_CLIENTES,
    cobertura: { valor: 0, etiqueta: "pedidos confirmados leídos" },
    limite: SIN_DATOS,
    capa: CAPA_VENTA,
  };
}

function mapaSinDatos(): MapaClientesB18 {
  const proc = procedenciaSinDatos();
  const agente = (
    id: AgenteClientesB18,
    slot: SlotClientesB18,
    iniciales: string,
    nombre: string
  ): LecturaAgenteClienteB18 => ({
    id,
    slot,
    iniciales,
    nombre,
    titulo: `${slot[0].toUpperCase()}${slot.slice(1)} · ${nombre}`,
    color: AZUL,
    senal: SIN_DATOS,
    pregunta: "¿Qué se puede leer sin pedidos confirmados?",
    kpi: "—",
    kpiEtiqueta: "sin datos en el snapshot",
    micro: [],
    barras: [],
    metricas: [{ valor: "0", etiqueta: "pedidos confirmados" }],
    lista: [],
    listaTotal: 0,
    comparativo: null,
    hallazgo: SIN_DATOS,
    problema: "Sin pedidos en estado 'sale' no hay universo que medir; ninguna cifra de esta página es afirmable.",
    accion: "Revisar el import de ventas antes de leer nada de esta pantalla.",
    formula: `universo = pedidos con estado_odoo = '${ESTADO_CONFIRMADO}'`,
    procedencia: proc,
  });
  return {
    agentes: [
      agente("recencia", "detecta", "RE", "Recencia"),
      agente("comparable", "explica", "CO", "Comparable"),
      agente("concentracion", "prioriza", "CN", "Concentración"),
      agente("recuperacion", "recomienda", "RC", "Recuperación"),
    ],
    b18: {
      cartera: { metricas: [{ valor: "0", etiqueta: "pedidos confirmados" }], procedencia: proc },
      recencia: { tramos: [], procedencia: proc },
      concentracion: { cortes: [], procedencia: proc },
      serie: { meses: [], maxClientes: 0, maxPedidos: 0, maxValor: 0, procedencia: proc },
      composicion: { filas: [], advertencia: CAPA_COMPOSICION, procedencia: { ...proc, capa: CAPA_COMPOSICION } },
      cxc: {
        estado: "pendiente",
        cifras: null,
        pendiente: { mensaje: CXC_PENDIENTE_MENSAJE, enlace: CXC_PENDIENTE_ENLACE },
        advertencia: CAPA_CXC,
        procedencia: { ...proc, capa: CAPA_CXC },
      },
      cobertura: {
        filas: [{ concepto: "Venta confirmada por cliente", estado: "falta", nota: SIN_DATOS }],
        noAfirmable: NO_AFIRMABLE,
        procedencia: { ...proc, moneda: "No aplica — este panel no es dinero" },
      },
    },
    procedencia: proc,
  };
}

// ── Construcción real ───────────────────────────────────────────────────────

export function construirMapaClientesB18(dataset: Dataset): MapaClientesB18 {
  const lectura = leerClientesReales(dataset);
  if (!lectura.corte || !lectura.desde || !lectura.ytd || !lectura.comparable) return mapaSinDatos();

  const { corte, desde, ytd, comparable } = lectura;
  const periodoHistorico = `${desde} → ${corte}`;
  const periodoComparable = `${ytd.inicio} → ${ytd.fin} vs ${comparable.inicio} → ${comparable.fin}`;

  /** Procedencia base. Toda lectura y todo panel salen de acá con su ajuste. */
  const proc = (over: Partial<ProcedenciaClientes> = {}): ProcedenciaClientes => ({
    fuente: FUENTE_CLIENTES,
    periodo: periodoHistorico,
    // DERIVADO de la última venta confirmada. Nunca escrito a mano.
    corte,
    moneda: MONEDA_CLIENTES,
    cobertura: { valor: 100, etiqueta: "pedidos confirmados del snapshot" },
    limite: LIMITE_SNAPSHOT,
    capa: CAPA_VENTA,
    ...over,
  });

  const tramo = (clave: ClaveRecencia) => lectura.recencia.find((item) => item.clave === clave) ?? null;
  const corteN = (clave: ClaveConcentracion) =>
    lectura.concentracion.find((item) => item.clave === clave) ?? null;

  const mas90 = tramo("90+");
  const de0a30 = tramo("0-30");
  const de31a60 = tramo("31-60");
  const de61a90 = tramo("61-90");
  const top1 = corteN("top1");
  const top5 = corteN("top5");
  const top10 = corteN("top10");
  const top20 = corteN("top20");
  const top50 = corteN("top50");

  const maxTramo = Math.max(1, ...lectura.recencia.map((item) => item.filas.length));
  const unaSola = lectura.unaSolaCompraHistorica.length;
  const conPatron = lectura.clientesHistoricos - unaSola;
  const detenidos = lectura.detenidosAltoValor;
  const top20Detenido = top20 ? top20.filas.filter((f) => f.dias !== null && f.dias > 90) : [];

  // ── 1 · DETECTA · Recencia ────────────────────────────────────────────────
  // KPI propio: qué parte de la base dejó de comprar, y quién compró UNA vez.
  const agenteRecencia: LecturaAgenteClienteB18 = {
    id: "recencia",
    slot: "detecta",
    iniciales: "RE",
    nombre: "Recencia",
    titulo: "Detecta · Recencia",
    color: AZUL,
    senal: `${entero(mas90?.filas.length ?? 0)} de ${entero(lectura.clientesHistoricos)} clientes llevan más de 90 días sin comprar`,
    pregunta: "¿Quién dejó de comprar y desde cuándo?",
    kpi: pct(parte(mas90?.filas.length ?? 0, lectura.clientesHistoricos)),
    kpiEtiqueta: "de la base sin compra en 90 días",
    micro: lectura.recencia.map((item) => ({
      etiqueta: item.clave === "90+" ? "+90" : item.clave,
      alto: ancho(item.filas.length, maxTramo),
      parcial: false,
    })),
    barras: lectura.recencia.map((item) => ({
      clave: item.clave,
      etiqueta: item.etiqueta,
      valor: item.filas.length,
      texto: `${entero(item.filas.length)} clientes`,
      ancho: ancho(item.filas.length, maxTramo),
      parcial: false,
      nota:
        item.clave === "90+"
          ? `Incluye ${entero(unaSola)} clientes que compraron una sola vez en todo el histórico.`
          : null,
      detalle: `${entero(item.filas.length)} clientes · ${q(item.valor)} de venta histórica acumulada`,
    })),
    metricas: [
      { valor: entero(lectura.clientesHistoricos), etiqueta: "clientes con venta histórica" },
      { valor: entero(mas90?.filas.length ?? 0), etiqueta: "sin compra en +90 días" },
      {
        valor: entero(unaSola),
        etiqueta: "clientes de una sola compra histórica",
        nota: "Una sola compra no es un patrón: de estos no se puede afirmar ni recurrencia ni pérdida.",
      },
      {
        valor: entero(lectura.medianaPedidosHistorico),
        etiqueta: "mediana de pedidos por cliente · histórico",
        nota: "Mediana, no promedio: el promedio lo arrastran las cuentas grandes.",
      },
    ],
    lista: filas(lectura.unaSolaCompraHistorica, TOPE_LISTA),
    listaTotal: lectura.unaSolaCompraHistorica.length,
    comparativo: null,
    hallazgo: `${pct(parte(mas90?.filas.length ?? 0, lectura.clientesHistoricos))} de la base registrada no vuelve a comprar desde hace más de un trimestre; ${entero(de0a30?.filas.length ?? 0)} compraron dentro del último mes.`,
    problema: `La recencia no distingue al cliente perdido del que compra una vez al año, y ${entero(unaSola)} de los ${entero(lectura.clientesHistoricos)} clientes tienen una sola compra en todo el histórico: sobre ellos no hay frecuencia que interrumpir.`,
    accion: `Trabajar el tramo 61-90 antes de que cruce a +90: son ${entero(de61a90?.filas.length ?? 0)} cuentas todavía recuperables, contra ${entero(de31a60?.filas.length ?? 0)} que aún están en ventana de seguimiento.`,
    formula: `dias = corte − max(fecha_venta) por cliente, sobre pedidos con estado_odoo = '${ESTADO_CONFIRMADO}'; corte = max(fecha_venta) del snapshot`,
    procedencia: proc({
      cobertura: {
        valor: parte(conPatron, lectura.clientesHistoricos),
        etiqueta: "de la base tiene más de una compra: sólo ahí la recencia describe un patrón",
      },
      limite: `${LIMITE_SNAPSHOT} Sin fecha de alta real del cliente, un silencio largo no se distingue de un cliente que nunca estuvo activo.`,
    }),
  };

  // ── 2 · EXPLICA · Comparable ──────────────────────────────────────────────
  // KPI propio: la descomposición del crecimiento en clientes, pedidos y valor.
  const factores = [
    {
      clave: "compradores",
      etiqueta: "Compradores",
      variacion: lectura.variacion.compradores,
      detalle: `${entero(ytd.compradores)} vs ${entero(comparable.compradores)}`,
    },
    {
      clave: "venta",
      etiqueta: "Venta",
      variacion: lectura.variacion.valor,
      detalle: `${q(ytd.valor)} vs ${q(comparable.valor)}`,
    },
    {
      clave: "pedidos",
      etiqueta: "Pedidos",
      variacion: lectura.variacion.pedidos,
      detalle: `${entero(ytd.pedidos)} vs ${entero(comparable.pedidos)}`,
    },
  ];
  const maxFactor = Math.max(1, ...factores.map((f) => Math.abs(f.variacion ?? 0)));
  const ultimos12 = lectura.meses.slice(-12);
  const maxClientesMes = Math.max(1, ...ultimos12.map((mes) => mes.clientes));
  const topeComparativo = Math.max(ytd.valor, comparable.valor);
  const comparativoVenta: ComparativoClientesB18 = {
    titulo: "Venta confirmada contra la misma ventana de días del año anterior",
    delta: firmado(lectura.variacion.valor),
    actual: { etiqueta: ytd.etiqueta, texto: q(ytd.valor), ancho: ancho(ytd.valor, topeComparativo) },
    previo: {
      etiqueta: `${comparable.etiqueta} · mismos ${entero(ytd.dias)} días`,
      texto: q(comparable.valor),
      ancho: ancho(comparable.valor, topeComparativo),
    },
    nota: `Ambos lados abren el 1 de enero y cierran el mismo día del año: ${entero(ytd.dias)} días corridos contra ${entero(comparable.dias)}. No compara un año cerrado contra uno en curso.`,
  };

  const agenteComparable: LecturaAgenteClienteB18 = {
    id: "comparable",
    slot: "explica",
    iniciales: "CO",
    nombre: "Comparable",
    titulo: "Explica · Comparable",
    color: AZUL,
    senal: `${entero(ytd.compradores)} compradores en el año contra ${entero(comparable.compradores)} de la misma ventana anterior`,
    pregunta: "¿El crecimiento viene de más clientes o de más compra por cliente?",
    kpi: firmado(lectura.variacion.compradores),
    kpiEtiqueta: "compradores vs. comparable",
    micro: ultimos12.map((mes) => ({
      etiqueta: mes.etiqueta,
      alto: ancho(mes.clientes, maxClientesMes),
      parcial: mes.parcial,
    })),
    barras: factores.map((factor) => ({
      clave: factor.clave,
      etiqueta: factor.etiqueta,
      valor: factor.variacion ?? 0,
      texto: firmado(factor.variacion),
      ancho: ancho(Math.abs(factor.variacion ?? 0), maxFactor),
      parcial: false,
      nota: null,
      detalle: factor.detalle,
    })),
    metricas: [
      { valor: entero(ytd.compradores), etiqueta: "compradores YTD" },
      { valor: entero(ytd.pedidos), etiqueta: "pedidos YTD" },
      {
        valor: entero(ytd.medianaPedidos),
        etiqueta: "mediana de pedidos por cliente · YTD",
        nota: `Baja de ${entero(lectura.medianaPedidosHistorico)} en el histórico a ${entero(ytd.medianaPedidos)} en el año: la base se ensancha y se vuelve menos frecuente.`,
      },
      {
        valor: q(lectura.ticketMedianoHistorico),
        etiqueta: "ticket mediano por pedido · histórico",
        nota: `En la ventana del año el mediano es ${q(ytd.ticketMediano)}: el tamaño del pedido típico casi no se movió, así que no es el factor que explica el crecimiento.`,
      },
    ],
    lista: [],
    listaTotal: 0,
    comparativo: comparativoVenta,
    hallazgo: `Los compradores crecen ${firmado(lectura.variacion.compradores)} y los pedidos sólo ${firmado(lectura.variacion.pedidos)}: entra más gente de la que repite.`,
    problema: `La venta crece ${firmado(lectura.variacion.valor)}, entre los dos factores, y la mediana de pedidos por cliente cae de ${entero(lectura.medianaPedidosHistorico)} a ${entero(ytd.medianaPedidos)}. Un crecimiento sostenido por clientes que compran una vez no se repite solo el año siguiente.`,
    accion: `Medir cuántos de los ${entero(ytd.primeraCompraRegistrada)} de primera compra registrada vuelven dentro de 90 días. Ahí se decide si el ensanchamiento de la base es real o de un pedido.`,
    formula: `ventana = [1-ene del año del corte, corte]; comparable = [1-ene, mismo día y mes] del año anterior. variación = (actual ÷ previo − 1) × 100 sobre cada magnitud por separado`,
    procedencia: proc({
      periodo: periodoComparable,
      cobertura: {
        valor: parte(ytd.compradores - ytd.primeraCompraRegistrada, ytd.compradores),
        etiqueta: "de los compradores del año ya tenía compra registrada antes del período",
      },
      limite: `${LIMITE_SNAPSHOT} La ventana del año en curso está cortada al ${corte}: se compara contra los mismos días, nunca contra un año cerrado.`,
    }),
  };

  // ── 3 · PRIORIZA · Concentración ──────────────────────────────────────────
  // KPI propio: de cuántas cuentas depende el año. El denominador es SIEMPRE
  // la venta total del período, nunca la suma del subconjunto que se muestra.
  const maxPctCorte = Math.max(1, ...lectura.concentracion.map((item) => item.pct));
  const agenteConcentracion: LecturaAgenteClienteB18 = {
    id: "concentracion",
    slot: "prioriza",
    iniciales: "CN",
    nombre: "Concentración",
    titulo: "Prioriza · Concentración",
    color: AZUL,
    senal: `${entero(top5?.n ?? 0)} clientes concentran ${pct(top5?.pct ?? 0)} de la venta del año`,
    pregunta: "¿De cuántas cuentas depende el resultado del año?",
    kpi: pct(top5?.pct ?? 0),
    kpiEtiqueta: "Top 5 sobre venta YTD",
    micro: lectura.concentracion.map((item) => ({
      etiqueta: `T${item.n}`,
      alto: ancho(item.pct, maxPctCorte),
      parcial: false,
    })),
    barras: lectura.concentracion.map((item) => ({
      clave: item.clave,
      etiqueta: item.etiqueta,
      valor: item.pct,
      texto: pct(item.pct),
      ancho: ancho(item.pct, maxPctCorte),
      parcial: false,
      nota: null,
      detalle: `${q(item.valor)} de ${q(ytd.valor)} de venta YTD · ${entero(item.n)} cuentas`,
    })),
    metricas: [
      { valor: pct(top5?.pct ?? 0), etiqueta: "Top 5 sobre la venta del año" },
      { valor: pct(top10?.pct ?? 0), etiqueta: "Top 10 sobre la venta del año" },
      {
        valor: entero(lectura.clientesParaMitadYtd),
        etiqueta: "clientes juntan la mitad de la venta YTD",
        nota: `Se acumula desde el mayor hasta cruzar ${q(Math.round((ytd.valor / 2) * 100) / 100)}.`,
      },
      {
        valor: entero(top20Detenido.length),
        etiqueta: "cuentas del Top 20 YTD ya detenidas +90 días",
        nota: "Concentración y recencia se cruzan acá: una cuenta grande callada pesa distinto que una chica.",
      },
    ],
    lista: top10 ? filas(top10.filas, TOPE_LISTA) : [],
    listaTotal: top10 ? top10.filas.length : 0,
    comparativo: null,
    hallazgo: `${entero(top10?.n ?? 0)} cuentas explican ${pct(top10?.pct ?? 0)} de la venta del año, y bastan ${entero(lectura.clientesParaMitadYtd)} para la mitad.`,
    problema: `La cuenta mayor sola vale ${pct(top1?.pct ?? 0)} del año; perderla no se compensa con clientes nuevos de una compra.`,
    accion:
      top20Detenido.length > 0
        ? `Revisar primero ${top20Detenido.length === 1 ? "la" : "las"} ${entero(top20Detenido.length)} cuenta${top20Detenido.length === 1 ? "" : "s"} que ${top20Detenido.length === 1 ? "está" : "están"} en el Top 20 del año y a la vez sin comprar hace más de 90 días.`
        : "Ninguna cuenta del Top 20 del año está detenida: sostener la frecuencia de ese grupo antes de buscar cuentas nuevas.",
    formula: "pct = Σ venta(top N del período) ÷ Σ venta del período × 100 — el denominador es siempre el total, nunca el subconjunto",
    procedencia: proc({
      periodo: `${ytd.inicio} → ${ytd.fin}`,
      cobertura: {
        valor: top50?.pct ?? 0,
        etiqueta: "de la venta del año explicada por las 50 cuentas mayores",
      },
      limite: `${LIMITE_SNAPSHOT} La identidad del cliente se deriva del nombre: dos razones sociales del mismo negocio reparten su concentración en dos filas.`,
    }),
  };

  // ── 4 · RECOMIENDA · Recuperación ─────────────────────────────────────────
  // KPI propio: quién repite, quién no volvió y qué pedidos hay que auditar.
  const distribucion = [
    { etiqueta: "1 pedido", n: ytd.clientes.filter((c) => c.pedidos === 1).length },
    { etiqueta: "2-3", n: ytd.clientes.filter((c) => c.pedidos >= 2 && c.pedidos <= 3).length },
    { etiqueta: "4-6", n: ytd.clientes.filter((c) => c.pedidos >= 4 && c.pedidos <= 6).length },
    { etiqueta: "7+", n: ytd.clientes.filter((c) => c.pedidos >= 7).length },
  ];
  const maxDistribucion = Math.max(1, ...distribucion.map((d) => d.n));
  const barrasRecuperacion = [
    {
      clave: "detenidos",
      etiqueta: "Alto valor detenido",
      valor: detenidos.length,
      texto: `${entero(detenidos.length)} cuentas`,
      detalle: `Top 50 histórico sin compra confirmada en más de 90 días · ${q(dosDecimales(detenidos.reduce((s, c) => s + c.valor, 0)))} de venta histórica en juego.`,
      nota: null as string | null,
    },
    {
      clave: "recurrentes",
      etiqueta: "Recurrentes del año",
      valor: ytd.recurrentes,
      texto: `${entero(ytd.recurrentes)} clientes`,
      detalle: "Dos o más pedidos confirmados dentro de la ventana del año.",
      nota: null as string | null,
    },
    {
      clave: "unica",
      etiqueta: "Una sola compra del año",
      valor: ytd.unaCompra,
      texto: `${entero(ytd.unaCompra)} clientes`,
      detalle: `${entero(ytd.compradores)} compradores − ${entero(ytd.recurrentes)} recurrentes.`,
      nota: null as string | null,
    },
    {
      clave: "cero",
      etiqueta: "Pedidos en Q0.00",
      valor: lectura.pedidosCero.length,
      texto: `${entero(lectura.pedidosCero.length)} pedidos`,
      detalle: "Pedidos confirmados con total cero. Se listan para auditarlos, no se descartan.",
      nota: "No se excluyen del universo: excluirlos cambiaría el ticket mediano sin dejar rastro.",
    },
  ];
  const maxBarraRecuperacion = Math.max(1, ...barrasRecuperacion.map((b) => b.valor));

  const agenteRecuperacion: LecturaAgenteClienteB18 = {
    id: "recuperacion",
    slot: "recomienda",
    iniciales: "RC",
    nombre: "Recuperación",
    titulo: "Recomienda · Recuperación",
    color: AZUL,
    senal:
      detenidos.length > 0
        ? `${entero(detenidos.length)} cuentas del Top 50 histórico llevan más de 90 días detenidas`
        : "Ninguna cuenta del Top 50 histórico está detenida más de 90 días",
    pregunta: "¿A quién llamar primero y por qué?",
    // KPI = tamaño de la lista de llamadas, no la salud general de la base.
    // Antes acá vivía `ytd.recurrentes` (121): un número sano —clientes que sí
    // repiten— que no contesta "a quién llamar primero". Esa cifra sigue
    // disponible (primera fila de `metricas`, abajo, y en el "apoyo" de la
    // tarjeta); el número grande ahora es el mismo universo que ya arma
    // `lista` (`detenidos`) y que `accion` ya le pide llamar en orden.
    kpi: entero(detenidos.length),
    kpiEtiqueta: "cuentas del Top 50 histórico ya detenidas +90 días",
    micro: distribucion.map((d) => ({
      etiqueta: d.etiqueta,
      alto: ancho(d.n, maxDistribucion),
      parcial: false,
    })),
    barras: barrasRecuperacion.map((b) => ({
      clave: b.clave,
      etiqueta: b.etiqueta,
      valor: b.valor,
      texto: b.texto,
      ancho: ancho(b.valor, maxBarraRecuperacion),
      parcial: false,
      nota: b.nota,
      detalle: b.detalle,
    })),
    metricas: [
      { valor: entero(ytd.recurrentes), etiqueta: "recurrentes 2+ pedidos YTD" },
      {
        valor: entero(ytd.primeraCompraRegistrada),
        etiqueta: "primera compra registrada YTD",
        nota: "Registrada, no nueva: el snapshot no tiene fecha de alta real del cliente, así que no se puede afirmar que el cliente sea nuevo.",
      },
      {
        valor: entero(lectura.pedidosCero.length),
        etiqueta: "pedidos confirmados en Q0.00 por revisar",
        nota: `Afectan a ${entero(new Set(lectura.pedidosCero.map((p) => p.cliente)).size)} clientes distintos. Sin ver la factura no se puede decir si son canje, garantía o error de captura.`,
      },
      {
        valor: entero(ytd.unaCompra),
        etiqueta: "compradores del año que no repitieron",
        nota: "Es el grupo donde una segunda compra cambia la frecuencia de toda la base.",
      },
    ],
    lista: filas(detenidos, TOPE_LISTA),
    listaTotal: detenidos.length,
    comparativo: null,
    hallazgo:
      detenidos.length > 0
        ? `${entero(detenidos.length)} de las 50 cuentas de mayor venta histórica no compran hace más de 90 días; la lista va ordenada por lo que aportaban.`
        : "Las 50 cuentas de mayor venta histórica siguen activas dentro del trimestre.",
    problema: `Hay ${entero(lectura.pedidosCero.length)} pedidos confirmados con total Q0.00 que no se pueden explicar sin ver la factura, y entran al mismo universo que sostiene el ticket mediano.`,
    accion: `Llamar las cuentas detenidas en el orden de esta lista y auditar los ${entero(lectura.pedidosCero.length)} pedidos en Q0.00 uno por uno antes del próximo cierre.`,
    formula: `detenidos = clientes del top 50 por venta histórica con dias > 90; recurrentes = clientes con ≥ 2 pedidos en la ventana; Q0.00 = pedidos '${ESTADO_CONFIRMADO}' con total_odoo_referencia = 0`,
    procedencia: proc({
      cobertura: {
        valor: parte(ytd.recurrentes, ytd.compradores),
        etiqueta: "de los compradores del año repitió al menos una vez",
      },
      limite: `${LIMITE_SNAPSHOT} Sin vendedor asignado ni canal en el snapshot, la lista dice a quién llamar pero no quién debe llamarlo.`,
    }),
  };

  // ── B18 · 1 · Cartera ─────────────────────────────────────────────────────
  const cartera: PanelCarteraB18 = {
    metricas: [
      { valor: entero(lectura.clientesHistoricos), etiqueta: "clientes con venta histórica" },
      { valor: entero(lectura.pedidosConfirmados), etiqueta: "pedidos confirmados" },
      { valor: entero(ytd.compradores), etiqueta: "compradores YTD" },
      { valor: entero(ytd.pedidos), etiqueta: "pedidos YTD" },
      { valor: q(ytd.valor), etiqueta: "venta YTD" },
      { valor: q(lectura.ticketMedianoHistorico), etiqueta: "ticket mediano por pedido" },
      { valor: entero(ytd.recurrentes), etiqueta: "recurrentes 2+ pedidos YTD" },
      {
        valor: `${entero(lectura.medianaPedidosHistorico)} / ${entero(ytd.medianaPedidos)}`,
        etiqueta: "mediana de pedidos histórico / YTD",
        nota: "Mediana, no promedio. Los dos números miden poblaciones distintas: toda la base contra los compradores del año.",
      },
    ],
    procedencia: proc(),
  };

  // ── B18 · 2 · Recencia ────────────────────────────────────────────────────
  const tramos: TramoRecenciaB18[] = lectura.recencia.map((item) => ({
    clave: item.clave,
    etiqueta: item.etiqueta,
    clientes: item.filas.length,
    ancho: ancho(item.filas.length, maxTramo),
    valor: item.valor,
    texto: q(item.valor),
    // `filas` puede venir truncada; `totalFilas` es el conteo real del tramo,
    // para que la pantalla diga "25 de 243" y no sólo "25 clientes listados".
    filas: filas(item.filas, TOPE_FILAS_TRAMO),
    totalFilas: item.filas.length,
  }));
  const panelRecencia: PanelRecenciaB18 = {
    tramos,
    procedencia: proc({
      cobertura: {
        valor: parte(conPatron, lectura.clientesHistoricos),
        etiqueta: "de la base tiene más de una compra: sólo ahí la recencia describe un patrón",
      },
      limite: `${LIMITE_SNAPSHOT} El valor de cada tramo es venta histórica acumulada de esos clientes, no venta ocurrida dentro de la ventana de días que da nombre al tramo.`,
    }),
  };

  // ── B18 · 3 · Concentración ───────────────────────────────────────────────
  const cortes: CorteConcentracionB18[] = lectura.concentracion.map((item) => ({
    clave: item.clave,
    etiqueta: item.etiqueta,
    pct: item.pct,
    valor: item.valor,
    texto: q(item.valor),
    filas: item.filas.map(fila),
    totalFilas: item.filas.length,
  }));
  const panelConcentracion: PanelConcentracionB18 = {
    cortes,
    procedencia: proc({
      periodo: `${ytd.inicio} → ${ytd.fin}`,
      cobertura: {
        valor: top50?.pct ?? 0,
        etiqueta: "de la venta del año explicada por las 50 cuentas mayores",
      },
      limite: `${LIMITE_SNAPSHOT} La participación se calcula siempre sobre ${q(ytd.valor)} de venta del período; los cortes se anidan y no se suman entre sí.`,
    }),
  };

  // ── B18 · 4 · Serie mensual ───────────────────────────────────────────────
  const meses: PuntoSerieClientesB18[] = lectura.meses.map((mes) => ({
    clave: mes.clave,
    etiqueta: mes.etiqueta,
    clientes: mes.clientes,
    pedidos: mes.pedidos,
    valor: mes.valor,
    texto: q(mes.valor),
    parcial: mes.parcial,
    nota: mes.nota,
  }));
  const panelSerie: PanelSerieB18 = {
    meses,
    maxClientes: Math.max(0, ...meses.map((mes) => mes.clientes)),
    maxPedidos: Math.max(0, ...meses.map((mes) => mes.pedidos)),
    maxValor: Math.max(0, ...meses.map((mes) => mes.valor)),
    procedencia: proc({
      periodo: `${desde.slice(0, 7)} → ${corte.slice(0, 7)}`,
      cobertura: {
        valor: parte(meses.filter((mes) => !mes.parcial).length, meses.length),
        etiqueta: "de los meses de la serie se ven enteros",
      },
      limite: `${LIMITE_SNAPSHOT} Los meses marcados como parciales (${meses.filter((mes) => mes.parcial).map((mes) => mes.etiqueta).join(", ")}) se muestran pero no se comparan contra un mes cerrado.`,
    }),
  };

  // ── B18 · 5 · Composición. CAPA DISTINTA: no es facturación ───────────────
  const maxComposicion = Math.max(1, ...lectura.composicion.filas.map((f) => f.valor));
  const panelComposicion: PanelComposicionB18 = {
    filas: lectura.composicion.filas.map((f) => ({
      etiqueta: f.etiqueta,
      unidades: f.unidades,
      valor: f.valor,
      ancho: ancho(f.valor, maxComposicion),
      texto: q(f.valor),
    })),
    advertencia: CAPA_COMPOSICION,
    procedencia: proc({
      capa: CAPA_COMPOSICION,
      moneda: "Composición de líneas · no agregable como facturación",
      cobertura: {
        valor: lectura.composicion.coberturaFamilia,
        etiqueta: "de la composición de líneas tiene familia identificada desde el SKU",
      },
      limite:
        "Cantidad × precio de lista de las líneas de pedidos confirmados. No lleva el descuento aplicado ni el IVA, no coincide con la venta confirmada y no debe compararse ni sumarse con ella. Se muestran las familias principales.",
    }),
  };

  // ── B18 · 6 · Cartera CxC · ESTADO PENDIENTE ─────────────────────────────
  // Clientes NO calcula cartera. `saldos_odoo` —la fuente que sostiene bruta,
  // saldo a favor y neta— no forma parte del dataset comercial de esta
  // pantalla. Mientras eso siga así la sección declara que falta y manda a la
  // página que sí la tiene, en vez de mostrar un Q0.00, una ecuación rota, o
  // una suma de saldos de factura presentada como si fuera un cálculo de acá.
  // Un número que no se midió en esta pantalla es indistinguible de uno que sí.
  const panelCxc: PanelCxcB18 = {
    estado: "pendiente",
    cifras: null,
    pendiente: { mensaje: CXC_PENDIENTE_MENSAJE, enlace: CXC_PENDIENTE_ENLACE },
    advertencia: CAPA_CXC,
    procedencia: proc({
      capa: CAPA_CXC,
      fuente: "pendiente · saldos_odoo, fuera del dataset comercial de Clientes",
      periodo: "sin ventana propia: la cartera se lee en su propia pantalla, con su propio corte",
      moneda: "No aplica — la sección no muestra importes mientras esté pendiente",
      cobertura: { valor: 0, etiqueta: "de la cartera integrada a esta vista" },
      limite:
        "Esta pantalla no lee cartera. La fuente que la sostiene se integra en una segunda vuelta; hasta entonces la sección no afirma ningún importe.",
    }),
  };

  // ── B18 · 7 · Cobertura ───────────────────────────────────────────────────
  const facturasConPedido = dataset.facturas.filter((f) => f.id_venta).length;
  const ejemploVariantes = lectura.variantesDeNombre[0];
  const filasCobertura: FilaCoberturaB18[] = [
    {
      concepto: "Venta confirmada por cliente",
      estado: "existe",
      nota: `${entero(lectura.pedidosConfirmados)} pedidos en estado '${ESTADO_CONFIRMADO}' con total_odoo_referencia, repartidos entre ${entero(lectura.clientesHistoricos)} clientes.`,
    },
    {
      concepto: "Recencia y frecuencia",
      estado: "existe",
      nota: `Derivadas de fecha_venta contra el corte ${corte}. No requieren ninguna dimensión externa.`,
    },
    {
      concepto: "Identidad del cliente",
      estado: "parcial",
      nota:
        lectura.variantesDeNombre.length > 0
          ? `Se deriva del nombre (id_cliente = hash del nombre normalizado). ${entero(lectura.variantesDeNombre.length)} raíz(ces) comercial(es) aparecen con más de una razón social — p. ej. ${ejemploVariantes?.nombres.join(" y ")} —, así que el conteo de clientes está inflado y la frecuencia por cliente desinflada.`
          : "Se deriva del nombre (id_cliente = hash del nombre normalizado). No se detectaron variantes del mismo negocio en este corte, pero la heurística no prueba que no existan.",
    },
    {
      concepto: "Composición por SKU",
      estado: "parcial",
      nota: `${pct(lectura.composicion.coberturaFamilia)} de la composición tiene familia identificada. Sirve para "qué compra"; no es facturación y no se suma con la venta.`,
    },
    {
      concepto: "Cartera CxC",
      estado: "falta",
      nota: `La fuente saldos_odoo no forma parte del dataset comercial de Clientes, así que esta pantalla no calcula cartera. Vive en ${CXC_PENDIENTE_ENLACE.href}, con su propia fuente y su propio corte.`,
    },
    {
      concepto: "Relación factura ↔ pedido",
      estado: "falta",
      nota: `${entero(facturasConPedido)} de ${entero(dataset.facturas.length)} facturas traen id_venta. Sin ese vínculo no se puede decir qué pedido generó qué factura.`,
    },
    {
      concepto: "Antigüedad real del cliente",
      estado: "falta",
      nota: `No hay fecha de alta. Sólo primera compra registrada: ${entero(ytd.primeraCompraRegistrada)} en el año en curso, que no es lo mismo que clientes nuevos.`,
    },
    {
      concepto: "Vendedor asignado",
      estado: "falta",
      nota: "No está importado al snapshot. Ningún KPI de esta página reparte resultado por vendedor.",
    },
    {
      concepto: "Canal, segmento comercial y meta",
      estado: "falta",
      nota: "El canal se declara, no se observa; sin captura no existe. Ningún agente lo usa como definición final.",
    },
    {
      concepto: "Moneda de venta desde Supabase",
      estado: "falta",
      nota: `Los importes se leen tal cual vienen de Odoo y se rotulan ${MONEDA_CLIENTES}. La moneda por pedido no se re-afirma desde el snapshot ni se convierte.`,
    },
  ];
  const panelCobertura: PanelCoberturaB18 = {
    filas: filasCobertura,
    noAfirmable: NO_AFIRMABLE,
    procedencia: proc({
      moneda: "No aplica — este panel no es dinero",
      cobertura: {
        valor: parte(filasCobertura.filter((f) => f.estado === "existe").length, filasCobertura.length),
        etiqueta: "de los conceptos evaluados está completo en el snapshot",
      },
      limite: `${LIMITE_SNAPSHOT} Este panel enumera lo que falta; no lo suple.`,
    }),
  };

  return {
    // EXACTAMENTE cuatro, uno por slot, en orden detecta → recomienda.
    agentes: [agenteRecencia, agenteComparable, agenteConcentracion, agenteRecuperacion],
    b18: {
      cartera,
      recencia: panelRecencia,
      concentracion: panelConcentracion,
      serie: panelSerie,
      composicion: panelComposicion,
      cxc: panelCxc,
      cobertura: panelCobertura,
    },
    procedencia: proc(),
  };
}

function dosDecimales(valor: number) {
  return Math.round(valor * 100) / 100;
}
