/**
 * LECTURA VIVA DE ODOO — no es un snapshot de Supabase.
 *
 * Todas las cifras de este archivo salieron de consultas de SOLO LECTURA
 * ejecutadas contra la base de Odoo en producción (3digitalgt-benserca),
 * por JSON-RPC a /web/dataset/call_kw, con los métodos search_read,
 * search_count y read_group. Ninguna escritura, en ningún momento.
 *
 * POR QUÉ ESTÁN AQUÍ CONGELADAS Y NO SE LEEN EN CALIENTE
 * -----------------------------------------------------
 * Este proyecto NO tiene hoy una credencial de servidor para Odoo. Se
 * verificó: no existe archivo .env, no existen variables ODOO_URL / ODOO_DB /
 * ODOO_USER / ODOO_PASSWORD / ODOO_API_KEY en el entorno, y `_odoo.mjs` —el
 * único mecanismo de acceso del repo— exige un navegador Chromium abierto con
 * sesión iniciada a mano y depuración remota en el puerto 9333. Ese camino
 * sirve para investigar desde una terminal; no sirve para que una página
 * Next.js resuelva un render.
 *
 * Por eso estas cifras son una LECTURA VIVA FECHADA: se leyeron de Odoo en
 * vivo a la hora exacta de SELLO_LECTURA, y quedaron escritas. No son un
 * snapshot de Supabase (ese está congelado en 2026-08-19 y no contiene ningún
 * campo de vendedor), pero tampoco son un vivo permanente.
 *
 * Para que las páginas lean Odoo en cada request hacen falta esas variables de
 * entorno y un cliente server-only. Está declarado en el resumen de entrega y
 * repetido en el metadato "Límite" de cada categoría.
 *
 * REGLA DE MONEDA
 * ---------------
 * Todo agregado monetario filtra currency_id.name = 'GTQ' de forma explícita.
 * Existe exactamente 1 pedido en USD (sale.order S00013, 2022-09-19,
 * USD 453.39, cliente sin cartera asignada, departamento San Salvador (SV)).
 * Ese pedido queda FUERA de toda suma y se declara aparte. No se convierte:
 * haría falta la tasa fechada del 2022-09-19, que no se tiene.
 */

/** Hora exacta de la última consulta que alimentó este archivo (UTC). */
export const SELLO_LECTURA = "2026-09-03T06:47:53Z";

/** La misma hora en el huso de Guatemala (UTC-6), para leerla sin traducir. */
export const SELLO_LECTURA_LOCAL = "2026-09-03 00:47 (GT, UTC-6)";

/**
 * La frase que va en el metadato "Límite" de toda categoría que lea Odoo vivo.
 * Es literal y no se resume: durante esta misma sesión, entre dos consultas
 * separadas por minutos, CARLOS FLORES pasó de 55 a 56 clientes en cartera,
 * "Sin dueño" bajó de 210 a 209, y el total de pedidos confirmados subió de
 * 3.243 a 3.244 y volvió a 3.243 al filtrar moneda. Eso no fue un error de
 * medición: fue gente trabajando en Odoo mientras se medía.
 */
export const LIMITE_VIVO =
  "Odoo vivo, no snapshot — una nueva consulta puede dar un número distinto al mostrado; esto no es un error, es el sistema moviéndose. Además, la página no consulta Odoo al renderizar: muestra la lectura fechada en Corte, porque el proyecto no tiene todavía credencial server-only para Odoo.";

/**
 * La misma advertencia, en UNA línea. El pie de las categorías B18 muestra
 * sólo tres metadatos —Corte, Moneda, Límite— y éste es el Límite: lo que el
 * lector necesita saber, sin el detalle de implementación. Fuente y Capa no
 * desaparecieron: viven en el JSDoc de cada categoría, para quien construye.
 */
export const LIMITE_CORTO =
  "Lectura fechada de Odoo, no consulta en vivo — una nueva consulta puede dar otro número.";

/** El mismo Límite para categorías que comparan años con 2026 todavía abierto. */
export const LIMITE_CORTO_EN_CURSO =
  "Lectura fechada de Odoo, no consulta en vivo — una nueva consulta puede dar otro número, y 2026 está en curso.";

/** Dominio Odoo común a todo agregado de venta confirmada en quetzales. */
export const DOMINIO_VENTA_GTQ =
  "[['state','in',['sale','done']],['currency_id.name','=','GTQ']]";

export const MONEDA_DECLARADA =
  "GTQ. Se excluye 1 pedido en USD (S00013, 2022-09-19, USD 453.39) sin convertirlo.";

/** Formato de quetzales, propio de este módulo. */
export function q(monto: number): string {
  return `Q${monto.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pct(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 10000) / 100;
}

// ─────────────────────────────────────────────────────────────────────────
// UNIVERSO MEDIDO
// ─────────────────────────────────────────────────────────────────────────

/** sale.order, state in (sale,done), currency GTQ. read_group sin agrupar. */
export const VENTA_TOTAL_GTQ = 19_522_778.78;
export const PEDIDOS_TOTAL_GTQ = 3_243;

/** res.partner con customer_rank > 0. search_count. */
export const CLIENTES_TOTAL = 417;

/** El pedido en dólares, declarado y nunca sumado. */
export const PEDIDO_USD = { referencia: "S00013", fecha: "2022-09-19", monto: 453.39 };

// ─────────────────────────────────────────────────────────────────────────
// A) CARTERA ASIGNADA — res.partner.user_id
//    "¿Quién es responsable de atender la relación con este cliente?"
// ─────────────────────────────────────────────────────────────────────────

export type FilaCartera = {
  vendedor: string;
  /** id de res.users; null cuando el cliente no tiene responsable. */
  usuarioId: number | null;
  clientes: number;
  pedidos: number;
  venta: number;
};

/** read_group de res.partner por user_id, cruzado con venta GTQ por cliente. */
export const CARTERA_ASIGNADA: FilaCartera[] = [
  { vendedor: "ADMINISTRACION", usuarioId: 7, clientes: 33, pedidos: 728, venta: 7_865_989.82 },
  { vendedor: "ANDERSON GONZALEZ", usuarioId: 8, clientes: 70, pedidos: 919, venta: 4_995_797.52 },
  { vendedor: "Sin responsable", usuarioId: null, clientes: 209, pedidos: 830, venta: 3_405_821.66 },
  { vendedor: "CARLOS FLORES", usuarioId: 12, clientes: 56, pedidos: 529, venta: 2_216_103.11 },
  { vendedor: "JUAN VELASQUEZ", usuarioId: 10, clientes: 49, pedidos: 237, venta: 1_039_066.67 },
];

export const CLIENTES_CON_CARTERA = 208;
export const CLIENTES_SIN_CARTERA = 209;
/** 208 de 417. */
export const COBERTURA_CARTERA = 49.88;

// ─────────────────────────────────────────────────────────────────────────
// B) FACTURADO POR — sale.order.user_id
//    "¿Qué usuario emitió o registró este pedido?"
//    NO es lo mismo que A y nunca se suma con A.
// ─────────────────────────────────────────────────────────────────────────

export type FilaFacturado = {
  usuario: string;
  usuarioId: number | null;
  pedidos: number;
  venta: number;
};

/** read_group de sale.order por user_id, filtrado GTQ. */
export const FACTURADO_POR: FilaFacturado[] = [
  { usuario: "ADMINISTRACION", usuarioId: 7, pedidos: 2_783, venta: 17_449_946.57 },
  { usuario: "ANDERSON GONZALEZ", usuarioId: 8, pedidos: 258, venta: 1_220_589.78 },
  { usuario: "JUAN VELASQUEZ", usuarioId: 10, pedidos: 101, venta: 476_986.49 },
  { usuario: "CARLOS FLORES", usuarioId: 12, pedidos: 98, venta: 369_775.34 },
  { usuario: "Sin usuario", usuarioId: null, pedidos: 3, venta: 5_480.60 },
];

/**
 * ADMINISTRACION concentra el 89.38% de lo facturado. La evidencia disponible
 * apunta a cuenta de registro administrativo, no a vendedor de campo: login
 * admin.gtm@ frente a ventas.guatemala@ y ventas2.gtm@; pertenece a los grupos
 * Sales/Administrator y "All Documents" mientras los tres vendedores están en
 * "Own Documents Only"; es el único usuario con pedidos anteriores a feb-2026;
 * y sus pedidos por mes caen de 106 a 13 justo cuando entran los vendedores.
 * La clasificación formal es una decisión de Comercial, todavía no tomada.
 */
export const ADMIN_ES_CUENTA_DE_REGISTRO = true;
export const ADMIN_PCT_FACTURADO = 89.38;

// ─────────────────────────────────────────────────────────────────────────
// BRECHA — clientes sin responsable que SÍ compran
// ─────────────────────────────────────────────────────────────────────────

export const SIN_DUENIO_VENTA = 3_405_821.66;
export const SIN_DUENIO_PEDIDOS = 830;
/** De los 209 clientes sin responsable, cuántos tienen al menos un pedido. */
export const SIN_DUENIO_COMPRADORES = 162;

export type CuentaHuerfana = {
  clienteId: number;
  pedidos: number;
  venta: number;
  region: string;
};

/** Los mayores por venta, entre los clientes sin responsable asignado. */
export const SIN_DUENIO_TOP: CuentaHuerfana[] = [
  { clienteId: 257, pedidos: 57, venta: 463_891.70, region: "Guatemala (GT)" },
  { clienteId: 319, pedidos: 123, venta: 279_140.70, region: "Guatemala (GT)" },
  { clienteId: 332, pedidos: 8, venta: 249_538.60, region: "Chimaltenango (GT)" },
  { clienteId: 152, pedidos: 6, venta: 192_525.31, region: "Suchitepequez (GT)" },
  { clienteId: 137, pedidos: 9, venta: 104_595.60, region: "Guatemala (GT)" },
  { clienteId: 196, pedidos: 9, venta: 98_997.25, region: "Chimaltenango (GT)" },
];

// ─────────────────────────────────────────────────────────────────────────
// HUÉRFANOS — el rastro del vendedor dado de baja
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fuente: mail.tracking.value cruzado con mail.message, buscando los cambios
 * del campo res.partner.user_id cuyo valor NUEVO fue "KEVIN LOPEZ". No sale de
 * ninguna tabla de "vendedor actual": ese usuario ya no existe en res.users
 * (fue borrado, no desactivado), así que su cartera sólo sobrevive en el
 * historial de reasignaciones.
 *
 * 41 clientes pasaron por su cartera entre jul-2024 y nov-2025. 24 fueron
 * reasignados después, casi todos a CARLOS FLORES y ANDERSON GONZALEZ.
 * 17 nunca se reasignaron y hoy no tienen responsable.
 */
export const KEVIN_CLIENTES_TOCADOS = 41;
export const KEVIN_REASIGNADOS = 24;
export const KEVIN_HUERFANOS = 17;
export const KEVIN_HUERFANOS_PEDIDOS = 147;
export const KEVIN_HUERFANOS_VENTA = 927_289.76;

// ─────────────────────────────────────────────────────────────────────────
// TOP CUENTAS — las mayores del negocio, con su responsable al lado
// ─────────────────────────────────────────────────────────────────────────

export type CuentaGrande = {
  clienteId: number;
  pedidos: number;
  venta: number;
  /** Responsable de CARTERA (res.partner.user_id), no quien facturó. */
  responsable: string;
};

export const TOP_CUENTAS: CuentaGrande[] = [
  { clienteId: 95, pedidos: 147, venta: 2_640_275.16, responsable: "ADMINISTRACION" },
  { clienteId: 109, pedidos: 71, venta: 968_789.60, responsable: "ADMINISTRACION" },
  { clienteId: 339, pedidos: 8, venta: 773_962.20, responsable: "ADMINISTRACION" },
  { clienteId: 67, pedidos: 78, venta: 662_878.13, responsable: "ANDERSON GONZALEZ" },
  { clienteId: 39, pedidos: 64, venta: 646_400.54, responsable: "ADMINISTRACION" },
  { clienteId: 22, pedidos: 31, venta: 577_353.53, responsable: "ADMINISTRACION" },
  { clienteId: 257, pedidos: 57, venta: 463_891.70, responsable: "Sin responsable" },
  { clienteId: 78, pedidos: 59, venta: 389_500.29, responsable: "ADMINISTRACION" },
  { clienteId: 115, pedidos: 179, venta: 371_983.41, responsable: "ANDERSON GONZALEZ" },
  { clienteId: 74, pedidos: 42, venta: 354_936.47, responsable: "ANDERSON GONZALEZ" },
];

// ─────────────────────────────────────────────────────────────────────────
// REGIÓN — res.partner.state_id (departamento)
// ─────────────────────────────────────────────────────────────────────────

export type FilaRegion = {
  region: string;
  clientes: number;
  pedidos: number;
  venta: number;
};

/** Venta GTQ agrupada por departamento del cliente. 21 filas con dato. */
export const VENTA_POR_REGION: FilaRegion[] = [
  { region: "Guatemala (GT)", clientes: 111, pedidos: 1_639, venta: 10_389_148.06 },
  { region: "Sin departamento", clientes: 12, pedidos: 176, venta: 2_734_851.32 },
  { region: "Quetzaltenango (GT)", clientes: 30, pedidos: 308, venta: 1_255_281.64 },
  { region: "Chimaltenango (GT)", clientes: 23, pedidos: 197, venta: 1_145_184.36 },
  { region: "Huehuetenango (GT)", clientes: 28, pedidos: 275, venta: 947_581.47 },
  { region: "Suchitepequez (GT)", clientes: 24, pedidos: 132, venta: 745_600.67 },
  { region: "Sacatepequez (GT)", clientes: 5, pedidos: 74, venta: 440_652.78 },
  { region: "Quiché (GT)", clientes: 25, pedidos: 72, venta: 350_942.91 },
  { region: "San Marcos (GT)", clientes: 21, pedidos: 92, venta: 315_850.33 },
  { region: "Alta Verapaz (GT)", clientes: 19, pedidos: 57, venta: 271_118.63 },
  { region: "Retalhuleu (GT)", clientes: 12, pedidos: 51, venta: 236_967.12 },
  { region: "Totonicapán (GT)", clientes: 5, pedidos: 29, venta: 205_626.75 },
  { region: "Sololá (GT)", clientes: 9, pedidos: 35, venta: 166_560.84 },
  { region: "Escuintla (GT)", clientes: 15, pedidos: 42, venta: 149_997.80 },
  { region: "El Petén (GT)", clientes: 11, pedidos: 32, venta: 86_503.53 },
  { region: "Baja Verapaz (GT)", clientes: 5, pedidos: 10, venta: 29_628.47 },
  { region: "Jutiapa (GT)", clientes: 3, pedidos: 7, venta: 11_881.15 },
  { region: "Izabal (GT)", clientes: 2, pedidos: 6, venta: 11_086.30 },
  { region: "Santa Rosa (GT)", clientes: 3, pedidos: 5, venta: 9_761.50 },
  { region: "Jalapa (GT)", clientes: 2, pedidos: 2, venta: 7_860.00 },
  { region: "Zacapa (GT)", clientes: 1, pedidos: 1, venta: 5_911.95 },
];

/** res.partner con state_id poblado, sobre el total de clientes. */
export const CLIENTES_CON_REGION = 371;
export const COBERTURA_REGION = 88.97;

/** res.partner.city: poblado en 1 de 417. Inservible como dimensión. */
export const CLIENTES_CON_CIUDAD = 1;

// ─────────────────────────────────────────────────────────────────────────
// EMPRESA — res.company
// ─────────────────────────────────────────────────────────────────────────

/**
 * search_read sobre res.company devuelve UNA sola compañía: "Benserca 18 SA"
 * (id 1), y los 3.243 pedidos confirmados pertenecen a ella. No hay
 * multi-empresa que comparar: la dimensión existe en el modelo pero tiene un
 * único valor, así que cualquier reparto por empresa daría 100% en una barra.
 */
export const COMPANIAS = [{ id: 1, nombre: "Benserca 18 SA", pedidos: 3_243 }];
export const HAY_MULTIEMPRESA = false;

// ─────────────────────────────────────────────────────────────────────────
// CRM — crm.lead
// ─────────────────────────────────────────────────────────────────────────

/**
 * El módulo CRM está instalado (crm.stage tiene 4 etapas configuradas), pero
 * crm.lead tiene 0 registros: nadie ha creado una sola oportunidad. No es que
 * falte permiso de lectura —la consulta corrió sin error—, es que no hay nada
 * que leer. Por eso /crm queda en estado "sin fuente" y no en "0%".
 */
export const CRM_LEADS = 0;
export const CRM_ETAPAS_CONFIGURADAS = 4;

// ─────────────────────────────────────────────────────────────────────────
// PIPELINE — lo único que Odoo vivo tiene y el snapshot no
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cotizaciones abiertas: 17 en borrador por Q88,321.92; ninguna en "enviada".
 * Es dato genuinamente ausente del snapshot de Supabase, pero representa el
 * 0.45% de la venta confirmada histórica: demasiado delgado para sostener una
 * página de Forecast de cuatro categorías. Ver el resumen de entrega.
 */
export const COTIZACIONES_ABIERTAS = 17;
export const COTIZACIONES_MONTO = 88_321.92;

// ═════════════════════════════════════════════════════════════════════════
// LECTURA DEL 2026-09-03 06:47:53Z — los ángulos que faltaban
//
// Todo lo que sigue se leyó en la misma sesión de consultas de solo lectura
// del sello de arriba. Los valores base (417 clientes, 3.243 pedidos,
// Q19,522,778.78, cartera 33/70/56/49/209) se reverificaron y no cambiaron.
// ═════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// A2) COBERTURA MEDIDA EN TRES UNIDADES DISTINTAS
//     El mismo hecho —"¿tiene responsable?"— contado por clientes, por
//     pedidos y por dinero. Los tres números NO coinciden, y esa distancia
//     es el hallazgo: la mitad sin dueño pesa mucho menos de lo que su
//     conteo de fichas sugiere.
// ─────────────────────────────────────────────────────────────────────────

/**
 * sale.order (dominio DOMINIO_VENTA_GTQ) cruzado con res.partner.user_id del
 * cliente: 2.413 de los 3.243 pedidos vienen de un cliente que SÍ tiene
 * responsable de cartera.
 */
export const COBERTURA_POR_PEDIDOS = 74.41;
export const PEDIDOS_CON_CARTERA = 2_413;

/**
 * La misma partición, sumando amount_total en vez de contar pedidos:
 * Q16,116,957.12 de Q19,522,778.78.
 */
export const COBERTURA_POR_DINERO = 82.55;
export const VENTA_CON_CARTERA = 16_116_957.12;

/**
 * Venta acumulada POR CLIENTE dentro de cada cartera: la venta atribuida al
 * responsable dividida entre los clientes que tiene asignados. Es el mismo
 * read_group de CARTERA_ASIGNADA, leído por VALOR y no por CANTIDAD.
 * ADMINISTRACION / JUAN VELASQUEZ = 11.24x.
 */
export const VENTA_POR_CLIENTE_CARTERA: { vendedor: string; porCliente: number }[] = [
  { vendedor: "ADMINISTRACION", porCliente: 238_363.33 },
  { vendedor: "ANDERSON GONZALEZ", porCliente: 71_368.54 },
  { vendedor: "CARLOS FLORES", porCliente: 39_573.27 },
  { vendedor: "JUAN VELASQUEZ", porCliente: 21_205.44 },
  { vendedor: "Sin responsable", porCliente: 16_295.80 },
];

/** ADMINISTRACION contra el vendedor de campo con menor venta por cliente. */
export const VENTA_POR_CLIENTE_MULTIPLO = 11.24;

/**
 * Cartera "de campo" si ADMINISTRACION se declara cuenta de registro:
 * 70 + 56 + 49 = 175 clientes sobre los 417. La cobertura cae de 49.88% a
 * 41.97%. Es el precio, en puntos, de una decisión todavía no tomada.
 */
export const CARTERA_CAMPO_CLIENTES = 175;
export const COBERTURA_CAMPO = 41.97;

// ─────────────────────────────────────────────────────────────────────────
// A3) RECENCIA DE LOS 209 SIN RESPONSABLE
//     max(sale.order.date_order) por cliente, contra el 2026-09-03. Cortar
//     "209 sin dueño" por última compra convierte un bloque inaccionable en
//     cuatro decisiones distintas.
// ─────────────────────────────────────────────────────────────────────────

export const SIN_DUENIO_ACTIVOS_90D = 6;
export const SIN_DUENIO_ENTRE_90_180 = 4;
export const SIN_DUENIO_DORMIDOS_180 = 152;
export const SIN_DUENIO_NUNCA_COMPRARON = 47; // 6 + 4 + 152 + 47 = 209

/**
 * Los mismos Q3,405,821.66 y 830 pedidos de SIN_DUENIO_VENTA, cortados por la
 * recencia del cliente. Las tres franjas suman exactamente el total: los 47
 * que nunca compraron no aportan venta, por definición.
 */
export const SIN_DUENIO_VENTA_ACTIVOS = 502_940.93;
export const SIN_DUENIO_PEDIDOS_ACTIVOS = 174;
export const SIN_DUENIO_VENTA_90_180 = 592_759.89;
export const SIN_DUENIO_PEDIDOS_90_180 = 82;
export const SIN_DUENIO_VENTA_DORMIDOS = 2_310_120.84;
export const SIN_DUENIO_PEDIDOS_DORMIDOS = 574;
// 502,940.93 + 592,759.89 + 2,310,120.84 = 3,405,821.66 exactos
// 174 + 82 + 574 = 830 pedidos exactos

/** 2,310,120.84 sobre 3,405,821.66: dos tercios del dinero sin dueño es historia. */
export const SIN_DUENIO_PCT_DORMIDOS = 67.83;

// ─────────────────────────────────────────────────────────────────────────
// B2) BRECHA REAL, MEDIDA PEDIDO POR PEDIDO
//     Para cada sale.order se comparó el responsable de cartera del cliente
//     (res.partner.user_id) contra el usuario que registró el pedido
//     (sale.order.user_id). No son dos distribuciones puestas lado a lado:
//     es una comparación fila a fila. Las cuatro clases cierran en los 3.243
//     pedidos y en los Q19,522,778.78 exactos.
// ─────────────────────────────────────────────────────────────────────────

export type ClaseBrecha = { pedidos: number; venta: number };

/** El responsable de la cuenta ES quien registró el pedido. 50.35%. */
export const BRECHA_COINCIDE: ClaseBrecha = { pedidos: 1_165, venta: 9_829_946.43 };
/** El cliente tiene responsable, pero el pedido lo registró otro usuario. 32.19%. */
export const BRECHA_DIVERGE: ClaseBrecha = { pedidos: 1_246, venta: 6_283_680.09 };
/** El cliente no tiene responsable de cartera. 17.45%. */
export const BRECHA_SIN_CARTERA: ClaseBrecha = { pedidos: 830, venta: 3_405_821.66 };
/** El pedido no tiene sale.order.user_id. 0.02%. */
export const BRECHA_SIN_USUARIO: ClaseBrecha = { pedidos: 2, venta: 3_330.60 };
// 1.165 + 1.246 + 830 + 2 = 3.243 pedidos

export const BRECHA_PCT_COINCIDE = 50.35;
export const BRECHA_PCT_DIVERGE = 32.19;
export const BRECHA_PCT_SIN_CARTERA = 17.45;
export const BRECHA_PCT_SIN_USUARIO = 0.02;

/**
 * Los 1.246 pedidos divergentes, abiertos por par (responsable de cartera ->
 * usuario que registró). read_group cruzado sobre las dos dimensiones.
 * 670 + 421 + 143 + 4 + 7 + 1 = 1.246 pedidos, Q6,283,680.09 exactos.
 */
export const DIVERGENCIA_PARES: { par: string; pedidos: number; venta: number }[] = [
  { par: "ANDERSON GONZALEZ -> ADMINISTRACION", pedidos: 670, venta: 3_843_290.94 },
  { par: "CARLOS FLORES -> ADMINISTRACION", pedidos: 421, venta: 1_777_385.87 },
  { par: "JUAN VELASQUEZ -> ADMINISTRACION", pedidos: 143, venta: 591_370.98 },
  { par: "CARLOS FLORES -> ANDERSON GONZALEZ", pedidos: 4, venta: 40_996.30 },
  { par: "CARLOS FLORES -> JUAN VELASQUEZ", pedidos: 7, venta: 29_290.80 },
  { par: "ANDERSON GONZALEZ -> CARLOS FLORES", pedidos: 1, venta: 1_345.20 },
];

/**
 * 1.234 de los 1.246 pedidos (98.96%) y Q6,212,047.79 de Q6,283,680.09
 * (98.86%) son del tipo "vendedor de campo -> ADMINISTRACION". Sólo 12 pedidos
 * por Q71,632.30 son vendedor -> vendedor. La divergencia es registro
 * administrativo centralizado, NO indisciplina comercial.
 */
export const DIVERGENCIA_HACIA_ADMIN_PEDIDOS = 1_234;
export const DIVERGENCIA_HACIA_ADMIN_VENTA = 6_212_047.79;
export const DIVERGENCIA_HACIA_ADMIN_PCT = 98.86;
export const DIVERGENCIA_HACIA_ADMIN_PCT_PEDIDOS = 98.96;
export const DIVERGENCIA_ENTRE_VENDEDORES_PEDIDOS = 12;
export const DIVERGENCIA_ENTRE_VENDEDORES_VENTA = 71_632.30;

// ─────────────────────────────────────────────────────────────────────────
// C2) HISTORIAL COMPLETO DE CAMBIOS DE CARTERA
//     mail.tracking.value sobre el campo res.partner.user_id, cruzado con
//     mail.message para fecha y autor. Es el mismo rastro del que salió el
//     caso KEVIN, pero leído entero en vez de filtrado por un solo nombre.
// ─────────────────────────────────────────────────────────────────────────

export const HISTORIAL_CAMBIOS_TOTAL = 201;
export const HISTORIAL_DESDE = "2025-07-09";
export const HISTORIAL_HASTA = "2026-09-02";

/** Cambios cuyo valor ANTERIOR estaba vacío: el cliente no tenía responsable. */
export const HISTORIAL_PRIMERA_ASIGNACION = 168;
/** Cambios de un responsable a otro: traspaso real de cuenta. 168 + 33 = 201. */
export const HISTORIAL_TRASPASO_REAL = 33;
/** Cambios que dejaron el campo vacío. Ninguno: nunca se quitó sin reponer. */
export const HISTORIAL_QUITARON_RESPONSABLE = 0;

/** Quién ejecutó los cambios (autor del mail.message). 138 + 63 = 201. */
export const HISTORIAL_AUTORES: { autor: string; cambios: number }[] = [
  { autor: "ADMINISTRACION", cambios: 138 },
  { autor: "ALISON CAROL SUCELY FLORES", cambios: 63 },
];

/**
 * Nombres distintos que alguna vez aparecieron como valor NUEVO de
 * res.partner.user_id: 7. Dos de ellos ya no existen hoy en res.users, pero
 * por razones opuestas:
 *  - "KEVIN LOPEZ" (41 cambios) es una persona real dada de baja.
 *  - "Administración" (1 cambio, con acento y minúsculas) NO es una persona:
 *    es un ARTEFACTO DE TEXTO, otra forma de escribir el mismo usuario.
 * Por eso el caso KEVIN es EXCEPCIÓN y no patrón: hay un vendedor perdido, no
 * dos.
 */
export const HISTORIAL_RESPONSABLES_DISTINTOS = 7;
export const HISTORIAL_RESPONSABLES_INEXISTENTES = 2;
export const HISTORIAL_KEVIN_CAMBIOS = 41;
export const HISTORIAL_ARTEFACTO_TEXTO = "Administración";
export const HISTORIAL_ARTEFACTO_CAMBIOS = 1;

// ─────────────────────────────────────────────────────────────────────────
// D2) TOP 20 CUENTAS
//     sale.order agrupado por partner_id, dominio DOMINIO_VENTA_GTQ, ordenado
//     por venta y cortado en 20. El top 10 ya estaba en TOP_CUENTAS; entre el
//     puesto 11 y el 20 hay 13 puntos más de concentración.
// ─────────────────────────────────────────────────────────────────────────

export const TOP20_TOTAL = 10_468_097.26;
/** 10,468,097.26 sobre 19,522,778.78. */
export const TOP20_PCT_VENTA = 53.62;

/** Las 20, repartidas por responsable de CARTERA. 9 + 8 + 3 = 20 cuentas. */
export const TOP20_ADMIN = { cuentas: 9, venta: 6_835_502.04 };
export const TOP20_CAMPO = { cuentas: 8, venta: 2_640_024.22 };
export const TOP20_SIN_RESPONSABLE = { cuentas: 3, venta: 992_571.00 };
// 6,835,502.04 + 2,640,024.22 + 992,571.00 = 10,468,097.26 exactos
export const TOP20_PCT_ADMIN = 65.30;
export const TOP20_PCT_CAMPO = 25.22;
export const TOP20_PCT_SIN_RESPONSABLE = 9.48;

// ─────────────────────────────────────────────────────────────────────────
// E) EVOLUCIÓN TERRITORIAL — la dimensión de TIEMPO que faltaba
//    sale.order.date_order cruzado con res.partner.state_id, dominio
//    DOMINIO_VENTA_GTQ. Segunda lectura viva, sello SELLO_LECTURA_REGION.
//
//    Todo lo de arriba es ACUMULADO desde 2022: un departamento que se está
//    muriendo y uno que está naciendo se ven iguales en el acumulado. Esta
//    sección es lo único que los distingue.
// ─────────────────────────────────────────────────────────────────────────

/** Hora exacta de la segunda lectura, la que trajo la evolución (UTC). */
export const SELLO_LECTURA_REGION = "2026-09-03T17:26:03Z";

/** La misma hora en el huso de Guatemala (UTC-6). */
export const SELLO_LECTURA_REGION_LOCAL = "2026-09-03 11:26 (GT, UTC-6)";

// VENTANA COMPARABLE: 1 ene → 3 sep de cada año. Obligatoria porque 2026 está
// en curso: comparar contra años completos daría caídas falsas.
export const VENTANA_COMPARABLE = "1 ene → 3 sep de cada año";
export const TOTAL_VENTANA = { v2024: 2_981_901.49, v2025: 4_045_174.17, v2026: 4_997_475.89 };
export const CRECIMIENTO_PAIS_25_26 = 23.54;   // %

export type FilaEvolucion = {
  region: string;
  v2025: number;
  v2026: number;
  /**
   * null cuando el porcentaje NO EXISTE como medida de crecimiento. Dos casos,
   * y los dos se leen igual —no hay número que publicar—:
   *
   *   1. La base 2025 es cero. El porcentaje no es infinito: no existe.
   *   2. El departamento NO cumple pctConfiable en ESTACIONALIDAD_REGION, o
   *      sea que su venta 2025 cayó casi toda fuera de la ventana 1 ene → 3
   *      sep. Ahí el cociente mide DÓNDE CORTA LA VENTANA, no el negocio, y
   *      publicarlo sería inventar un crecimiento. Se publica el delta en
   *      quetzales, que sí es comparable.
   *
   * Verificado: Alta Verapaz metía sólo el 3.64% de su año dentro de la
   * ventana, Totonicapán el 11.42%, Retalhuleu el 15.34% y Suchitepéquez el
   * 33.11%, contra 64.11% del país. Sus antiguos porcentajes de variación
   * eran artefactos del corte y se retiraron de la lectura.
   */
  varPct: number | null;
  delta: number;
};

// Evolución por departamento, misma ventana. varPct y delta 2025→2026.
// varPct sólo se conserva donde ESTACIONALIDAD_REGION marca pctConfiable.
export const EVOLUCION_REGION: FilaEvolucion[] = [
  { region: "Guatemala (GT)",       v2025: 2_625_448.22, v2026: 2_828_094.01, varPct:    7.72, delta:  202_645.79 },
  { region: "Suchitepequez (GT)",   v2025:    89_386.07, v2026:   268_993.86, varPct:    null, delta:  179_607.79 },
  { region: "Alta Verapaz (GT)",    v2025:     2_812.50, v2026:   130_569.96, varPct:    null, delta:  127_757.46 },
  { region: "Retalhuleu (GT)",      v2025:     9_277.00, v2026:   133_209.45, varPct:    null, delta:  123_932.45 },
  { region: "Totonicapán (GT)",     v2025:     8_952.85, v2026:    95_859.90, varPct:    null, delta:   86_907.05 },
  { region: "Chimaltenango (GT)",   v2025:   203_798.19, v2026:   286_972.04, varPct:    null, delta:   83_173.85 },
  { region: "Quetzaltenango (GT)",  v2025:   251_482.46, v2026:   328_049.51, varPct:   30.45, delta:   76_567.05 },
  { region: "Quiché (GT)",          v2025:    55_455.40, v2026:   114_584.16, varPct:  106.62, delta:   59_128.76 },
  { region: "El Petén (GT)",        v2025:         0.00, v2026:    57_263.38, varPct:    null, delta:   57_263.38 },
  { region: "Sacatepequez (GT)",    v2025:    92_579.75, v2026:   142_931.78, varPct:   54.39, delta:   50_352.03 },
  { region: "Escuintla (GT)",       v2025:    23_206.20, v2026:    54_725.35, varPct:    null, delta:   31_519.15 },
  { region: "Sin departamento",     v2025:   364_631.93, v2026:   350_563.11, varPct:   -3.86, delta:  -14_068.82 },
  { region: "Huehuetenango (GT)",   v2025:   155_004.60, v2026:   126_520.25, varPct:  -18.38, delta:  -28_484.35 },
  { region: "Sololá (GT)",          v2025:    43_144.50, v2026:     8_019.95, varPct:    null, delta:  -35_124.55 },
  { region: "San Marcos (GT)",      v2025:   117_140.75, v2026:    37_913.38, varPct:  -67.63, delta:  -79_227.37 },
];

// Ticket promedio por departamento (venta acumulada ÷ pedidos)
export const TICKET_POR_REGION: { region: string; ticket: number }[] = [
  { region: "Sin departamento",    ticket: 15_538.93 },
  { region: "Guatemala (GT)",      ticket:  6_338.71 },
  { region: "Sacatepequez (GT)",   ticket:  5_954.77 },
  { region: "Chimaltenango (GT)",  ticket:  5_813.12 },
  { region: "Suchitepequez (GT)",  ticket:  5_648.49 },
  { region: "Quiché (GT)",         ticket:  4_874.21 },
  { region: "Alta Verapaz (GT)",   ticket:  4_756.47 },
  { region: "Quetzaltenango (GT)", ticket:  4_075.59 },
  { region: "Huehuetenango (GT)",  ticket:  3_445.75 },
  { region: "San Marcos (GT)",     ticket:  3_433.16 },
];

// Cruce territorio × responsable × actividad. pctConVendedor = clientes con
// res.partner.user_id poblado; pctActivos = con compra en los últimos 180 días.
export const REGION_VENDEDOR_ACTIVIDAD: {
  region: string;
  pctConVendedor: number;
  pctActivos: number;
}[] = [
  { region: "Sacatepequez (GT)",   pctConVendedor: 100.00, pctActivos: 80.00 },
  { region: "Huehuetenango (GT)",  pctConVendedor:  64.29, pctActivos: 32.14 },
  { region: "Quetzaltenango (GT)", pctConVendedor:  63.33, pctActivos: 53.33 },
  { region: "Suchitepequez (GT)",  pctConVendedor:  62.50, pctActivos: 50.00 },
  { region: "Alta Verapaz (GT)",   pctConVendedor:  57.89, pctActivos: 47.37 },
  { region: "Guatemala (GT)",      pctConVendedor:  54.05, pctActivos: 46.85 },
  { region: "Chimaltenango (GT)",  pctConVendedor:  52.17, pctActivos: 47.83 },
  { region: "Quiché (GT)",         pctConVendedor:  52.00, pctActivos: 28.00 },
  { region: "Sin departamento",    pctConVendedor:  33.33, pctActivos: 33.33 },
  { region: "San Marcos (GT)",     pctConVendedor:  33.33, pctActivos: 28.57 },
];

// Guatemala en tres ángulos
export const GUATEMALA_CLIENTES = 111;          // de 371 con departamento = 29.92%
export const GUATEMALA_PCT_CLIENTES = 29.92;
export const GUATEMALA_PEDIDOS = 1_639;         // de 3.243 = 50.54%
export const GUATEMALA_PCT_PEDIDOS = 50.54;

// La cola larga, verificada: departamentos bajo el 1% de la venta total
export const COLA_DEPARTAMENTOS = 9;
export const COLA_VENTA = 479_191.54;           // 2.45% del total
export const COLA_PCT = 2.45;

// ─────────────────────────────────────────────────────────────────────────
// F) ESTACIONALIDAD DE LA VENTANA — por qué un porcentaje territorial miente
//
//    La ventana 1 ene → 3 sep es correcta para el TOTAL DEL PAÍS: los tres
//    años se cortan en la misma fecha. Pero la venta NO se reparte igual
//    dentro del año en cada departamento, y ahí la misma ventana produce
//    porcentajes falsos: si un departamento vende casi todo entre septiembre
//    y diciembre, su base 2025 dentro de la ventana es un residuo, y
//    cualquier cociente contra ese residuo mide DÓNDE CORTA LA VENTANA, no
//    el negocio. Por eso esta categoría publica QUETZALES.
// ─────────────────────────────────────────────────────────────────────────

/** Fracción de la venta ANUAL que cae dentro de la ventana 1 ene → 3 sep.
 *  Referencia del país: 64.11%. Un departamento muy por debajo tiene su venta
 *  concentrada fuera de la ventana, y su variación porcentual no es comparable. */
export const FRACCION_VENTANA_PAIS = 64.11;

/** pctConfiable = frac2025 >= 50% Y base 2025 en ventana >= Q50,000.
 *  Sólo 7 de 21 departamentos lo cumplen. */
export type FilaEstacionalidad = {
  region: string;
  v25ventana: number;
  v25anioCompleto: number;
  frac25: number;          // % del año 2025 dentro de la ventana
  pctConfiable: boolean;
};

export const ESTACIONALIDAD_REGION: FilaEstacionalidad[] = [
  { region: "Guatemala (GT)",      v25ventana: 2_625_448.22, v25anioCompleto: 3_704_672.17, frac25: 70.87, pctConfiable: true  },
  { region: "Sin departamento",    v25ventana:   364_631.93, v25anioCompleto:   502_753.32, frac25: 72.53, pctConfiable: true  },
  { region: "Quetzaltenango (GT)", v25ventana:   251_482.46, v25anioCompleto:   368_950.36, frac25: 68.16, pctConfiable: true  },
  { region: "San Marcos (GT)",     v25ventana:   117_140.75, v25anioCompleto:   153_080.95, frac25: 76.52, pctConfiable: true  },
  { region: "Huehuetenango (GT)",  v25ventana:   155_004.60, v25anioCompleto:   303_099.20, frac25: 51.14, pctConfiable: true  },
  { region: "Sacatepequez (GT)",   v25ventana:    92_579.75, v25anioCompleto:   101_565.75, frac25: 91.15, pctConfiable: true  },
  { region: "Quiché (GT)",         v25ventana:    55_455.40, v25anioCompleto:    99_846.09, frac25: 55.54, pctConfiable: true  },
  { region: "Chimaltenango (GT)",  v25ventana:   203_798.19, v25anioCompleto:   455_081.11, frac25: 44.78, pctConfiable: false },
  { region: "Sololá (GT)",         v25ventana:    43_144.50, v25anioCompleto:    64_284.50, frac25: 67.11, pctConfiable: false },
  { region: "Suchitepequez (GT)",  v25ventana:    89_386.07, v25anioCompleto:   269_997.67, frac25: 33.11, pctConfiable: false },
  { region: "Escuintla (GT)",      v25ventana:    23_206.20, v25anioCompleto:    36_505.95, frac25: 63.57, pctConfiable: false },
  { region: "Retalhuleu (GT)",     v25ventana:     9_277.00, v25anioCompleto:    60_479.60, frac25: 15.34, pctConfiable: false },
  { region: "Totonicapán (GT)",    v25ventana:     8_952.85, v25anioCompleto:    78_425.05, frac25: 11.42, pctConfiable: false },
  { region: "Alta Verapaz (GT)",   v25ventana:     2_812.50, v25anioCompleto:    77_320.20, frac25:  3.64, pctConfiable: false },
  { region: "Jutiapa (GT)",        v25ventana:     2_013.75, v25anioCompleto:     2_013.75, frac25:100.00, pctConfiable: false },
  { region: "Santa Rosa (GT)",     v25ventana:       840.00, v25anioCompleto:     2_378.60, frac25: 35.31, pctConfiable: false },
  { region: "El Petén (GT)",       v25ventana:         0.00, v25anioCompleto:     9_509.50, frac25:  0.00, pctConfiable: false },
  { region: "Baja Verapaz (GT)",   v25ventana:         0.00, v25anioCompleto:     5_154.50, frac25:  0.00, pctConfiable: false },
  { region: "Jalapa (GT)",         v25ventana:         0.00, v25anioCompleto:     4_620.00, frac25:  0.00, pctConfiable: false },
  { region: "Izabal (GT)",         v25ventana:         0.00, v25anioCompleto:     4_549.50, frac25:  0.00, pctConfiable: false },
];
export const DEPARTAMENTOS_PCT_CONFIABLE = 7;   // de 21
/** El denominador de esa regla, declarado aparte para que nadie lo cuente mal. */
export const DEPARTAMENTOS_EVALUADOS = 21;

/** Alta Verapaz: no "creció", SE ACTIVÓ. Detalle verificado. */
export const AVZ_CLIENTES_EN_DEPTO = 20;
export const AVZ_PEDIDOS_HISTORICOS = 57;
export const AVZ_VENTA_2026_VENTANA = 130_569.96;
export const AVZ_CLIENTES_COMPRARON_2026 = 9;
export const AVZ_TOP1_PCT = 30.03;              // cliente 400
export const AVZ_TOP3_PCT = 57.37;
export const AVZ_PRIMER_MES_REAL = "2025-08";   // antes: 3 pedidos sueltos en 2024 por Q10,302.72
export const AVZ_VENTA_2024_ANIO = 10_302.72;
export const AVZ_PEDIDOS_2024 = 3;

/** ¿Tiene este departamento un porcentaje de variación publicable? */
export function pctConfiableDe(region: string): boolean {
  const fila = ESTACIONALIDAD_REGION.find((f) => f.region === region);
  return fila ? fila.pctConfiable : false;
}

/** Qué fracción del año 2025 cayó dentro de la ventana, o null si no se midió. */
export function fraccionVentanaDe(region: string): number | null {
  const fila = ESTACIONALIDAD_REGION.find((f) => f.region === region);
  return fila ? fila.frac25 : null;
}
