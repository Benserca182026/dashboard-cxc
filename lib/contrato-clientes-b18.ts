/**
 * CONTRATO DE DATOS · CLIENTES · B18 — v3
 * ==================================================================
 * v3 (2026-09-01, aprobada). Dos cambios sobre v2:
 *
 *   1. `listaTotal` en LecturaAgenteClienteB18. Es el MISMO hueco que
 *      cerró `totalFilas` en v2, que sobrevivió donde nadie lo buscó:
 *      el drill-down del agente decía "12 clientes listados" sobre una
 *      lista recortada de 243. Un arreglo parcial deja el defecto vivo
 *      en el sitio que no se revisó.
 *
 *   2. `onVerFicha` en las props. Recupera la ficha individual de
 *      cliente sin que el componente toque el dataset: sólo avisa qué
 *      cliente se eligió, y la página la arma con `perfilClienteVentas`.
 *
 * v2 (2026-09-01). Tres cambios sobre v1, todos por hueco
 * detectado durante la construcción:
 *
 *   1. `totalFilas` en TramoRecenciaB18 y CorteConcentracionB18.
 *      Sin él la pantalla dice "10 clientes listados" junto a un tramo
 *      que dice 243, y no puede decir "10 de 243".
 *
 *   2. PanelCxcB18 pasa a tener ESTADO. `saldos_odoo` no está en el
 *      dataset comercial de Clientes, así que la sección no finge:
 *      se declara pendiente y enlaza a la página de cartera. Nunca un
 *      Q0.00, nunca un "No derivable" dentro de una ecuación, nunca la
 *      cartera bruta presentada como cálculo de Clientes.
 *
 *   3. El fixture de recencia se corrigió: cada cliente pertenece de
 *      verdad al tramo donde aparece, y hay una prueba que lo impide
 *      volver a romper.
 *
 * CONGELADO otra vez en v2. No lo modifica el Agente 1 ni el Agente 2.
 * Si algo acá está mal, se detiene el trabajo y lo corrige el
 * coordinador. Un contrato que se edita a mitad del trabajo no es un
 * contrato: son dos implementaciones que van a divergir en silencio.
 *
 * Agente 1 PRODUCE  -> construirMapaClientesB18(dataset): MapaClientesB18
 * Agente 2 CONSUME  -> <MapaB18Clientes mapa={mapa} />
 *
 * Ninguno de los dos importa nada del otro. El único punto de contacto
 * es este archivo y el fixture que lo acompaña.
 */

// ─── CAPAS · nunca se suman entre sí ──────────────────────────────
// La falla que persigue toda esta auditoría es presentar un número de
// una capa con el rótulo de otra. Por eso las capas son constantes,
// no texto libre que cada quien escribe a su manera.

/** Capa HECHO. Lo que Odoo cerró. Es la única que es facturación. */
export const CAPA_VENTA = "Venta confirmada · ventas.total_odoo_referencia";
/** Capa COMPOSICIÓN. Qué compra el cliente. NO es dinero facturado. */
export const CAPA_COMPOSICION = "Composición de líneas · no es facturación Odoo";
/** Capa CxC. Saldo, no venta. Nunca se mezcla con las dos anteriores. */
export const CAPA_CXC = "Cartera · saldo pendiente, no es venta del período";

export const MONEDA_CLIENTES = "GTQ · IVA 12% incluido";
export const ESTADO_CONFIRMADO = "sale";
export const FUENTE_CLIENTES = "snapshot Supabase · ventas + venta_lineas + clientes";

/**
 * El límite que va VISIBLE en pantalla, no en un comentario.
 * Odoo tiene 54 pedidos más que este snapshot. La pantalla representa
 * el snapshot al corte, y lo dice.
 */
export const LIMITE_SNAPSHOT =
  "Snapshot al corte. Odoo registra 54 pedidos adicionales no incluidos.";

/**
 * DIMENSIONES QUE NO SE PUEDEN AFIRMAR TODAVÍA.
 * Ningún agente inventa ninguna de estas. Si una hace falta para un
 * KPI, el KPI no se construye: se declara faltante en el panel de
 * cobertura. Está acá como dato duro para que la pantalla lo liste.
 */
export const NO_AFIRMABLE: readonly string[] = [
  "segmento comercial",
  "ecommerce",
  "meta",
  "canal como definición comercial final",
  "vendedor asignado — no está importado al snapshot",
  "alta real del cliente",
  "geografía",
  "relación factura ↔ pedido",
  "relación pago ↔ factura",
  "moneda de venta desde Supabase",
];

// ─── PROCEDENCIA · va en CADA lectura y en CADA panel ──────────────

export type ProcedenciaClientes = {
  /** De dónde salió. Usar FUENTE_CLIENTES salvo que el panel lea otra tabla. */
  fuente: string;
  /** Ventana observada, legible: "2022-08-01 → 2026-08-19". */
  periodo: string;
  /** DERIVADO de la última venta confirmada. Nunca escrito a mano. */
  corte: string;
  /** MONEDA_CLIENTES, o el rótulo de la capa si el panel no es dinero. */
  moneda: string;
  /** Qué parte del universo alcanza este panel, y CÓMO SE LLAMA ese %. */
  cobertura: { valor: number; etiqueta: string };
  /** Qué NO puede afirmarse con este panel. Nunca cadena vacía. */
  limite: string;
  /** Cuál de las tres capas es. */
  capa: string;
};

// ─── PIEZAS VISUALES REUTILIZABLES ────────────────────────────────

/** `ancho` y `alto` son 0-100 sobre el máximo de SU serie. Ya normalizados. */
export type BarraClientesB18 = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Ya formateado. El componente no formatea moneda. */
  texto: string;
  ancho: number;
  /** Período incompleto: agosto 2022 y agosto 2026. Se marca, no se oculta. */
  parcial: boolean;
  nota: string | null;
  /** Una línea, para el detalle al hacer clic. */
  detalle: string;
};

export type MetricaClientesB18 = {
  valor: string;
  etiqueta: string;
  /** Aclaración corta cuando el número se puede malinterpretar. */
  nota?: string;
};

/** Fila de cliente. Es la unidad clicable de todas las listas. */
export type FilaClienteB18 = {
  id: string;
  etiqueta: string;
  pedidos: number;
  valor: number;
  texto: string;
  /** Última compra confirmada, yyyy-mm-dd, o null si no la hay. */
  ultima: string | null;
  /** Días entre `ultima` y el corte. null si no hay última compra. */
  dias: number | null;
};

export type BarraComparativaClientes = { etiqueta: string; texto: string; ancho: number };
export type ComparativoClientesB18 = {
  titulo: string;
  /** Con signo: "+35.48%". */
  delta: string;
  actual: BarraComparativaClientes;
  previo: BarraComparativaClientes;
  /** Por qué son comparables: misma ventana de días del año anterior. */
  nota: string;
};

// ─── LOS CUATRO AGENTES ───────────────────────────────────────────
// Un KPI no se repite entre agentes. Si dos agentes muestran el mismo
// número, uno de los dos sobra.

export type AgenteClientesB18 = "recencia" | "comparable" | "concentracion" | "recuperacion";
export type SlotClientesB18 = "detecta" | "explica" | "prioriza" | "recomienda";

export type LecturaAgenteClienteB18 = {
  id: AgenteClientesB18;
  slot: SlotClientesB18;
  /** Dos letras. */
  iniciales: string;
  nombre: string;
  titulo: string;
  /** Hex. */
  color: string;
  /** UNA línea. El agente lateral no explica: señala. */
  senal: string;
  pregunta: string;
  kpi: string;
  kpiEtiqueta: string;
  /** Micrográfico de la tarjeta lateral, 0-100. Entre 4 y 12 puntos. */
  micro: { etiqueta: string; alto: number; parcial: boolean }[];
  /** Gráfico principal del drill-down. */
  barras: BarraClientesB18[];
  metricas: MetricaClientesB18[];
  /** Lista clicable. Vacía si el agente no tiene una. Puede venir truncada. */
  lista: FilaClienteB18[];
  /**
   * v3 · Cuántos clientes componen la lectura, antes de truncar.
   * Mismo motivo que `totalFilas` en recencia y concentración: una lista
   * recortada que dice sólo "12 clientes listados" afirma un tamaño que no
   * tiene. Con esto la pantalla dice "12 de 243".
   */
  listaTotal: number;
  comparativo: ComparativoClientesB18 | null;
  /** Qué se observa. */
  hallazgo: string;
  /** Qué está mal o en riesgo. Es lo que abre este agente al hacer clic. */
  problema: string;
  /** Qué hacer. Accionable, no genérico. */
  accion: string;
  /** La fórmula literal, para poder auditarla sin abrir el código. */
  formula: string;
  procedencia: ProcedenciaClientes;
};

// ─── B18 · LAS SIETE SECCIONES ────────────────────────────────────
// B18 NO es un quinto KPI. Es el dashboard integral de Clientes.

export type SeccionB18Clientes =
  | "cartera" | "recencia" | "concentracion" | "serie"
  | "composicion" | "cxc" | "cobertura";

export type PanelCarteraB18 = {
  metricas: MetricaClientesB18[];
  procedencia: ProcedenciaClientes;
};

export type ClaveRecencia = "0-30" | "31-60" | "61-90" | "90+";
export type TramoRecenciaB18 = {
  clave: ClaveRecencia;
  etiqueta: string;
  clientes: number;
  /** 0-100 sobre el tramo mayor. */
  ancho: number;
  valor: number;
  texto: string;
  /** Los clientes del tramo, mayor valor primero. Clicable. Puede venir truncada. */
  filas: FilaClienteB18[];
  /**
   * v2 · Cuántos clientes hay EN TOTAL en el tramo, antes de truncar.
   * `filas.length` puede ser menor. La pantalla debe poder decir
   * "10 de 243", nunca sólo "10 clientes listados".
   */
  totalFilas: number;
};
export type PanelRecenciaB18 = {
  tramos: TramoRecenciaB18[];
  procedencia: ProcedenciaClientes;
};

export type ClaveConcentracion = "top1" | "top5" | "top10" | "top20" | "top50";
export type CorteConcentracionB18 = {
  clave: ClaveConcentracion;
  etiqueta: string;
  /** Participación 0-100 sobre la venta del período. */
  pct: number;
  valor: number;
  texto: string;
  filas: FilaClienteB18[];
  /** v2 · Cuántos clientes componen el corte, antes de truncar. Ver TramoRecenciaB18. */
  totalFilas: number;
};
export type PanelConcentracionB18 = {
  cortes: CorteConcentracionB18[];
  procedencia: ProcedenciaClientes;
};

export type PuntoSerieClientesB18 = {
  /** "2025-03". */
  clave: string;
  etiqueta: string;
  clientes: number;
  pedidos: number;
  valor: number;
  texto: string;
  /** agosto 2022 y agosto 2026 SIEMPRE true. */
  parcial: boolean;
  nota: string | null;
};
export type PanelSerieB18 = {
  meses: PuntoSerieClientesB18[];
  maxClientes: number;
  maxPedidos: number;
  maxValor: number;
  procedencia: ProcedenciaClientes;
};

export type FilaComposicionB18 = {
  etiqueta: string;
  unidades: number;
  valor: number;
  ancho: number;
  texto: string;
};
export type PanelComposicionB18 = {
  filas: FilaComposicionB18[];
  /** CAPA_COMPOSICION, visible en pantalla. */
  advertencia: string;
  procedencia: ProcedenciaClientes;
};

/**
 * v2 · ESTADO DE LA SECCIÓN CxC.
 *
 * "pendiente" es el estado de HOY: `saldos_odoo` —la fuente que sostiene
 * cartera bruta, saldo a favor y neta— no forma parte del dataset comercial
 * de Clientes. Se lee por red en lib/verificacionOdoo.ts, no desde `Dataset`.
 *
 * Mientras esté pendiente, la sección NO muestra:
 *   · ningún Q0.00 en lugar de un dato que falta,
 *   · ningún "No derivable" dentro de una ecuación,
 *   · ni la cartera bruta como si fuera un cálculo de Clientes.
 *
 * Dice que falta, y manda a la página que sí la tiene. Un número inventado
 * es indistinguible de uno medido; ése es el defecto que esta pantalla
 * existe para no cometer.
 */
export type EstadoPanelCxc = "integrado" | "pendiente";

export const CXC_PENDIENTE_MENSAJE =
  "CxC contextual pendiente de integrar a esta vista. La fuente saldos_odoo no forma parte todavía del dataset comercial de Clientes.";

/**
 * La página de cartera del proyecto es /aging (barra lateral, grupo
 * "Cartera"). NO existe la ruta /cuentas-por-cobrar: enlazarla daría 404.
 */
export const CXC_PENDIENTE_ENLACE = {
  href: "/aging",
  texto: "Abrir Cuentas por cobrar · Aging",
} as const;

export type PanelCxcB18 = {
  estado: EstadoPanelCxc;
  /**
   * Poblado SOLO si `estado === "integrado"`. Mientras sea "pendiente" va
   * en `null` — no en ceros. El tipo impide dibujar la ecuación sin datos.
   */
  cifras: {
    bruta: MetricaClientesB18;
    saldoFavor: MetricaClientesB18;
    neta: MetricaClientesB18;
  } | null;
  /** Poblado SOLO si `estado === "pendiente"`. */
  pendiente: {
    /** CXC_PENDIENTE_MENSAJE, literal. */
    mensaje: string;
    /** CXC_PENDIENTE_ENLACE. */
    enlace: { href: string; texto: string };
  } | null;
  /** CAPA_CXC, visible en pantalla. */
  advertencia: string;
  procedencia: ProcedenciaClientes;
};

export type EstadoCobertura = "existe" | "parcial" | "falta";
export type FilaCoberturaB18 = {
  concepto: string;
  estado: EstadoCobertura;
  nota: string;
};
export type PanelCoberturaB18 = {
  filas: FilaCoberturaB18[];
  /** NO_AFIRMABLE, listado en pantalla. */
  noAfirmable: readonly string[];
  procedencia: ProcedenciaClientes;
};

// ─── LA RAÍZ ──────────────────────────────────────────────────────

export type MapaClientesB18 = {
  /** EXACTAMENTE cuatro, uno por slot, en orden detecta→recomienda. */
  agentes: LecturaAgenteClienteB18[];
  b18: {
    cartera: PanelCarteraB18;
    recencia: PanelRecenciaB18;
    concentracion: PanelConcentracionB18;
    serie: PanelSerieB18;
    composicion: PanelComposicionB18;
    cxc: PanelCxcB18;
    cobertura: PanelCoberturaB18;
  };
  /** Procedencia global de la página: la que va bajo el título. */
  procedencia: ProcedenciaClientes;
};

/** FIRMA EXACTA que debe exportar lib/agentes-clientes-b18.ts */
export type ConstructorMapaClientes = (dataset: never) => MapaClientesB18;

/** PROPS EXACTAS que debe aceptar components/commercial/MapaB18Clientes.tsx */
export type PropsMapaB18Clientes = {
  mapa: MapaClientesB18;
  /** Formateador de moneda de la app. El componente NO formatea. */
  fmt?: (valor: number) => string;
  /**
   * v3 · Abre la ficha individual del cliente. Lo dispara el botón
   * "Ver ficha del cliente" de cualquier listado — recencia, concentración
   * o drill-down de agente.
   *
   * El mapa NO trae la ficha: la arma la página con `perfilClienteVentas`,
   * que lee el dataset. El componente sigue sin calcular nada; sólo avisa
   * qué cliente se eligió. Si la prop no viene, el botón no se dibuja.
   */
  onVerFicha?: (clienteId: string) => void;
};
