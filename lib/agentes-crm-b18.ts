import type { CategoriaB18, ContratoB18, FilaB18, MetadatoB18, TarjetaB18 } from "@/lib/contrato-b18";
import {
  CRM_ETAPAS_CONFIGURADAS,
  CRM_LEADS,
  LIMITE_VIVO,
  SELLO_LECTURA_LOCAL,
} from "@/lib/odoo-lectura-viva";

/**
 * CRM COMERCIAL sobre el molde B18, en estado "sin fuente" — pero por una
 * razón distinta a la de /ventas/canales, y la diferencia importa.
 *
 * En Canales el campo NO EXISTE en el dataset. Aquí el módulo CRM sí está
 * instalado y configurado: crm.stage devuelve 4 etapas de embudo listas para
 * usarse. Lo que no hay es contenido — crm.lead devuelve 0 registros. La
 * consulta corrió sin error y con permiso de lectura: no es un problema de
 * acceso ni de API, es que nadie ha creado una sola oportunidad.
 *
 * Ese matiz cambia la acción recomendada. No hay que pedir un campo nuevo ni
 * una integración: hay que decidir si el equipo va a usar el CRM que ya tiene.
 *
 * REGLA DE HONESTIDAD: ningún KPI de esta página dice "0%". Un 0% significaría
 * "se midió una tasa y dio cero". Aquí no hay denominador: sin oportunidades
 * no existe tasa de conversión, ni ciclo, ni valor de pipeline. Los KPI dicen
 * "Sin dato" y la única cifra 0 que aparece es el conteo de oportunidades,
 * que es literalmente correcto.
 *
 * ADVERTENCIA DE CONCEPTO, deliberada: esta página NO usa
 * GestionCobranza.responsable (lib/types.ts). Ese campo lo escribe una persona
 * a mano dentro de la app de cobranza y describe LLAMADAS DE COBRO, no
 * seguimiento comercial. Confundirlo con actividad de CRM haría parecer que
 * hay seguimiento de oportunidades donde sólo hay gestión de mora.
 */

const FILAS_SIN_FUENTE: FilaB18[] = [{ nombre: "Sin oportunidades registradas", pct: 0 }];

const ADVERTENCIA_GESTION =
  "No se sustituye con GestionCobranza.responsable: ese campo es de llamadas de cobro, escritas a mano en la app, y no es seguimiento comercial.";

function metadatos(args: { fuente: string; capa: string; cobertura: string }): MetadatoB18[] {
  return [
    { termino: "Fuente", valor: args.fuente },
    { termino: "Capa", valor: args.capa },
    { termino: "Corte", valor: `Lectura viva de Odoo del ${SELLO_LECTURA_LOCAL}` },
    { termino: "Moneda", valor: "No aplica — no hay ninguna cifra de pipeline que expresar en moneda" },
    { termino: "Cobertura", valor: args.cobertura },
    { termino: "Límite", valor: `${LIMITE_VIVO} ${ADVERTENCIA_GESTION}` },
  ];
}

/** Las cuatro tarjetas de una categoría sin contenido comparten forma. */
function tarjetas(args: {
  detecta: string;
  explica: string;
  prioriza: string;
  recomienda: string;
  problemaDetecta: string;
  problemaExplica: string;
  problemaPrioriza: string;
  problemaRecomienda: string;
  accion: string;
}): TarjetaB18[] {
  return [
    {
      id: "detecta",
      grafica: "dona",
      donaPct: 0,
      kpiTexto: "Sin dato",
      etiqueta: args.detecta,
      resumen: `crm.lead devuelve ${CRM_LEADS} registros: no hay nada que medir todavía.`,
      problema: args.problemaDetecta,
      accion: args.accion,
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: "Sin dato",
      etiqueta: args.explica,
      resumen: `El módulo está instalado y tiene ${CRM_ETAPAS_CONFIGURADAS} etapas configuradas, pero ninguna oportunidad las recorre.`,
      problema: args.problemaExplica,
      accion: args.accion,
    },
    {
      id: "prioriza",
      grafica: "pareto",
      kpiTexto: "Sin dato",
      etiqueta: args.prioriza,
      resumen: "No hay cómo ordenar por prioridad algo que no tiene registros.",
      problema: args.problemaPrioriza,
      accion: args.accion,
    },
    {
      id: "recomienda",
      grafica: "cobertura",
      donaPct: 0,
      kpiTexto: "Sin dato",
      etiqueta: args.recomienda,
      resumen: ADVERTENCIA_GESTION,
      problema: args.problemaRecomienda,
      accion: args.accion,
    },
  ];
}

const ACCION_COMUN =
  "Decidir con Comercial si el CRM de Odoo se va a usar. El módulo ya está instalado y con etapas configuradas: no falta software ni integración, falta que alguien registre oportunidades. Hasta entonces esta página no calcula nada por su cuenta.";

// ── 1. Pipeline ───────────────────────────────────────────────────────────

const PIPELINE: CategoriaB18 = {
  id: "pipeline",
  sigla: "PI",
  nombre: "Pipeline de oportunidades",
  senal: `crm.lead tiene ${CRM_LEADS} registros — el módulo está instalado y vacío`,
  pregunta: "¿Cuánto negocio hay en curso y en qué etapa está?",
  filas: FILAS_SIN_FUENTE,
  cobertura: 0,
  coberturaEtiqueta: "oportunidades registradas en crm.lead — hay cero, así que no hay universo que cubrir",
  metricas: [
    { valor: `${CRM_LEADS}`, etiqueta: "oportunidades en crm.lead" },
    { valor: `${CRM_ETAPAS_CONFIGURADAS}`, etiqueta: "etapas ya configuradas" },
    { valor: "Sin dato", etiqueta: "valor del pipeline" },
  ],
  problema: `El CRM de Odoo está instalado y con ${CRM_ETAPAS_CONFIGURADAS} etapas listas, pero nadie ha creado una sola oportunidad. No es falta de permiso ni de API: la consulta corrió bien y devolvió ${CRM_LEADS}.`,
  metadatos: metadatos({
    fuente: "crm.lead (search_count sobre el modelo completo) y crm.stage",
    capa: "Ninguna — no hay oportunidades que repartir. El módulo existe; el contenido no.",
    cobertura: "Sin universo: 0 oportunidades registradas",
  }),
  tarjetas: tarjetas({
    detecta: "oportunidades abiertas hoy",
    explica: "valor del embudo por etapa",
    prioriza: "oportunidades que exigen atención",
    recomienda: "cobertura de seguimiento comercial",
    problemaDetecta:
      "No se puede decir cuánto negocio está en curso. Toda la venta que ve el dashboard es venta ya confirmada: no hay visibilidad de lo que viene antes de la orden.",
    problemaExplica:
      "Las cuatro etapas del embudo están configuradas pero vacías. La estructura existe y nadie la usa.",
    problemaPrioriza:
      "Sin oportunidades no hay lista de próximos pasos, ni fecha de próximo contacto, ni negocio en riesgo de enfriarse.",
    problemaRecomienda:
      "El seguimiento comercial hoy no queda registrado en ningún sistema. Lo único parecido que existe en la app es la gestión de cobranza, que es otra cosa.",
    accion: ACCION_COMUN,
  }),
};

// ── 2. Historial y frecuencia ─────────────────────────────────────────────

const HISTORIAL: CategoriaB18 = {
  id: "historial",
  sigla: "HF",
  nombre: "Historial y frecuencia",
  senal: "Sin actividad de CRM que cruzar con el historial de compra",
  pregunta: "¿Con qué frecuencia se contacta a cada cliente y qué pasó después?",
  filas: FILAS_SIN_FUENTE,
  cobertura: 0,
  coberturaEtiqueta:
    "clientes con al menos un contacto comercial registrado en CRM — hay cero registros de contacto",
  metricas: [
    { valor: "Sin dato", etiqueta: "contactos registrados" },
    { valor: "Sin dato", etiqueta: "clientes con seguimiento" },
    { valor: "Sin dato", etiqueta: "días desde el último contacto" },
  ],
  problema:
    "La frecuencia de COMPRA sí se puede medir con las órdenes de venta, y ya se mide en otras páginas. Lo que no existe es la frecuencia de CONTACTO: no hay forma de saber si un cliente dejó de comprar porque nadie lo llamó.",
  metadatos: metadatos({
    fuente: "crm.lead y su historial de etapas — sin registros",
    capa: "Ninguna. La frecuencia de compra vive en sale.order y se lee en /ventas/clientes; esta categoría mediría la frecuencia de contacto, que no está registrada.",
    cobertura: "Sin universo: 0 contactos comerciales registrados",
  }),
  tarjetas: tarjetas({
    detecta: "clientes contactados en el período",
    explica: "frecuencia media de contacto",
    prioriza: "clientes sin contacto reciente",
    recomienda: "relación entre contacto y recompra",
    problemaDetecta:
      "No hay registro de a quién se contactó. Cualquier afirmación sobre cobertura de visita o seguimiento sería inventada.",
    problemaExplica:
      "Sin contactos no hay frecuencia. Medir frecuencia de compra y llamarla seguimiento comercial sería cambiar el significado del dato a mitad de camino.",
    problemaPrioriza:
      "La lista de clientes dormidos que ya existe en otras páginas dice a quién llamar, pero no si alguien ya llamó ni qué respondió.",
    problemaRecomienda:
      "No se puede demostrar que el contacto comercial influya en la recompra, porque una de las dos variables no se registra.",
    accion: ACCION_COMUN,
  }),
};

// ── 3. Conversión ─────────────────────────────────────────────────────────

const CONVERSION: CategoriaB18 = {
  id: "conversion",
  sigla: "CV",
  nombre: "Conversión y ciclo",
  senal: "Sin oportunidades ganadas ni perdidas: no hay tasa que calcular",
  pregunta: "¿Qué proporción del negocio propuesto se termina cerrando?",
  filas: FILAS_SIN_FUENTE,
  cobertura: 0,
  coberturaEtiqueta:
    "oportunidades cerradas con desenlace conocido — no hay ninguna, ni ganada ni perdida",
  metricas: [
    { valor: "Sin dato", etiqueta: "tasa de conversión" },
    { valor: "Sin dato", etiqueta: "ciclo de cierre" },
    { valor: "Sin dato", etiqueta: "motivos de pérdida" },
  ],
  problema:
    "Una tasa de conversión necesita un denominador: cuántas oportunidades se abrieron. Ese denominador es cero, así que la tasa no es 0% — sencillamente no existe.",
  metadatos: metadatos({
    fuente: "crm.lead filtrado por etapa ganada/perdida — sin registros",
    capa: "Ninguna. No confundir con la relación entre cotizaciones y pedidos, que es otra medición y vive en sale.order.",
    cobertura: "Sin universo: 0 oportunidades con desenlace",
  }),
  tarjetas: tarjetas({
    detecta: "tasa de cierre del período",
    explica: "duración media del ciclo comercial",
    prioriza: "etapas donde más se pierde",
    recomienda: "motivos de pérdida más frecuentes",
    problemaDetecta:
      "Sin oportunidades abiertas no hay denominador. Publicar un 0% haría creer que se propuso negocio y no se cerró nada, que es falso.",
    problemaExplica:
      "No se puede medir cuánto tarda un negocio en cerrarse porque no se registra cuándo empezó.",
    problemaPrioriza:
      "No hay embudo real que analizar: las cuatro etapas están configuradas pero ninguna oportunidad las ha recorrido.",
    problemaRecomienda:
      "No hay motivos de pérdida registrados, así que no se puede saber si se pierde por precio, por plazo o por falta de seguimiento.",
    accion: ACCION_COMUN,
  }),
};

// ── 4. Oportunidad y riesgo ───────────────────────────────────────────────

const RIESGO: CategoriaB18 = {
  id: "riesgo",
  sigla: "OR",
  nombre: "Oportunidad y riesgo",
  senal: "Sin señal de CRM: el riesgo comercial sólo se puede inferir de la compra",
  pregunta: "¿Qué cuentas están en riesgo de perderse y cuáles tienen espacio para crecer?",
  filas: FILAS_SIN_FUENTE,
  cobertura: 0,
  coberturaEtiqueta:
    "clientes con señal de riesgo registrada en CRM — no existe ninguna señal declarada por una persona",
  metricas: [
    { valor: "Sin dato", etiqueta: "cuentas marcadas en riesgo" },
    { valor: "Sin dato", etiqueta: "oportunidades de crecimiento" },
    { valor: "Sin dato", etiqueta: "próxima acción comprometida" },
  ],
  problema:
    "El riesgo que hoy puede medir el dashboard es el observado en la compra: un cliente que dejó de comprar. Lo que falta es el riesgo declarado por quien atiende la cuenta, que llega antes de que la compra caiga.",
  metadatos: metadatos({
    fuente: "crm.lead y sus campos de probabilidad y próxima acción — sin registros",
    capa: "Ninguna. La caída de compra ya se detecta en otras páginas a partir de sale.order; esto mediría la alerta anticipada de una persona, que no se registra.",
    cobertura: "Sin universo: 0 señales de riesgo declaradas",
  }),
  tarjetas: tarjetas({
    detecta: "cuentas señaladas en riesgo por su responsable",
    explica: "causa declarada del riesgo",
    prioriza: "cuentas grandes con alerta abierta",
    recomienda: "próxima acción comprometida y su fecha",
    problemaDetecta:
      "Toda alerta de riesgo del dashboard es retrospectiva: se activa cuando el cliente ya dejó de comprar. Nadie registra la señal temprana.",
    problemaExplica:
      "Sin causa declarada, no se puede distinguir entre un cliente que se fue con la competencia y uno que sólo cambió su ciclo de compra.",
    problemaPrioriza:
      "Las cuentas grandes sin responsable asignado —que /ventas/vendedores sí cuantifica— serían las primeras candidatas a vigilar, pero no hay dónde anotar esa vigilancia.",
    problemaRecomienda:
      "No existe compromiso registrado de próxima acción, así que no se puede dar seguimiento a lo acordado ni medir si se cumplió.",
    accion: ACCION_COMUN,
  }),
};

// ── Contrato ──────────────────────────────────────────────────────────────

export function construirCrmB18(): ContratoB18 {
  return {
    eyebrow: "OPERACIÓN · CRM COMERCIAL",
    titulo: "CRM comercial",
    rotuloRiel: "Dimensiones pendientes",
    corte: `Odoo vivo · ${SELLO_LECTURA_LOCAL}`,
    categorias: [PIPELINE, HISTORIAL, CONVERSION, RIESGO],
    resumen: {
      subtitulo:
        "El módulo CRM de Odoo está instalado y con etapas configuradas, pero no tiene una sola oportunidad registrada. La página usa el molde y declara ese estado, sin fabricar ningún indicador.",
      kpis: [
        {
          etiqueta: "Oportunidades registradas",
          valor: `${CRM_LEADS}`,
          nota: "crm.lead, consultado con permiso de lectura y sin error: el modelo está vacío",
        },
        {
          etiqueta: "Etapas configuradas",
          valor: `${CRM_ETAPAS_CONFIGURADAS}`,
          nota: "crm.stage — la estructura del embudo existe y nadie la recorre",
        },
        {
          etiqueta: "Tasa de conversión",
          valor: "Sin dato",
          nota: "No es 0%: sin oportunidades abiertas no hay denominador que dividir",
        },
        {
          etiqueta: "Seguimiento registrado",
          valor: "Sin dato",
          nota: "No se sustituye con la gestión de cobranza: esa mide llamadas de cobro, no venta",
        },
      ],
      tituloMix: "Reparto del pipeline",
      preguntaMix: "¿Cómo se distribuye el negocio en curso entre las etapas del embudo?",
      tituloCobertura: "Cobertura de seguimiento comercial",
      preguntaCobertura: "¿Qué parte de la cartera tiene seguimiento registrado?",
      notaCobertura:
        "En las cuatro categorías la cobertura es cero por la misma razón y no por cuatro razones distintas: no hay oportunidades registradas, así que ninguna de las cuatro tiene universo sobre el cual medir. Es el único caso de esta página donde la etiqueta se repite, y se repite porque es cierto.",
      pie: `Lectura viva de Odoo del ${SELLO_LECTURA_LOCAL}. El módulo CRM está instalado; lo que falta es uso, no acceso. ${ADVERTENCIA_GESTION}`,
    },
  };
}
