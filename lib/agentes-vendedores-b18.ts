import type { CategoriaB18, ContratoB18, MetadatoB18 } from "@/lib/contrato-b18";
import { repartir } from "@/lib/contrato-b18";
import {
  ADMIN_PCT_FACTURADO,
  BRECHA_COINCIDE,
  BRECHA_DIVERGE,
  BRECHA_PCT_COINCIDE,
  BRECHA_PCT_DIVERGE,
  BRECHA_PCT_SIN_CARTERA,
  BRECHA_PCT_SIN_USUARIO,
  BRECHA_SIN_CARTERA,
  BRECHA_SIN_USUARIO,
  CARTERA_ASIGNADA,
  CARTERA_CAMPO_CLIENTES,
  CLIENTES_CON_CARTERA,
  CLIENTES_SIN_CARTERA,
  CLIENTES_TOTAL,
  COBERTURA_CAMPO,
  COBERTURA_CARTERA,
  COBERTURA_POR_DINERO,
  COBERTURA_POR_PEDIDOS,
  DIVERGENCIA_ENTRE_VENDEDORES_PEDIDOS,
  DIVERGENCIA_ENTRE_VENDEDORES_VENTA,
  DIVERGENCIA_HACIA_ADMIN_PCT,
  DIVERGENCIA_HACIA_ADMIN_PCT_PEDIDOS,
  DIVERGENCIA_HACIA_ADMIN_PEDIDOS,
  DIVERGENCIA_HACIA_ADMIN_VENTA,
  DIVERGENCIA_PARES,
  DOMINIO_VENTA_GTQ,
  FACTURADO_POR,
  HISTORIAL_ARTEFACTO_CAMBIOS,
  HISTORIAL_ARTEFACTO_TEXTO,
  HISTORIAL_CAMBIOS_TOTAL,
  HISTORIAL_DESDE,
  HISTORIAL_HASTA,
  HISTORIAL_KEVIN_CAMBIOS,
  HISTORIAL_PRIMERA_ASIGNACION,
  HISTORIAL_QUITARON_RESPONSABLE,
  HISTORIAL_RESPONSABLES_DISTINTOS,
  HISTORIAL_RESPONSABLES_INEXISTENTES,
  HISTORIAL_TRASPASO_REAL,
  KEVIN_CLIENTES_TOCADOS,
  KEVIN_HUERFANOS,
  KEVIN_HUERFANOS_PEDIDOS,
  KEVIN_HUERFANOS_VENTA,
  KEVIN_REASIGNADOS,
  LIMITE_CORTO,
  LIMITE_VIVO,
  MONEDA_DECLARADA,
  PEDIDOS_CON_CARTERA,
  PEDIDOS_TOTAL_GTQ,
  SELLO_LECTURA_LOCAL,
  SIN_DUENIO_ACTIVOS_90D,
  SIN_DUENIO_DORMIDOS_180,
  SIN_DUENIO_ENTRE_90_180,
  SIN_DUENIO_NUNCA_COMPRARON,
  SIN_DUENIO_PCT_DORMIDOS,
  SIN_DUENIO_PEDIDOS,
  SIN_DUENIO_PEDIDOS_90_180,
  SIN_DUENIO_PEDIDOS_ACTIVOS,
  SIN_DUENIO_PEDIDOS_DORMIDOS,
  SIN_DUENIO_VENTA,
  SIN_DUENIO_VENTA_90_180,
  SIN_DUENIO_VENTA_ACTIVOS,
  SIN_DUENIO_VENTA_DORMIDOS,
  TOP20_ADMIN,
  TOP20_CAMPO,
  TOP20_PCT_ADMIN,
  TOP20_PCT_CAMPO,
  TOP20_PCT_SIN_RESPONSABLE,
  TOP20_PCT_VENTA,
  TOP20_SIN_RESPONSABLE,
  TOP20_TOTAL,
  TOP_CUENTAS,
  VENTA_CON_CARTERA,
  VENTA_POR_CLIENTE_CARTERA,
  VENTA_POR_CLIENTE_MULTIPLO,
  VENTA_TOTAL_GTQ,
  pct,
  q,
} from "@/lib/odoo-lectura-viva";

/**
 * VENDEDORES sobre el molde B18, leyendo Odoo (no el snapshot de Supabase).
 *
 * TRES CONCEPTOS QUE ESTA PÁGINA NUNCA MEZCLA
 * -------------------------------------------
 * A) CARTERA ASIGNADA  — res.partner.user_id. Quién ATIENDE la cuenta.
 * B) FACTURADO POR     — sale.order.user_id.  Quién REGISTRÓ el pedido.
 * C) RESPONSABLE DE GESTIÓN — GestionCobranza.responsable (lib/types.ts). NO
 *    es de Odoo: lo escribe una persona a mano dentro de la app de cobranza y
 *    se refiere a LLAMADAS DE COBRO. No entra en esta página, ni una sola vez.
 *
 * A y B tienen categoría propia y jamás se suman. La distancia entre las dos
 * es, de hecho, el hallazgo central: ADMINISTRACION sostiene el 40.29% de la
 * cartera pero aparece en el 89.38% de lo facturado, porque es la cuenta desde
 * la que se registran los pedidos, no un vendedor de campo.
 *
 * CADA TARJETA MIDE ALGO PROPIO
 * -----------------------------
 * Una tarjeta cuyo número es el complemento de otra (a + b = 100) no aporta
 * lectura: repite la misma medición del otro lado. Las dieciséis de esta
 * página se revisaron con esa regla, y las que sólo eran el reverso de su
 * vecina fueron reemplazadas por un ángulo con dato propio.
 */

const EYEBROW = "VENTAS · VENDEDORES";

/**
 * El pie de procedencia, recortado a TRES líneas: Corte, Moneda y Límite.
 *
 * Fuente, Capa y Cobertura salieron de la vista a propósito. No se perdieron:
 * el modelo, el campo y el dominio exacto de cada categoría viven ahora en el
 * JSDoc que la encabeza, donde le sirven a quien construye. Al que lee el
 * tablero le sirve otra cosa —de cuándo es el dato, en qué moneda está y qué
 * no puede pedirle—, y eso es lo único que queda abajo.
 */
function metadatos(): MetadatoB18[] {
  return [
    { termino: "Corte", valor: `Lectura viva de Odoo del ${SELLO_LECTURA_LOCAL}` },
    { termino: "Moneda", valor: MONEDA_DECLARADA },
    { termino: "Límite", valor: LIMITE_CORTO },
  ];
}

// ── 1. COBERTURA — ¿cuánta cartera tiene dueño? ───────────────────────────

const conNombre = CARTERA_ASIGNADA.filter((f) => f.usuarioId !== null);

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: res.partner.user_id, sobre res.partner con customer_rank > 0.
 * Capa:   conteo de CLIENTES por responsable de cartera. No es venta, no es
 *   facturación, y no dice quién emitió ningún pedido.
 * Cobertura: COBERTURA_CARTERA % — CLIENTES_CON_CARTERA de CLIENTES_TOTAL.
 */

/** Venta por cliente: el mismo reparto de cartera leído por valor, no por conteo. */
const porClienteAdmin = VENTA_POR_CLIENTE_CARTERA[0];
const porClienteMenor = VENTA_POR_CLIENTE_CARTERA[3];

const COBERTURA: CategoriaB18 = {
  id: "cobertura",
  sigla: "CO",
  nombre: "Cobertura de cartera",
  senal: `${CLIENTES_SIN_CARTERA} de ${CLIENTES_TOTAL} clientes no tienen responsable asignado`,
  pregunta: "¿Cuánta de la cartera tiene un responsable con nombre?",
  filas: repartir(
    CARTERA_ASIGNADA.map((f) => ({
      nombre: f.vendedor,
      valor: f.clientes,
      valorTexto: `${f.clientes} clientes`,
    }))
  ),
  cobertura: COBERTURA_CARTERA,
  coberturaEtiqueta: `clientes con res.partner.user_id poblado, sobre los ${CLIENTES_TOTAL} con customer_rank > 0`,
  metricas: [
    { valor: `${CLIENTES_CON_CARTERA}`, etiqueta: "clientes con responsable" },
    { valor: `${CLIENTES_SIN_CARTERA}`, etiqueta: "clientes sin responsable" },
    { valor: `${conNombre.length}`, etiqueta: "usuarios con cartera" },
  ],
  problema: `${CLIENTES_SIN_CARTERA} de ${CLIENTES_TOTAL} clientes están sin responsable asignado en Odoo, pero esa mitad de la base pesa sólo el ${BRECHA_PCT_SIN_CARTERA.toFixed(2)}% de la venta: el conteo de fichas exagera el tamaño real del hueco.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "cobertura",
      donaPct: COBERTURA_CARTERA,
      kpiTexto: `${COBERTURA_CARTERA.toFixed(2)}%`,
      etiqueta: "de los clientes tiene responsable de cartera",
      resumen: `Medido por clientes ${COBERTURA_CARTERA.toFixed(2)}%; por pedidos ${COBERTURA_POR_PEDIDOS.toFixed(
        2
      )}% (${PEDIDOS_CON_CARTERA} de ${PEDIDOS_TOTAL_GTQ}); por dinero ${COBERTURA_POR_DINERO.toFixed(
        2
      )}% (${q(VENTA_CON_CARTERA)}).`,
      problema: `Los tres ángulos no coinciden y esa distancia es el dato: la mitad de las fichas no tiene dueño, pero esa mitad sólo mueve el ${BRECHA_PCT_SIN_CARTERA.toFixed(
        2
      )}% del dinero. Leer únicamente el ${COBERTURA_CARTERA.toFixed(
        2
      )}% hace parecer que medio negocio está desatendido, y no lo está.`,
      accion:
        "Tratarlo como lo que es —limpieza de datos maestros con una cola comercial pequeña— y no como una emergencia de ventas: primero los clientes sin dueño que sí facturan, el resto en depuración por lotes.",
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: q(porClienteAdmin.porCliente),
      etiqueta: `de venta acumulada por cada cliente de la cartera de ${porClienteAdmin.vendedor}`,
      resumen: `${porClienteMenor.vendedor} promedia ${q(
        porClienteMenor.porCliente
      )} por cliente: ${VENTA_POR_CLIENTE_MULTIPLO.toFixed(2)} veces menos.`,
      problema:
        "El reparto por CANTIDAD de clientes no dice nada sobre el reparto por VALOR. Dos carteras de tamaño parecido pueden valer once veces distinto, y hoy ninguna pantalla muestra esa diferencia.",
      accion:
        "Fijar el valor de cada cartera —venta por cliente, no número de fichas— antes de repartir metas o calcular comisiones. Con el conteo solo, cualquier meta queda mal calibrada de origen.",
    },
    {
      id: "prioriza",
      grafica: "barras",
      kpiTexto: `${SIN_DUENIO_ACTIVOS_90D}`,
      etiqueta: "clientes sin responsable que compraron en los últimos 90 días",
      resumen: `De los ${CLIENTES_SIN_CARTERA} sin dueño: ${SIN_DUENIO_ACTIVOS_90D} activos, ${SIN_DUENIO_ENTRE_90_180} entre 90 y 180 días, ${SIN_DUENIO_DORMIDOS_180} dormidos con más de 180 y ${SIN_DUENIO_NUNCA_COMPRARON} que nunca compraron.`,
      problema: `"${CLIENTES_SIN_CARTERA} sin dueño" no se puede accionar en una semana; ${SIN_DUENIO_ACTIVOS_90D} asignaciones sí. Los ${SIN_DUENIO_DORMIDOS_180} dormidos son otra decisión —depurar o reactivar—, no la misma tarea.`,
      accion: `Asignar responsable a esos ${SIN_DUENIO_ACTIVOS_90D} esta semana. Los ${SIN_DUENIO_DORMIDOS_180} dormidos y los ${SIN_DUENIO_NUNCA_COMPRARON} sin historial van a una revisión aparte, con criterio de depuración.`,
    },
    {
      id: "recomienda",
      grafica: "cobertura",
      donaPct: COBERTURA_CAMPO,
      kpiTexto: `${COBERTURA_CAMPO.toFixed(2)}%`,
      etiqueta: "cobertura si ADMINISTRACION no cuenta como vendedor",
      resumen: `${COBERTURA_CARTERA.toFixed(2)}% con ADMINISTRACION dentro, ${COBERTURA_CAMPO.toFixed(
        2
      )}% fuera: ${CARTERA_CAMPO_CLIENTES} clientes atendidos en vez de ${CLIENTES_CON_CARTERA}.`,
      problema: `La clasificación de ADMINISTRACION ya no es una discusión abstracta: cuesta ${(
        COBERTURA_CARTERA - COBERTURA_CAMPO
      ).toFixed(2)} puntos de cobertura y ${
        CLIENTES_CON_CARTERA - CARTERA_CAMPO_CLIENTES
      } clientes que hoy figuran atendidos y quizá no lo estén.`,
      accion:
        "Que Comercial declare formalmente si ADMINISTRACION es vendedor o cuenta de registro. La decisión ya tiene precio visible, y toda cifra de rendimiento de esta página depende de ella.",
    },
  ],
};

// ── 2. BRECHA — cartera asignada frente a facturado por ───────────────────

const ventaConDuenio = VENTA_TOTAL_GTQ - SIN_DUENIO_VENTA;
const pctSinDuenio = pct(SIN_DUENIO_VENTA, VENTA_TOTAL_GTQ);

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: sale.order agrupado por res.partner.user_id del cliente, y comparado
 *   pedido a pedido contra sale.order.user_id.
 *   Dominio [['state','in',['sale','done']],['currency_id.name','=','GTQ']].
 * Capa:   venta confirmada atribuida al RESPONSABLE DE LA CUENTA (cartera
 *   asignada). No es la venta que cada usuario facturó: eso se mide aparte y
 *   da un reparto distinto.
 * Cobertura: venta con dueño sobre VENTA_TOTAL_GTQ.
 */

const BRECHA: CategoriaB18 = {
  id: "brecha",
  sigla: "BR",
  nombre: "Brecha atendido / facturado",
  senal: `${q(SIN_DUENIO_VENTA)} de venta viene de clientes sin responsable`,
  pregunta: "¿Cuánto dinero se mueve sin que nadie esté a cargo de la cuenta?",
  filas: repartir(
    CARTERA_ASIGNADA.map((f) => ({
      nombre: f.vendedor,
      valor: f.venta,
      valorTexto: q(f.venta),
    }))
  ),
  cobertura: pct(ventaConDuenio, VENTA_TOTAL_GTQ),
  coberturaEtiqueta:
    "venta confirmada en quetzales cuyo cliente TIENE responsable de cartera, sobre la venta confirmada total",
  metricas: [
    { valor: q(SIN_DUENIO_VENTA), etiqueta: "venta sin responsable" },
    { valor: `${SIN_DUENIO_PEDIDOS}`, etiqueta: "pedidos sin responsable" },
    { valor: `${pctSinDuenio.toFixed(2)}%`, etiqueta: "de la venta total" },
  ],
  problema: `Hay ${q(SIN_DUENIO_VENTA)} en ${SIN_DUENIO_PEDIDOS} pedidos de clientes que nadie tiene asignado, pero es venta ACUMULADA de años: ${SIN_DUENIO_PCT_DORMIDOS.toFixed(
    2
  )}% viene de clientes dormidos hace más de 180 días. Lo que sí se mueve hoy son ${q(
    SIN_DUENIO_VENTA_ACTIVOS
  )}.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "dona",
      donaPct: pctSinDuenio,
      kpiTexto: q(SIN_DUENIO_VENTA),
      etiqueta: "de venta acumulada de clientes sin responsable de cuenta",
      resumen: `${SIN_DUENIO_PEDIDOS} pedidos de todos los años: ${q(
        SIN_DUENIO_VENTA_ACTIVOS
      )} de clientes activos a 90 días, ${q(SIN_DUENIO_VENTA_90_180)} de la ventana 90-180 y ${q(
        SIN_DUENIO_VENTA_DORMIDOS
      )} de dormidos.`,
      problema: `Es historia acumulada, no flujo actual: ${SIN_DUENIO_DORMIDOS_180} de esos ${CLIENTES_SIN_CARTERA} clientes llevan más de 180 días sin comprar. Leer los ${q(
        SIN_DUENIO_VENTA
      )} como dinero moviéndose hoy sin dueño multiplica la urgencia por siete.`,
      accion: `Trabajar sobre los ${q(
        SIN_DUENIO_VENTA_ACTIVOS
      )} de venta viva (${SIN_DUENIO_PEDIDOS_ACTIVOS} pedidos): ésa es la urgencia real. Los ${q(
        SIN_DUENIO_VENTA_DORMIDOS
      )} dormidos entran en un plan de reactivación, no en la asignación de esta semana.`,
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${BRECHA_PCT_DIVERGE.toFixed(2)}%`,
      etiqueta: "de la venta tiene un responsable de cuenta distinto de quien facturó",
      resumen: `Coinciden ${BRECHA_COINCIDE.pedidos} pedidos / ${q(
        BRECHA_COINCIDE.venta
      )} (${BRECHA_PCT_COINCIDE.toFixed(2)}%); divergen ${BRECHA_DIVERGE.pedidos} / ${q(
        BRECHA_DIVERGE.venta
      )} (${BRECHA_PCT_DIVERGE.toFixed(2)}%); sin cartera ${BRECHA_SIN_CARTERA.pedidos} / ${q(
        BRECHA_SIN_CARTERA.venta
      )} (${BRECHA_PCT_SIN_CARTERA.toFixed(2)}%); sin usuario ${BRECHA_SIN_USUARIO.pedidos} / ${q(
        BRECHA_SIN_USUARIO.venta
      )} (${BRECHA_PCT_SIN_USUARIO.toFixed(2)}%). Cierra al centavo.`,
      problema: `Éste es el número que el título de la categoría promete: la brecha medida pedido por pedido, no dos distribuciones puestas lado a lado. Decide si "el vendedor de una venta" es quien atiende o quien registra, y ${q(
        BRECHA_DIVERGE.venta
      )} cambian de dueño según la respuesta.`,
      accion:
        "Que Comercial escriba la regla de atribución antes del próximo cierre: cartera asignada para rendimiento, facturado por para trazabilidad. Sin esa regla, cada informe elige la que le conviene.",
    },
    {
      id: "prioriza",
      grafica: "dona",
      donaPct: SIN_DUENIO_PCT_DORMIDOS,
      kpiTexto: q(SIN_DUENIO_VENTA_DORMIDOS),
      etiqueta: `de los ${q(SIN_DUENIO_VENTA)} sin responsable viene de clientes dormidos`,
      resumen: `Dormidos +180 días: ${q(SIN_DUENIO_VENTA_DORMIDOS)} en ${SIN_DUENIO_PEDIDOS_DORMIDOS} pedidos. Ventana 90-180: ${q(
        SIN_DUENIO_VENTA_90_180
      )} en ${SIN_DUENIO_PEDIDOS_90_180}. Activos a 90 días: ${q(
        SIN_DUENIO_VENTA_ACTIVOS
      )} en ${SIN_DUENIO_PEDIDOS_ACTIVOS}.`,
      problema: `Dos tercios de la cifra sin dueño es historia, no oportunidad. Priorizar por monto total llevaría el esfuerzo a cuentas que dejaron de comprar hace más de medio año.`,
      accion: `Ordenar la asignación por recencia y no por monto acumulado: primero los ${SIN_DUENIO_PEDIDOS_ACTIVOS} pedidos vivos, después la ventana 90-180, y los dormidos sólo si se abre una campaña de reactivación con presupuesto propio.`,
    },
    {
      id: "recomienda",
      grafica: "pareto",
      kpiTexto: `${DIVERGENCIA_HACIA_ADMIN_PCT.toFixed(2)}%`,
      etiqueta: "de la brecha es un vendedor de campo cuyo pedido registró ADMINISTRACION",
      resumen: `${DIVERGENCIA_PARES[0].par}: ${DIVERGENCIA_PARES[0].pedidos} pedidos / ${q(
        DIVERGENCIA_PARES[0].venta
      )}. ${DIVERGENCIA_PARES[1].par}: ${DIVERGENCIA_PARES[1].pedidos} / ${q(
        DIVERGENCIA_PARES[1].venta
      )}. ${DIVERGENCIA_PARES[2].par}: ${DIVERGENCIA_PARES[2].pedidos} / ${q(DIVERGENCIA_PARES[2].venta)}.`,
      problema: `La divergencia NO es indisciplina comercial: ${DIVERGENCIA_HACIA_ADMIN_PEDIDOS} de los ${BRECHA_DIVERGE.pedidos} pedidos (${DIVERGENCIA_HACIA_ADMIN_PCT_PEDIDOS.toFixed(
        2
      )}%) y ${q(
        DIVERGENCIA_HACIA_ADMIN_VENTA
      )} van del vendedor de campo a ADMINISTRACION. Sólo ${DIVERGENCIA_ENTRE_VENDEDORES_PEDIDOS} pedidos por ${q(
        DIVERGENCIA_ENTRE_VENDEDORES_VENTA
      )} son vendedor a vendedor. Es registro administrativo centralizado.`,
      accion:
        "Se arregla cambiando el proceso de captura —que el pedido se registre con el usuario del vendedor que lo trajo—, no llamándole la atención a nadie. Un llamado de atención sobre estos datos sería un error de lectura.",
    },
  ],
};

// ── 3. HUÉRFANOS — la cartera del vendedor dado de baja ───────────────────

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: mail.tracking.value cruzado con mail.message — el historial de
 *   cambios del campo res.partner.user_id. No sale de ninguna tabla de
 *   vendedor actual: ese usuario ya no existe en res.users.
 * Capa:   rastro de reasignaciones de cartera. El caso del vendedor de baja
 *   cubre jul-2024 a nov-2025; el historial completo del campo va de
 *   HISTORIAL_DESDE a HISTORIAL_HASTA. Es historia de asignación, no una foto
 *   del estado de hoy.
 * Cobertura: KEVIN_REASIGNADOS de KEVIN_CLIENTES_TOCADOS reasignados.
 */

const HUERFANOS: CategoriaB18 = {
  id: "huerfanos",
  sigla: "HU",
  nombre: "Cartera del vendedor de baja",
  senal: `${KEVIN_HUERFANOS} clientes quedaron sin responsable cuando se borró un usuario`,
  pregunta: "¿Qué pasó con la cartera del vendedor que ya no está?",
  filas: repartir([
    { nombre: "Reasignados a otro vendedor", valor: KEVIN_REASIGNADOS, valorTexto: `${KEVIN_REASIGNADOS} clientes` },
    { nombre: "Siguen sin responsable", valor: KEVIN_HUERFANOS, valorTexto: `${KEVIN_HUERFANOS} clientes` },
  ]),
  cobertura: pct(KEVIN_REASIGNADOS, KEVIN_CLIENTES_TOCADOS),
  coberturaEtiqueta:
    "clientes de esa cartera que SÍ fueron reasignados a otro usuario, sobre los que pasaron por ella",
  metricas: [
    { valor: `${KEVIN_CLIENTES_TOCADOS}`, etiqueta: "clientes pasaron por esa cartera" },
    { valor: `${KEVIN_HUERFANOS}`, etiqueta: "siguen sin responsable" },
    { valor: q(KEVIN_HUERFANOS_VENTA), etiqueta: "venta de los abandonados" },
  ],
  problema: `Un usuario fue borrado de Odoo y ${KEVIN_HUERFANOS} de sus clientes nunca se reasignaron. Entre los ${KEVIN_HUERFANOS_PEDIDOS} pedidos de esas cuentas hay ${q(KEVIN_HUERFANOS_VENTA)}.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "dona",
      donaPct: pct(KEVIN_HUERFANOS, KEVIN_CLIENTES_TOCADOS),
      kpiTexto: `${KEVIN_HUERFANOS}`,
      etiqueta: "clientes abandonados al borrarse el usuario",
      resumen: `De ${KEVIN_CLIENTES_TOCADOS} que pasaron por esa cartera, ${KEVIN_REASIGNADOS} se reasignaron y ${KEVIN_HUERFANOS} no.`,
      problema:
        "El usuario fue borrado, no desactivado. Su cartera no quedó en ningún lado: sólo sobrevive en el historial de cambios, donde nadie la mira.",
      accion: `Reasignar esos ${KEVIN_HUERFANOS} clientes. Existen, compran, y ninguna pantalla de Odoo los muestra como pendientes.`,
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${HISTORIAL_CAMBIOS_TOTAL}`,
      etiqueta: "cambios de cartera registrados en 14 meses",
      resumen: `${HISTORIAL_PRIMERA_ASIGNACION} primeras asignaciones y ${HISTORIAL_TRASPASO_REAL} traspasos reales entre ${HISTORIAL_DESDE} y ${HISTORIAL_HASTA}. Nunca se quitó un responsable sin poner otro: ${HISTORIAL_QUITARON_RESPONSABLE} casos.`,
      problema: `Hay rotación de cartera real y sostenida —${HISTORIAL_TRASPASO_REAL} cuentas cambiaron de dueño en 14 meses— que hoy no se mide en ninguna pantalla. El caso del vendedor de baja no fue un evento aislado en un sistema quieto.`,
      accion:
        "Poner el historial de asignación en un tablero: quién movió qué cartera y cuándo. Sin eso, cada traspaso se descubre por accidente, como se descubrió éste.",
    },
    {
      id: "prioriza",
      grafica: "pareto",
      kpiTexto: q(KEVIN_HUERFANOS_VENTA),
      etiqueta: `venta acumulada de los ${KEVIN_HUERFANOS} abandonados`,
      resumen: `${KEVIN_HUERFANOS_PEDIDOS} pedidos confirmados en quetzales.`,
      problema: `Son ${KEVIN_HUERFANOS} clientes, no ${KEVIN_CLIENTES_TOCADOS}, pero valen casi un millón de quetzales. Un recuento apresurado sobre el historial diría ${KEVIN_CLIENTES_TOCADOS} y exageraría el problema por más del doble.`,
      accion:
        "Tomar estos 17 como la primera tanda concreta de reasignación: están identificados uno por uno y tienen historial de compra.",
    },
    {
      id: "recomienda",
      grafica: "barras",
      kpiTexto: `${HISTORIAL_RESPONSABLES_INEXISTENTES}`,
      etiqueta: "responsables históricos que ya no existen en Odoo",
      resumen: `De ${HISTORIAL_RESPONSABLES_DISTINTOS} nombres que alguna vez tuvieron cartera, dos ya no están: KEVIN LOPEZ (${HISTORIAL_KEVIN_CAMBIOS} cambios), persona real dada de baja, y "${HISTORIAL_ARTEFACTO_TEXTO}" (${HISTORIAL_ARTEFACTO_CAMBIOS} cambio, con acento y minúsculas), que no es una persona sino otra forma de escribir el mismo usuario.`,
      problema: `Sólo uno de los dos es un vendedor perdido. El segundo es un ARTEFACTO DE TEXTO, y conviene saberlo antes de que alguien lo cuente como una segunda cartera huérfana. El caso KEVIN es EXCEPCIÓN, no patrón.`,
      accion:
        "Incluir mail.tracking.value sobre res.partner.user_id en la lista de campos a importar al snapshot, y normalizar los nombres de usuario al hacerlo: si el historial se importa tal cual, el artefacto viaja con él.",
    },
  ],
};

// ── 4. TOP CUENTAS — las mayores, con su responsable al lado ──────────────

const topTotal = TOP_CUENTAS.reduce((s, c) => s + c.venta, 0);
const topSinDuenio = TOP_CUENTAS.filter((c) => c.responsable === "Sin responsable");
const topDeCampo = TOP_CUENTAS.filter(
  (c) => c.responsable !== "Sin responsable" && c.responsable !== "ADMINISTRACION"
);
const ventaTopCampo = topDeCampo.reduce((s, c) => s + c.venta, 0);

/**
 * Cuántas veces la cuenta mayor pesa sobre la segunda. Es la FORMA de la
 * concentración, no su máximo: el máximo ya lo dibuja el reparto de abajo, y
 * repetirlo en una tarjeta no agregaría lectura.
 */
const MULTIPLO_PRIMERA_SOBRE_SEGUNDA = (
  TOP_CUENTAS[0].venta / TOP_CUENTAS[1].venta
).toFixed(2);

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: sale.order agrupado por partner_id, cruzado con res.partner.user_id.
 *   Dominio [['state','in',['sale','done']],['currency_id.name','=','GTQ']].
 * Capa:   venta histórica ACUMULADA por cliente, con el responsable de CARTERA
 *   al lado. El responsable mostrado no es quien facturó cada pedido.
 * Cobertura: venta del top 10 en manos de vendedor de campo, sobre el top 10.
 */

const TOP: CategoriaB18 = {
  id: "top-cuentas",
  sigla: "TC",
  nombre: "Cuentas grandes y su dueño",
  senal: `Las 10 mayores cuentas concentran ${pct(topTotal, VENTA_TOTAL_GTQ).toFixed(2)}% de la venta`,
  pregunta: "¿Las cuentas más grandes tienen quién las atienda?",
  filas: repartir(
    TOP_CUENTAS.map((c) => ({
      nombre: `Cliente ${c.clienteId} · ${c.responsable}`,
      valor: c.venta,
      valorTexto: q(c.venta),
    }))
  ),
  cobertura: pct(ventaTopCampo, topTotal),
  coberturaEtiqueta:
    "venta del top 10 cuyo responsable es un vendedor de campo (excluye ADMINISTRACION y las cuentas sin dueño)",
  metricas: [
    { valor: q(topTotal), etiqueta: "venta de las 10 mayores" },
    { valor: `${pct(topTotal, VENTA_TOTAL_GTQ).toFixed(2)}%`, etiqueta: "de la venta total" },
    { valor: `${topSinDuenio.length}`, etiqueta: "de ellas sin responsable" },
  ],
  problema: `Diez clientes concentran ${pct(topTotal, VENTA_TOTAL_GTQ).toFixed(2)}% del negocio y sólo ${topDeCampo.length} de esos diez están en la cartera de un vendedor de campo.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "pareto",
      kpiTexto: `${pct(topTotal, VENTA_TOTAL_GTQ).toFixed(2)}%`,
      etiqueta: "de la venta está en 10 clientes",
      resumen: `${q(topTotal)} de ${q(VENTA_TOTAL_GTQ)} en diez cuentas; el top 20 llega a ${TOP20_PCT_VENTA.toFixed(
        2
      )}% con ${q(TOP20_TOTAL)}.`,
      problema: `Entre el puesto 11 y el 20 hay ${(TOP20_PCT_VENTA - pct(topTotal, VENTA_TOTAL_GTQ)).toFixed(
        2
      )} puntos más de concentración. Eso define hasta dónde llega la "cartera crítica" que necesita responsable nombrado: el corte razonable son veinte cuentas, no diez.`,
      accion:
        "Tratar el top 20 como cartera crítica con responsable nombrado y revisión periódica, no como veinte clientes más. Cortar en diez dejaría fuera más de un octavo del negocio.",
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${MULTIPLO_PRIMERA_SOBRE_SEGUNDA}x`,
      etiqueta: "pesa la cuenta mayor sobre la segunda",
      resumen: `${q(TOP_CUENTAS[0].venta)} contra ${q(TOP_CUENTAS[1].venta)} — la concentración del top 10 no es una meseta, es una cuenta dominante.`,
      problema: `Eso cambia el riesgo, y de una forma que el porcentaje del top 10 no deja ver: perder la primera cuenta no equivale a perder cualquiera de las diez. El reparto de abajo ya dibuja los diez montos; lo que esta tarjeta mide es la FORMA de ese reparto, que es un cociente y no un máximo. Con ${MULTIPLO_PRIMERA_SOBRE_SEGUNDA}x de distancia entre la primera y la segunda, tratar «las diez cuentas grandes» como un bloque homogéneo es un error de lectura.`,
      accion:
        "Separar la cuenta número uno del resto del top 10 en todo plan de riesgo, continuidad o comisiones: merece responsable nombrado y revisión propia, no el tratamiento del lote.",
    },
    {
      id: "prioriza",
      grafica: "dona",
      donaPct: TOP20_PCT_SIN_RESPONSABLE,
      kpiTexto: q(TOP20_SIN_RESPONSABLE.venta),
      etiqueta: `en ${TOP20_SIN_RESPONSABLE.cuentas} cuentas del top 20 sin responsable asignado`,
      resumen: `${TOP20_SIN_RESPONSABLE.cuentas} de las 20 mayores, el ${TOP20_PCT_SIN_RESPONSABLE.toFixed(
        2
      )}% de ${q(TOP20_TOTAL)}.`,
      problema:
        "Es la lista de trabajo más corta y más cara de la página: tres asignaciones cubren casi un millón de quetzales. Ninguna otra tarjeta ofrece tanto dinero por tan pocas decisiones.",
      accion:
        "Si de todo este análisis se hiciera una sola cosa, sería ésta: asignar responsable a esas tres cuentas hoy.",
    },
    {
      id: "recomienda",
      grafica: "cobertura",
      donaPct: pct(ventaTopCampo, topTotal),
      kpiTexto: `${pct(ventaTopCampo, topTotal).toFixed(2)}%`,
      etiqueta: "del top 10 está en manos de un vendedor de campo",
      resumen: `En el top 20 el reparto es: campo ${TOP20_CAMPO.cuentas} cuentas / ${q(
        TOP20_CAMPO.venta
      )} (${TOP20_PCT_CAMPO.toFixed(2)}%), ADMINISTRACION ${TOP20_ADMIN.cuentas} / ${q(
        TOP20_ADMIN.venta
      )} (${TOP20_PCT_ADMIN.toFixed(2)}%), sin responsable ${TOP20_SIN_RESPONSABLE.cuentas} / ${q(
        TOP20_SIN_RESPONSABLE.venta
      )} (${TOP20_PCT_SIN_RESPONSABLE.toFixed(2)}%).`,
      problema:
        "Si ADMINISTRACION se confirma como cuenta de registro, entonces casi dos tercios del dinero grande no tiene vendedor humano identificado. Ese es el verdadero techo de cualquier plan de comisiones.",
      accion:
        "Resolver la clasificación de ADMINISTRACION y reasignar las cuentas grandes que hoy cuelgan de ella. Sin eso, cualquier meta individual sobre estas cuentas es ficticia.",
    },
  ],
};

// ── Contrato ──────────────────────────────────────────────────────────────

export function construirVendedoresB18(): ContratoB18 {
  const facturadoLider = FACTURADO_POR[0];

  return {
    eyebrow: EYEBROW,
    titulo: "Vendedores",
    rotuloRiel: "Ejes de cartera",
    corte: `Odoo vivo · ${SELLO_LECTURA_LOCAL}`,
    categorias: [COBERTURA, BRECHA, HUERFANOS, TOP],
    resumen: {
      subtitulo:
        "Cuatro lecturas sobre la misma pregunta: quién responde por cada cliente. Cartera asignada y facturado por se muestran separadas y nunca se suman.",
      kpis: [
        {
          etiqueta: "Cobertura de cartera",
          valor: `${COBERTURA_CARTERA.toFixed(2)}%`,
          nota: `${CLIENTES_CON_CARTERA} de ${CLIENTES_TOTAL} clientes con responsable; por pedidos es ${COBERTURA_POR_PEDIDOS.toFixed(
            2
          )}% y por dinero ${COBERTURA_POR_DINERO.toFixed(2)}%`,
        },
        {
          etiqueta: "Venta sin responsable",
          valor: q(SIN_DUENIO_VENTA),
          nota: `${SIN_DUENIO_PEDIDOS} pedidos acumulados, ${pctSinDuenio.toFixed(
            2
          )}% de la venta confirmada; ${SIN_DUENIO_PCT_DORMIDOS.toFixed(2)}% de esa cifra es de clientes dormidos`,
        },
        {
          etiqueta: "Concentración de registro",
          valor: `${ADMIN_PCT_FACTURADO.toFixed(2)}%`,
          nota: `${facturadoLider.usuario} registra ${facturadoLider.pedidos} de ${PEDIDOS_TOTAL_GTQ} pedidos — es facturado por, no rendimiento`,
        },
        {
          etiqueta: "Cartera abandonada",
          valor: q(KEVIN_HUERFANOS_VENTA),
          nota: `${KEVIN_HUERFANOS} clientes que quedaron sin dueño al borrarse un usuario de Odoo`,
        },
      ],
      tituloMix: "Venta por responsable de cartera",
      preguntaMix: "¿Cómo se reparte la venta cuando se atribuye a quien atiende la cuenta?",
      tituloCobertura: "Cobertura de asignación",
      preguntaCobertura: "¿Qué parte del negocio tiene un responsable con nombre?",
      notaCobertura: `Cobertura significa cosas distintas en cada eje: clientes asignados en Cobertura, venta con dueño en Brecha, clientes reasignados en Huérfanos y venta en manos de vendedor de campo en Cuentas grandes. Está declarado eje por eje.`,
      pie: `Lectura viva de Odoo del ${SELLO_LECTURA_LOCAL}. ${MONEDA_DECLARADA} ${LIMITE_VIVO}`,
    },
  };
}
