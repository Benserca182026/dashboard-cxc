import type { ContratoB18, CategoriaB18, FilaB18, TarjetaB18 } from "@/lib/contrato-b18";

/**
 * CANALES Y TIPO DE CLIENTE — sobre el molde B18, en estado "sin fuente".
 *
 * A diferencia de los demás constructores B18 (cuadro de mando, clientes,
 * productos…), este NO traduce ninguna lectura calculada: no hay ninguna que
 * traducir. El dataset real no trae ningún campo de canal ni de tipo de
 * cliente — se verificó con grep sobre `lib/types.ts` y `lib/datosReales.ts`
 * antes de escribir este archivo, y el tipo `Cliente` de `lib/types.ts` lo
 * confirma: sólo trae id, nombre, identificación fiscal, estado, condición de
 * pago y fecha de creación. Nada de retail, ecommerce, canal tradicional ni
 * tienda grande.
 *
 * Por eso este archivo no calcula un reparto: DECLARA que no puede calcularlo
 * todavía. Las cuatro categorías son los cuatro indicadores que ya prometía
 * `ModuloPendienteComercial` en esta misma página (ver
 * `app/ventas/canales/page.tsx`), pero ahora dibujados con el molde único en
 * vez de con la pantalla de placeholder aparte.
 *
 * REGLA DE HONESTIDAD, reforzada acá: ningún `kpiTexto` de esta página dice
 * "0%". Un 0% significa "se midió y dio cero"; acá no se midió nada, así que
 * todo KPI dice "Sin dato". La única cifra 0 que existe es `cobertura: 0`,
 * que es correcta tal cual: cero por ciento de la venta tiene lectura de
 * canal, porque el campo no existe.
 */

const FUENTE_PENDIENTE =
  "Dimensión Canal/Tipo de cliente en ventas confirmadas de Odoo, con fecha, total confirmado e identificador de pedido.";

const SENAL_SIN_FUENTE = "Sin fuente conectada — el campo canal no existe en el dataset actual";
const COBERTURA_ETIQUETA = "sin datos conectados — 0% de cobertura real";

const FILAS_SIN_FUENTE: FilaB18[] = [{ nombre: "Sin fuente conectada", pct: 0 }];

const METADATOS_SIN_FUENTE = [
  { termino: "Fuente", valor: "Pendiente — no existe el campo canal/tipo de cliente en el dataset actual" },
  { termino: "Capa", valor: "Ninguna — no hay una magnitud que repartir por canal todavía" },
  { termino: "Corte", valor: "Sin corte — no hay una serie de canal que cortar" },
  { termino: "Moneda", valor: "No aplica — no hay ninguna cifra de canal que expresar en moneda" },
  { termino: "Cobertura", valor: "0.00%" },
  {
    termino: "Límite",
    valor:
      "Activar esta página requiere que el campo canal/tipo de cliente se agregue en el origen (Odoo) y se importe junto con fecha, total confirmado e identificador de pedido.",
  },
];

/** Las cuatro tarjetas de una categoría "sin fuente" comparten forma: KPI en
 *  texto (nunca en número), y el mismo trío resumen/problema/acción centrado
 *  en qué falta conectar — no en qué mide el rol en otras páginas. */
function tarjetasSinFuente(args: {
  etiquetaDetecta: string;
  etiquetaExplica: string;
  etiquetaPrioriza: string;
  etiquetaRecomienda: string;
  quePreguntaEsta: string;
}): TarjetaB18[] {
  const explicacionFalta = `No hay cómo calcularlo: falta ${FUENTE_PENDIENTE.charAt(0).toLowerCase()}${FUENTE_PENDIENTE.slice(1)}`;
  const accionComun =
    "Agregar el campo canal/tipo de cliente en Odoo e importarlo junto con fecha, total confirmado e identificador de pedido. Hasta entonces, este agente no calcula nada por su cuenta.";

  return [
    {
      id: "detecta",
      grafica: "dona",
      donaPct: 0,
      kpiTexto: "Sin dato",
      etiqueta: args.etiquetaDetecta,
      resumen: "El dataset no trae canal ni tipo de cliente: no hay ninguna venta que clasificar.",
      problema: `${args.quePreguntaEsta} ${explicacionFalta}`,
      accion: accionComun,
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: "Sin dato",
      etiqueta: args.etiquetaExplica,
      resumen: "Sin campo de canal no hay barras que comparar entre canales.",
      problema: `${explicacionFalta} Comparar canales sin ese campo sería inventar una división que el dato no tiene.`,
      accion: accionComun,
    },
    {
      id: "prioriza",
      grafica: "pareto",
      kpiTexto: "Sin dato",
      etiqueta: args.etiquetaPrioriza,
      resumen: "No hay ranking posible entre canales que no existen en el dato.",
      problema: `${explicacionFalta} Ordenar canales por relevancia exige primero que el canal sea un dato, no una suposición.`,
      accion: accionComun,
    },
    {
      id: "recomienda",
      grafica: "cobertura",
      donaPct: 0,
      kpiTexto: "Sin dato",
      etiqueta: args.etiquetaRecomienda,
      resumen: "0% de cobertura real: ninguna venta confirmada tiene canal asignado.",
      problema: `${explicacionFalta} Mostrar una recomendación sin ese campo sería una decisión inventada sobre un dato inexistente.`,
      accion: accionComun,
    },
  ];
}

function categoriaSinFuente(args: {
  id: string;
  sigla: string;
  nombre: string;
  pregunta: string;
  problema: string;
  metricaEtiquetas: [string, string, string];
  quePreguntaEsta: string;
  etiquetas: { detecta: string; explica: string; prioriza: string; recomienda: string };
}): CategoriaB18 {
  return {
    id: args.id,
    sigla: args.sigla,
    nombre: args.nombre,
    senal: SENAL_SIN_FUENTE,
    pregunta: args.pregunta,
    filas: FILAS_SIN_FUENTE,
    cobertura: 0,
    coberturaEtiqueta: COBERTURA_ETIQUETA,
    metricas: [
      { valor: "Sin dato", etiqueta: args.metricaEtiquetas[0] },
      { valor: "Sin dato", etiqueta: args.metricaEtiquetas[1] },
      { valor: "Sin dato", etiqueta: args.metricaEtiquetas[2] },
    ],
    problema: args.problema,
    tarjetas: tarjetasSinFuente({
      etiquetaDetecta: args.etiquetas.detecta,
      etiquetaExplica: args.etiquetas.explica,
      etiquetaPrioriza: args.etiquetas.prioriza,
      etiquetaRecomienda: args.etiquetas.recomienda,
      quePreguntaEsta: args.quePreguntaEsta,
    }),
    metadatos: METADATOS_SIN_FUENTE,
  };
}

/**
 * Construye el contrato B18 de Canales y tipo de cliente en su único estado
 * posible hoy: sin fuente conectada. No recibe `dataset` porque no hay nada
 * del dataset real que traducir — el campo que activaría esta página
 * (canal/tipo de cliente) no existe en `Cliente` ni en `Venta`
 * (`lib/types.ts`). Recibe `fmt` sólo para mantener la misma forma que el
 * resto de los constructores B18; esta página no formatea ninguna cifra
 * porque no tiene ninguna cifra real que mostrar.
 */
export function construirCanalesB18(fmt: (monto: number) => string): ContratoB18 {
  void fmt;

  const participacion = categoriaSinFuente({
    id: "participacion",
    sigla: "PA",
    nombre: "Participación por canal",
    pregunta: "¿Qué canal explica más venta confirmada?",
    problema:
      "La venta confirmada no trae ningún campo de canal o tipo de cliente: no hay cómo repartir Q de venta entre retail, ecommerce, canal tradicional o tienda grande.",
    metricaEtiquetas: ["canal con más venta", "canales con lectura", "venta sin canal asignado"],
    quePreguntaEsta: "Esta tarjeta señalaría qué canal concentra más venta confirmada.",
    etiquetas: {
      detecta: "canal líder",
      explica: "top 2 canales",
      prioriza: "canales medidos",
      recomienda: "venta con canal asignado",
    },
  });

  const crecimiento = categoriaSinFuente({
    id: "crecimiento",
    sigla: "CR",
    nombre: "Crecimiento por canal",
    pregunta: "¿Qué canal crece o cae contra su propia ventana del año anterior?",
    problema:
      "Sin canal en la venta confirmada no hay cómo separar una serie por canal, y por lo tanto tampoco cómo comparar un canal contra su propia ventana del año anterior.",
    metricaEtiquetas: ["canal que más crece", "canal que más cae", "canales con serie comparable"],
    quePreguntaEsta: "Esta tarjeta señalaría qué canal crece o cae más contra su propia ventana.",
    etiquetas: {
      detecta: "canal con mayor variación",
      explica: "canales con serie comparable",
      prioriza: "canales en caída",
      recomienda: "cobertura de la comparación",
    },
  });

  const ticket = categoriaSinFuente({
    id: "ticket",
    sigla: "TI",
    nombre: "Ticket por canal",
    pregunta: "¿El ticket promedio del pedido varía entre canales?",
    problema:
      "El ticket promedio por canal exige agrupar pedidos confirmados por canal antes de promediar; sin ese campo, cualquier promedio por canal sería un promedio inventado sobre un grupo que no existe.",
    metricaEtiquetas: ["ticket más alto", "ticket más bajo", "pedidos con canal asignado"],
    quePreguntaEsta: "Esta tarjeta señalaría en qué canal el pedido promedio es más alto o más bajo.",
    etiquetas: {
      detecta: "canal de ticket más alto",
      explica: "brecha entre canales",
      prioriza: "canales por volumen de pedidos",
      recomienda: "pedidos con canal asignado",
    },
  });

  const riesgo = categoriaSinFuente({
    id: "riesgo",
    sigla: "RI",
    nombre: "Riesgo y concentración",
    pregunta: "¿Algún canal concentra riesgo de cartera o dependencia de pocos clientes?",
    problema:
      "Medir concentración de riesgo por canal exige cruzar cartera o venta con un canal por cliente; ese cruce no existe porque el campo canal no existe en ningún lado del dataset.",
    metricaEtiquetas: ["canal más concentrado", "clientes sin canal", "venta sin canal asignado"],
    quePreguntaEsta: "Esta tarjeta señalaría si algún canal concentra riesgo de cartera o de pocos clientes.",
    etiquetas: {
      detecta: "canal más concentrado",
      explica: "top 2 canales por riesgo",
      prioriza: "canales a revisar primero",
      recomienda: "cobertura del cruce cartera-canal",
    },
  });

  const categorias = [participacion, crecimiento, ticket, riesgo];

  return {
    eyebrow: "VENTAS · CANALES",
    titulo: "Canales y tipo de cliente",
    rotuloRiel: "Indicadores",
    corte: "Sin corte — fuente no conectada",
    categorias,
    resumen: {
      subtitulo: "Participación, crecimiento, ticket y riesgo por canal",
      kpis: [
        { etiqueta: "Participación por canal", valor: "Sin dato", nota: "fuente no conectada" },
        { etiqueta: "Crecimiento por canal", valor: "Sin dato", nota: "fuente no conectada" },
        { etiqueta: "Ticket por canal", valor: "Sin dato", nota: "fuente no conectada" },
        { etiqueta: "Riesgo y concentración", valor: "Sin dato", nota: "fuente no conectada" },
      ],
      tituloMix: "Mezcla por canal",
      preguntaMix: "¿Cómo se reparte la venta confirmada entre canales?",
      tituloCobertura: "Calidad de la lectura",
      preguntaCobertura: "¿Cuánto respalda cada indicador?",
      notaCobertura:
        "Los cuatro indicadores están en 0% de cobertura real: el campo canal/tipo de cliente no existe en el dataset actual. No se reparte venta entre canales inventados para llenar la pantalla.",
      pie:
        `Ningún número de esta página es una medición: es la declaración de qué falta conectar. Fuente pendiente: ${FUENTE_PENDIENTE}`,
    },
  };
}
