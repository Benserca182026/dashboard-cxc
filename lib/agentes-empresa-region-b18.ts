import type { CategoriaB18, ContratoB18, MetadatoB18 } from "@/lib/contrato-b18";
import { repartir } from "@/lib/contrato-b18";
import type { FilaEvolucion } from "@/lib/odoo-lectura-viva";
import {
  AVZ_CLIENTES_COMPRARON_2026,
  AVZ_CLIENTES_EN_DEPTO,
  AVZ_PEDIDOS_2024,
  AVZ_PEDIDOS_HISTORICOS,
  AVZ_PRIMER_MES_REAL,
  AVZ_TOP1_PCT,
  AVZ_TOP3_PCT,
  AVZ_VENTA_2024_ANIO,
  AVZ_VENTA_2026_VENTANA,
  CLIENTES_CON_CIUDAD,
  CLIENTES_CON_REGION,
  CLIENTES_TOTAL,
  COBERTURA_REGION,
  COMPANIAS,
  CRECIMIENTO_PAIS_25_26,
  DEPARTAMENTOS_EVALUADOS,
  DEPARTAMENTOS_PCT_CONFIABLE,
  EVOLUCION_REGION,
  FRACCION_VENTANA_PAIS,
  GUATEMALA_CLIENTES,
  GUATEMALA_PCT_CLIENTES,
  GUATEMALA_PCT_PEDIDOS,
  GUATEMALA_PEDIDOS,
  LIMITE_CORTO,
  LIMITE_CORTO_EN_CURSO,
  LIMITE_VIVO,
  MONEDA_DECLARADA,
  PEDIDOS_TOTAL_GTQ,
  REGION_VENDEDOR_ACTIVIDAD,
  SELLO_LECTURA_REGION_LOCAL,
  TICKET_POR_REGION,
  TOTAL_VENTANA,
  VENTANA_COMPARABLE,
  VENTA_POR_REGION,
  VENTA_TOTAL_GTQ,
  fraccionVentanaDe,
  pct,
  q,
} from "@/lib/odoo-lectura-viva";

/**
 * EMPRESA Y REGIÓN sobre el molde B18, leyendo Odoo vivo.
 *
 * La página tiene CUATRO cortes: tres territoriales y uno temporal.
 *
 *   · REGIÓN, CONCENTRACIÓN y CALIDAD DEL DATO se calculan sobre el acumulado
 *     desde 2022. res.partner.state_id está poblado en 371 de 417 clientes
 *     (88.97%) y reparte la venta en 20 departamentos de Guatemala.
 *
 *   · EVOLUCIÓN es la dimensión de TIEMPO, y existe porque sin ella la página
 *     estaba ciega: en el acumulado, un departamento que se está muriendo y
 *     uno que está naciendo se ven iguales. Huehuetenango aparece quinto con
 *     Q947,581.47 y viene cayendo; Alta Verapaz aparece décimo y hoy hace
 *     Q130,569.96 dentro de la ventana, cuando en todo 2024 hizo Q10,302.72
 *     en 3 pedidos. Toda comparación usa la VENTANA COMPARABLE (1 ene → 3 sep
 *     de cada año) porque 2026 está en curso y medirlo contra años completos
 *     daría caídas inventadas.
 *
 *     PERO la ventana es honesta para el PAÍS y engañosa por departamento: la
 *     venta no se reparte igual dentro del año en cada territorio. Por eso EV
 *     publica QUETZALES por departamento y reserva el porcentaje para el país
 *     y para los 7 departamentos que cumplen pctConfiable. Ver el JSDoc de la
 *     categoría EV y ESTACIONALIDAD_REGION en odoo-lectura-viva.
 *
 * LA DIMENSIÓN EMPRESA NO DESAPARECIÓ, SE DECLARA: res.company devuelve UNA
 * sola compañía, "Benserca 18 SA", dueña del 100% de los 3.243 pedidos
 * confirmados. Eso es una DIMENSIÓN DE VALOR ÚNICO, no un dato faltante, y la
 * distinción se conserva en el pie y en la nota de cobertura del resumen. Lo
 * que se quitó fue la categoría entera que gastaba cuatro tarjetas en repetir
 * ese mismo hecho.
 *
 * Ojo con res.partner.city: está poblado en 1 de 417 clientes. No sirve como
 * dimensión y no se usa en ninguna categoría.
 */

const EYEBROW = "VENTAS · EMPRESA Y REGIÓN";

/** Las filas con departamento real, sin la bolsa de los que no lo tienen. */
const CON_REGION = VENTA_POR_REGION.filter((f) => f.region !== "Sin departamento");
const SIN_REGION = VENTA_POR_REGION.find((f) => f.region === "Sin departamento");

const VENTA_SIN_REGION = SIN_REGION ? SIN_REGION.venta : 0;
const VENTA_CON_REGION = VENTA_TOTAL_GTQ - VENTA_SIN_REGION;
/** Cobertura POR DINERO, que no coincide con la cobertura por clientes. */
const COBERTURA_REGION_DINERO = pct(VENTA_CON_REGION, VENTA_TOTAL_GTQ);

const LIDER = CON_REGION[0];
const TOP3 = CON_REGION.slice(0, 3);
const VENTA_TOP3 = TOP3.reduce((s, f) => s + f.venta, 0);
const COLA = CON_REGION.filter((f) => pct(f.venta, VENTA_TOTAL_GTQ) < 1);
const VENTA_COLA = COLA.reduce((s, f) => s + f.venta, 0);
/** Los que no son ni top 3 ni cola: el cuerpo intermedio del reparto. */
const MEDIOS = CON_REGION.filter((f) => !TOP3.includes(f) && !COLA.includes(f));
const VENTA_MEDIOS = MEDIOS.reduce((s, f) => s + f.venta, 0);
/** Concentración medida sobre la venta UBICABLE, no sobre el total. */
const CONCENTRACION_TOP3 = pct(VENTA_TOP3, VENTA_CON_REGION);

// ── Utilidades de lectura, sin inventar unidades ──────────────────────────

function porcentaje(valor: number): string {
  return `${valor.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

/** Posición del departamento en el ranking de venta ACUMULADA (1-based). */
function posicion(region: string): number {
  return VENTA_POR_REGION.findIndex((f) => f.region === region) + 1;
}

function ventaAcumulada(region: string): number {
  const fila = VENTA_POR_REGION.find((f) => f.region === region);
  return fila ? fila.venta : 0;
}

function ev(region: string): FilaEvolucion {
  const fila = EVOLUCION_REGION.find((f) => f.region === region);
  if (!fila) throw new Error(`Departamento sin lectura de evolución: ${region}`);
  return fila;
}

function ticket(region: string): number {
  const fila = TICKET_POR_REGION.find((f) => f.region === region);
  return fila ? fila.ticket : 0;
}

function actividad(region: string): { pctConVendedor: number; pctActivos: number } {
  const fila = REGION_VENDEDOR_ACTIVIDAD.find((f) => f.region === region);
  return fila ?? { pctConVendedor: 0, pctActivos: 0 };
}

function corto(region: string): string {
  return region.replace(" (GT)", "");
}

// ── Evolución: lo que la ventana comparable deja ver ──────────────────────

const EV_GT = ev("Guatemala (GT)");
const EV_SUCHI = ev("Suchitepequez (GT)");
const EV_AVZ = ev("Alta Verapaz (GT)");
const EV_RETAL = ev("Retalhuleu (GT)");
const EV_SM = ev("San Marcos (GT)");
const EV_SOLOLA = ev("Sololá (GT)");
const EV_HUE = ev("Huehuetenango (GT)");
const EV_SINDEP = ev("Sin departamento");

/** Los que crecen, SIN el líder: el líder se lee aparte, en RE · Prioriza. */
const GANADORES = EVOLUCION_REGION.filter(
  (f) => f.delta > 0 && f.region !== EV_GT.region
).sort((a, b) => b.delta - a.delta);
const PERDEDORES = EVOLUCION_REGION.filter((f) => f.delta < 0).sort((a, b) => a.delta - b.delta);

const VAR_GT = pct(EV_GT.delta, EV_GT.v2025);
/** El país fuera del líder, para separar las dos velocidades de la mezcla. */
const RESTO_2025 = TOTAL_VENTANA.v2025 - EV_GT.v2025;
const RESTO_2026 = TOTAL_VENTANA.v2026 - EV_GT.v2026;
const VAR_RESTO = pct(RESTO_2026 - RESTO_2025, RESTO_2025);

/** La ventana, sin la coletilla "de cada año": sirve para rotular un año concreto. */
const VENTANA_CORTA = VENTANA_COMPARABLE.replace(" de cada año", "");

/** El año en que Alta Verapaz empezó a vender de verdad, leído del sello. */
const AVZ_ANIO_ACTIVACION = AVZ_PRIMER_MES_REAL.slice(0, 4);

// ── Ticket y cruce territorio × responsable ───────────────────────────────

const TICKET_GT = ticket("Guatemala (GT)");
const TICKET_SIN_DEPTO = ticket("Sin departamento");
const TICKET_SM = ticket("San Marcos (GT)");
const TICKET_HUE = ticket("Huehuetenango (GT)");

const RVA_GT = actividad("Guatemala (GT)");
const RVA_SAC = actividad("Sacatepequez (GT)");
const RVA_HUE = actividad("Huehuetenango (GT)");
const RVA_SM = actividad("San Marcos (GT)");
const RVA_QUICHE = actividad("Quiché (GT)");

/**
 * El pie de procedencia, recortado a TRES líneas: Corte, Moneda y Límite.
 *
 * Fuente, Capa y Cobertura salieron de la vista a propósito. No se perdieron:
 * el modelo, el campo y el dominio exacto de cada categoría viven ahora en el
 * JSDoc que la encabeza, donde le sirven a quien construye. Al que lee el
 * tablero le sirve otra cosa —de cuándo es el dato, en qué moneda está y qué
 * no puede pedirle—, y eso es lo único que queda abajo.
 */
function metadatos(limite: string = LIMITE_CORTO): MetadatoB18[] {
  return [
    { termino: "Corte", valor: `Lectura viva de Odoo del ${SELLO_LECTURA_REGION_LOCAL}` },
    { termino: "Moneda", valor: MONEDA_DECLARADA },
    { termino: "Límite", valor: limite },
  ];
}

// ── 1. REGIÓN — dónde está la venta ───────────────────────────────────────

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: sale.order agrupado por res.partner.state_id del cliente.
 *   Dominio [['state','in',['sale','done']],['currency_id.name','=','GTQ']].
 * Capa:   venta confirmada ACUMULADA, atribuida al departamento del CLIENTE.
 *   No es el lugar de entrega ni el domicilio fiscal del pedido: es el
 *   departamento del socio comercial.
 * Cobertura: COBERTURA_REGION_DINERO % de VENTA_TOTAL_GTQ — la venta cuyo
 *   cliente tiene departamento declarado, sobre la venta total.
 */
const REGION: CategoriaB18 = {
  id: "region",
  sigla: "RE",
  nombre: "Venta por departamento",
  senal: `${LIDER.region} concentra ${pct(LIDER.venta, VENTA_TOTAL_GTQ).toFixed(2)}% de la venta`,
  pregunta: "¿En qué departamentos está realmente el negocio?",
  filas: repartir(
    VENTA_POR_REGION.slice(0, 10).map((f) => ({
      nombre: f.region,
      valor: f.venta,
      valorTexto: q(f.venta),
    }))
  ),
  cobertura: COBERTURA_REGION_DINERO,
  coberturaEtiqueta:
    "venta confirmada cuyo cliente tiene departamento declarado en res.partner.state_id, sobre la venta total",
  metricas: [
    { valor: `${CON_REGION.length}`, etiqueta: "departamentos con venta" },
    { valor: q(LIDER.venta), etiqueta: `venta en ${LIDER.region}` },
    { valor: q(TICKET_GT), etiqueta: "ticket promedio en el líder" },
  ],
  problema: `${LIDER.region} pesa ${pct(LIDER.venta, VENTA_TOTAL_GTQ).toFixed(2)}% de la venta con ${porcentaje(GUATEMALA_PCT_CLIENTES)} de los clientes ubicables. El peso en dinero casi duplica al peso en clientes: el problema territorial no es cuántos departamentos hay, es que el valor por cliente no se reparte igual que la presencia.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "dona",
      donaPct: pct(LIDER.venta, VENTA_TOTAL_GTQ),
      kpiTexto: q(LIDER.venta),
      etiqueta: `de venta en ${LIDER.region}`,
      resumen: `${pct(LIDER.venta, VENTA_TOTAL_GTQ).toFixed(2)}% del dinero, ${GUATEMALA_PEDIDOS.toLocaleString("es-GT")} de ${PEDIDOS_TOTAL_GTQ.toLocaleString("es-GT")} pedidos (${porcentaje(GUATEMALA_PCT_PEDIDOS)}) y ${GUATEMALA_CLIENTES} de ${CLIENTES_CON_REGION} clientes con departamento (${porcentaje(GUATEMALA_PCT_CLIENTES)}).`,
      problema: `Los tres ángulos no coinciden, y esa es la lectura: con ${porcentaje(GUATEMALA_PCT_CLIENTES)} de los clientes ubicables —menos de un tercio— Guatemala hace más de la mitad del dinero. En pedidos queda en medio, ${porcentaje(GUATEMALA_PCT_PEDIDOS)}. La desproporción está entre clientes y dinero, no entre clientes y actividad.`,
      accion:
        "Dimensionar la atención por peso en dinero y no por número de clientes ni de departamentos: fuera de Guatemala hacen falta más cuentas, dentro hace falta cuidar las que ya están.",
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: q(TICKET_GT),
      etiqueta: "de ticket promedio por pedido en Guatemala",
      resumen: `San Marcos promedia ${q(TICKET_SM)} y Huehuetenango ${q(TICKET_HUE)}: casi la mitad por pedido.`,
      problema:
        "Un departamento puede vender poco por dos razones distintas: porque tiene pocos clientes o porque cada pedido es barato. Son dos problemas con dos soluciones opuestas —conseguir cuentas o subir el pedido— y el ranking de venta acumulada las mezcla en una sola cifra.",
      accion:
        "Clasificar cada departamento por ticket antes de fijarle plan: donde el ticket es bajo el remedio es mezcla de producto y tamaño de pedido, no más visitas.",
    },
    {
      id: "prioriza",
      grafica: "barras",
      kpiTexto: q(EV_GT.delta),
      etiqueta: "ganó Guatemala este año contra el mismo período del anterior",
      resumen: `Los que más suman después, en la ventana ${VENTANA_COMPARABLE}: ${corto(EV_SUCHI.region)} +${q(EV_SUCHI.delta)}, ${corto(EV_AVZ.region)} +${q(EV_AVZ.delta)}, ${corto(EV_RETAL.region)} +${q(EV_RETAL.delta)}.`,
      problema: `Se mide en quetzales ganados y no en porcentaje a propósito: ${corto(EV_AVZ.region)} sumó ${q(EV_AVZ.delta)}, pero su base 2025 DENTRO de la ventana fue de ${q(EV_AVZ.v2025)} — apenas el ${porcentaje(fraccionVentanaDe(EV_AVZ.region) ?? 0)} de lo que ese departamento vendió en todo el año. Un cociente contra ese residuo mide dónde corta la ventana, no crecimiento; el monto ganado sí dice cuánto dinero nuevo entró de verdad.`,
      accion:
        "Repartir el esfuerzo de crecimiento por quetzales ganados, y publicar el porcentaje sólo donde la ventana cubra al menos la mitad del año del departamento.",
    },
    {
      id: "recomienda",
      grafica: "barras",
      kpiTexto: porcentaje(VAR_GT),
      etiqueta: `creció Guatemala, contra ${porcentaje(CRECIMIENTO_PAIS_25_26)} del país`,
      resumen: `El país pasó de ${q(TOTAL_VENTANA.v2025)} a ${q(TOTAL_VENTANA.v2026)} en la ventana ${VENTANA_COMPARABLE}; Guatemala, de ${q(EV_GT.v2025)} a ${q(EV_GT.v2026)}.`,
      problema:
        "La mitad del negocio crece a un tercio del ritmo del resto. Mientras eso siga así el crecimiento total se va a frenar solo, sin que nadie haga nada mal: basta con que el bloque mayoritario siga creciendo despacio. El acumulado desde 2022 no puede mostrar esto nunca, porque no tiene eje de tiempo.",
      accion:
        "Tratar Guatemala como cuenta a defender y reactivar, no como territorio maduro que se sostiene solo, y medir este módulo por ventana comparable en lugar de por acumulado.",
    },
  ],
};

// ── 2. CONCENTRACIÓN — cuán desigual es el reparto ────────────────────────

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: sale.order agrupado por res.partner.state_id.
 *   Dominio [['state','in',['sale','done']],['currency_id.name','=','GTQ']].
 * Capa:   distribución de la venta entre territorios ubicables. Mide
 *   desigualdad del reparto, no calidad del dato ni desempeño de nadie.
 * Cobertura: CONCENTRACION_TOP3 % de la venta ubicable, concentrado en 3
 *   departamentos.
 */
const CONCENTRACION: CategoriaB18 = {
  id: "concentracion",
  sigla: "CN",
  nombre: "Concentración territorial",
  senal: `${COLA.length} departamentos aportan menos del 1% cada uno`,
  pregunta: "¿Qué tan desigual es el reparto del negocio por territorio?",
  filas: repartir([
    {
      nombre: `Los 3 mayores (${TOP3.map((f) => corto(f.region)).join(", ")})`,
      valor: VENTA_TOP3,
      valorTexto: q(VENTA_TOP3),
    },
    {
      nombre: `Cuerpo intermedio (${MEDIOS.length} departamentos)`,
      valor: VENTA_MEDIOS,
      valorTexto: q(VENTA_MEDIOS),
    },
    {
      nombre: `Cola bajo el 1% (${COLA.length} departamentos)`,
      valor: VENTA_COLA,
      valorTexto: q(VENTA_COLA),
    },
  ]),
  cobertura: CONCENTRACION_TOP3,
  coberturaEtiqueta:
    "peso de los tres mayores sobre la venta ubicable — aquí cobertura se lee como concentración, no como calidad de dato",
  metricas: [
    { valor: q(VENTA_TOP3), etiqueta: "venta sumada de los tres mayores" },
    { valor: `${COLA.length}`, etiqueta: "departamentos bajo el 1%" },
    { valor: q(VENTA_COLA), etiqueta: "venta sumada de esa cola" },
  ],
  problema: `Los tres mayores suman ${q(VENTA_TOP3)} y los ${COLA.length} menores ${q(VENTA_COLA)} entre todos. Entre un extremo y el otro no hay diferencia de grado sino de escala: el reparto territorial no es una curva, son dos mundos.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "pareto",
      kpiTexto: porcentaje(pct(VENTA_TOP3, VENTA_TOTAL_GTQ)),
      etiqueta: "de la venta está en 3 departamentos",
      resumen: `Los ${COLA.length} menores suman ${q(VENTA_COLA)}, el ${porcentaje(pct(VENTA_COLA, VENTA_TOTAL_GTQ))} del total.`,
      problema: `La diversificación que sugiere la lista de ${CON_REGION.length} departamentos es aparente. Medida por extremos, la distancia es de dos órdenes de magnitud: lo que venden los tres primeros no lo alcanzan los nueve últimos ni sumados entre sí muchas veces.`,
      accion:
        "Leer los departamentos de la cola como desarrollo o presencia, nunca como base instalada, y no prorratear metas entre veinte territorios que no son comparables.",
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${COLA.length}`,
      etiqueta: "departamentos por debajo del 1% de la venta",
      resumen: `Entre todos suman ${q(VENTA_COLA)}, el ${porcentaje(pct(VENTA_COLA, VENTA_TOTAL_GTQ))}.`,
      problema:
        "Buena parte del mapa es presencia simbólica: uno o dos clientes con pocos pedidos. Contarlos como cobertura nacional sobreestima el alcance real.",
      accion:
        "Distinguir en el reporte entre departamento atendido y departamento con presencia puntual.",
    },
    {
      id: "prioriza",
      grafica: "dona",
      donaPct: pct(VENTA_SIN_REGION, VENTA_TOTAL_GTQ),
      kpiTexto: q(VENTA_SIN_REGION),
      etiqueta: "de venta sin departamento asignado",
      resumen: SIN_REGION
        ? `Sólo ${SIN_REGION.clientes} clientes, pero ${SIN_REGION.pedidos} pedidos y el ticket promedio más alto de toda la base: ${q(TICKET_SIN_DEPTO)} por pedido.`
        : "Sin clientes en esta condición.",
      problema: SIN_REGION
        ? `Estos ${SIN_REGION.clientes} clientes tienen el TICKET PROMEDIO MÁS ALTO de todos, ${q(TICKET_SIN_DEPTO)} por pedido: casi 2.5 veces el de ${corto(LIDER.region)}, que promedia ${q(TICKET_GT)}. No son fichas olvidadas de clientes chicos —esa es la lectura fácil y es falsa—: son los clientes de mayor valor por pedido de la base, y son justamente los que no aparecen en ningún mapa territorial.`
        : "No aplica.",
      accion: SIN_REGION
        ? `Completar esas ${SIN_REGION.clientes} fichas deja de ser higiene de datos y pasa a ser recuperar visibilidad sobre los clientes más valiosos por pedido que tiene la empresa.`
        : "No aplica.",
    },
    {
      id: "recomienda",
      grafica: "barras",
      kpiTexto: q(Math.abs(EV_SM.delta)),
      etiqueta: "perdió San Marcos contra el mismo período del año pasado",
      resumen: `${corto(EV_SM.region)} ${porcentaje(EV_SM.varPct ?? 0)} y ${corto(EV_HUE.region)} ${porcentaje(EV_HUE.varPct ?? 0)} (−${q(Math.abs(EV_HUE.delta))}), dos porcentajes con base sólida. ${corto(EV_SOLOLA.region)} perdió ${q(Math.abs(EV_SOLOLA.delta))} en la ventana, y su porcentaje no es comparable.`,
      problema: `En el acumulado desde 2022, San Marcos sigue apareciendo ${posicion(EV_SM.region)}º con ${q(ventaAcumulada(EV_SM.region))}, como si no hubiera pasado nada. El retroceso territorial no se nota en el total hasta que ya es tarde: al acumulado le toma años borrar lo que un territorio dejó de vender.`,
      accion:
        "Revisar San Marcos, Sololá y Huehuetenango contra la ventana comparable antes de renovarles plan, y dejar de leer la posición en el ranking acumulado como si fuera un estado de salud.",
    },
  ],
};

// ── 3. COBERTURA GEOGRÁFICA — calidad del dato de ubicación ───────────────

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: res.partner.state_id, res.partner.city y res.partner.user_id, sobre
 *   clientes con customer_rank > 0.
 * Capa:   calidad del dato de ubicación y del dato de responsable. Mide qué
 *   fracción de las fichas permite ubicar y atender al cliente, no cuánto
 *   vende ninguna región.
 * Cobertura: COBERTURA_REGION % por clientes — pero COBERTURA_REGION_DINERO %
 *   por dinero. Las dos cifras no coinciden y esa diferencia es el hallazgo.
 */
const COBERTURA_GEO: CategoriaB18 = {
  id: "cobertura-geografica",
  sigla: "CG",
  nombre: "Calidad del dato geográfico",
  senal: `Departamento en ${CLIENTES_CON_REGION} de ${CLIENTES_TOTAL} clientes; ciudad en ${CLIENTES_CON_CIUDAD}`,
  pregunta: "¿Se puede confiar en la ubicación que trae cada cliente?",
  filas: repartir([
    {
      nombre: "Clientes con departamento",
      valor: CLIENTES_CON_REGION,
      valorTexto: `${CLIENTES_CON_REGION} clientes`,
    },
    {
      nombre: "Clientes sin departamento",
      valor: CLIENTES_TOTAL - CLIENTES_CON_REGION,
      valorTexto: `${CLIENTES_TOTAL - CLIENTES_CON_REGION} clientes`,
    },
  ]),
  cobertura: COBERTURA_REGION,
  coberturaEtiqueta: `clientes con res.partner.state_id poblado, sobre los ${CLIENTES_TOTAL} con customer_rank > 0`,
  metricas: [
    { valor: `${CLIENTES_CON_REGION}`, etiqueta: "con departamento" },
    { valor: `${CLIENTES_TOTAL - CLIENTES_CON_REGION}`, etiqueta: "sin departamento" },
    { valor: `${CLIENTES_CON_CIUDAD}`, etiqueta: "con ciudad declarada" },
  ],
  problema: `El departamento está en ${COBERTURA_REGION.toFixed(2)}% de los clientes, pero la ciudad sólo en ${CLIENTES_CON_CIUDAD} de ${CLIENTES_TOTAL}. Cualquier lectura más fina que el departamento es imposible hoy.`,
  metadatos: metadatos(),
  tarjetas: [
    {
      id: "detecta",
      grafica: "cobertura",
      donaPct: COBERTURA_REGION,
      kpiTexto: `${COBERTURA_REGION.toFixed(2)}%`,
      etiqueta: "de los clientes tiene departamento",
      resumen: `${CLIENTES_CON_REGION} de ${CLIENTES_TOTAL} fichas ubicables a nivel departamento.`,
      problema:
        "Es una cobertura alta, suficiente para leer el mapa, pero no completa. El reporte territorial siempre dejará algo fuera mientras falten fichas.",
      accion: "Completar las fichas faltantes en Odoo; son menos de cincuenta.",
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${(COBERTURA_REGION - COBERTURA_REGION_DINERO).toFixed(2)} pts`,
      etiqueta: "de diferencia entre cobertura por clientes y por dinero",
      resumen: `${COBERTURA_REGION.toFixed(2)}% de las fichas, pero sólo ${COBERTURA_REGION_DINERO.toFixed(2)}% del dinero.`,
      problema:
        "Los clientes sin departamento no son los chicos: son pocos pero pesan más que su número. Medir la cobertura contando fichas hace parecer el problema menor de lo que es.",
      accion:
        "Priorizar la corrección por monto, no por cantidad de fichas: empezar por los clientes sin departamento que más venden.",
    },
    {
      id: "prioriza",
      grafica: "dona",
      donaPct: pct(CLIENTES_CON_CIUDAD, CLIENTES_TOTAL),
      kpiTexto: `${CLIENTES_CON_CIUDAD}`,
      etiqueta: `de ${CLIENTES_TOTAL} clientes tiene ciudad declarada`,
      resumen: "El campo existe en el modelo, pero está prácticamente vacío.",
      problema:
        "No se puede hacer ninguna lectura por ciudad, municipio ni ruta. Cualquier tablero que prometa ese nivel de detalle estaría inventándolo.",
      accion:
        "Decidir si la ciudad se va a capturar de verdad. Si no, no prometer análisis por ruta en ningún módulo.",
    },
    {
      id: "recomienda",
      grafica: "barras",
      kpiTexto: porcentaje(RVA_GT.pctConVendedor),
      etiqueta: `de los clientes de ${corto(LIDER.region)} tiene vendedor asignado`,
      resumen: `Sacatepéquez ${porcentaje(RVA_SAC.pctConVendedor)}, Huehuetenango ${porcentaje(RVA_HUE.pctConVendedor)}, Guatemala ${porcentaje(RVA_GT.pctConVendedor)}, San Marcos ${porcentaje(RVA_SM.pctConVendedor)}.`,
      problema: `Cruzar cobertura de vendedor con actividad cambia la conclusión. Huehuetenango tiene ${porcentaje(RVA_HUE.pctConVendedor)} de sus clientes con responsable asignado y sólo ${porcentaje(RVA_HUE.pctActivos)} con compra en los últimos 180 días: TIENE quien lo atienda y se muere igual, así que su problema NO se arregla asignando gente —ya la tiene—. Sin este cruce, la conclusión obvia habría sido la equivocada. Quiché repite el patrón: ${porcentaje(RVA_QUICHE.pctConVendedor)} de cobertura contra ${porcentaje(RVA_QUICHE.pctActivos)} de activos.`,
      accion:
        "Antes de mover vendedores a un territorio, comparar su cobertura contra su tasa de activos: donde hay responsable y no hay actividad, el problema es de oferta, precio o frecuencia de visita, no de asignación.",
    },
  ],
};

// ── 4. EVOLUCIÓN TERRITORIAL — la dimensión de tiempo ─────────────────────

/**
 * PROCEDENCIA (antes los metadatos "Fuente", "Capa" y "Cobertura" de la vista).
 *
 * Fuente: sale.order.date_order cruzado con res.partner.state_id.
 *   Dominio [['state','in',['sale','done']],['currency_id.name','=','GTQ']].
 * Capa:   venta confirmada dentro de la VENTANA COMPARABLE, NO acumulado
 *   histórico. Los tres años se cortan en la misma fecha.
 * Cobertura: CRECIMIENTO_PAIS_25_26 % de crecimiento país, de TOTAL_VENTANA
 *   .v2025 a .v2026.
 *
 * REGLA DE PRESENTACIÓN DE ESTA CATEGORÍA
 * ---------------------------------------
 * Por departamento se publican QUETZALES, siempre rotulados "en la ventana
 * 1 ene → 3 sep", y NUNCA un porcentaje de variación, salvo donde
 * ESTACIONALIDAD_REGION marca pctConfiable. El motivo está medido: la venta no
 * se reparte igual dentro del año en cada departamento. En el país el 64.11%
 * del año cae dentro de la ventana, pero en Alta Verapaz sólo el 3.64%, en
 * Totonicapán el 11.42%, en Retalhuleu el 15.34% y en Suchitepéquez el 33.11%.
 * Dividir contra ese residuo no mide crecimiento: mide dónde corta la ventana.
 * El único porcentaje libre es el del PAÍS, que sí tiene base sólida.
 */
const EVOLUCION: CategoriaB18 = {
  id: "evolucion",
  sigla: "EV",
  nombre: "Evolución territorial",
  senal: `El país crece ${porcentaje(CRECIMIENTO_PAIS_25_26)} y Guatemala sólo ${porcentaje(VAR_GT)}`,
  pregunta: "¿Qué territorio está creciendo y cuál se está apagando?",
  filas: repartir(
    GANADORES.slice(0, 8).map((f) => ({
      nombre: corto(f.region),
      valor: f.delta,
      valorTexto: `+${q(f.delta)} en la ventana`,
    }))
  ),
  cobertura: CRECIMIENTO_PAIS_25_26,
  coberturaEtiqueta:
    "crecimiento del país en la ventana comparable — aquí cobertura se lee como ritmo, no como calidad de dato",
  metricas: [
    { valor: q(TOTAL_VENTANA.v2024), etiqueta: "venta en la ventana de 2024" },
    { valor: q(TOTAL_VENTANA.v2025), etiqueta: "venta en la ventana de 2025" },
    { valor: q(TOTAL_VENTANA.v2026), etiqueta: "venta en la ventana de 2026" },
  ],
  problema: `El acumulado desde 2022 no distingue un territorio que murió de uno que nace. Huehuetenango aparece ${posicion(EV_HUE.region)}º con ${q(ventaAcumulada(EV_HUE.region))} como si estuviera sano, y viene cayendo; Alta Verapaz aparece ${posicion(EV_AVZ.region)}º y hoy hace ${q(EV_AVZ.v2026)} dentro de la ventana ${VENTANA_COMPARABLE}, cuando en todo 2024 hizo ${q(AVZ_VENTA_2024_ANIO)} en ${AVZ_PEDIDOS_2024} pedidos. Por departamento esta categoría publica quetzales, no porcentajes: el reparto de abajo muestra a los que ganan FUERA de la capital, y el líder se lee aparte porque su tamaño taparía a todos los demás.`,
  metadatos: metadatos(LIMITE_CORTO_EN_CURSO),
  tarjetas: [
    {
      id: "detecta",
      grafica: "barras",
      kpiTexto: q(AVZ_VENTA_2026_VENTANA),
      etiqueta: `vende Alta Verapaz en la ventana ${VENTANA_CORTA} de 2026`,
      resumen: `No creció: SE ACTIVÓ, y el primer mes con venta real fue agosto de ${AVZ_ANIO_ACTIVACION} — en todo 2024 hizo ${q(AVZ_VENTA_2024_ANIO)} en ${AVZ_PEDIDOS_2024} pedidos sueltos. Hoy le compran ${AVZ_CLIENTES_COMPRARON_2026} clientes distintos de los ${AVZ_CLIENTES_EN_DEPTO} del departamento, y el mayor pesa ${porcentaje(AVZ_TOP1_PCT)}: es actividad repartida, no un pedido grande.`,
      problema: `Su venta de 2025 quedó casi toda FUERA de la ventana: sólo el ${porcentaje(fraccionVentanaDe(EV_AVZ.region) ?? 0)} del año cayó dentro, contra ${porcentaje(FRACCION_VENTANA_PAIS)} del país. Por eso cualquier porcentaje de variación para Alta Verapaz es un artefacto del corte y no un crecimiento: el cociente no está midiendo el negocio, está midiendo dónde corta la ventana. En quetzales, en cambio, la lectura aguanta.`,
      accion: `Leer Alta Verapaz por quetzales y por clientes que compran —${AVZ_CLIENTES_EN_DEPTO} clientes en el departamento, ${AVZ_PEDIDOS_HISTORICOS} pedidos históricos, ${AVZ_CLIENTES_COMPRARON_2026} compradores en la ventana, ${porcentaje(AVZ_TOP3_PCT)} en los tres mayores— y darle plan de territorio que arranca, no de territorio que se dispara.`,
    },
    {
      id: "explica",
      grafica: "barras",
      kpiTexto: `${PERDEDORES.length}`,
      etiqueta: `de las ${EVOLUCION_REGION.length} filas medidas venden menos dentro de la ventana ${VENTANA_CORTA}`,
      resumen: `Con base sólida para el porcentaje: ${corto(EV_SM.region)} ${porcentaje(EV_SM.varPct ?? 0)}, ${corto(EV_HUE.region)} ${porcentaje(EV_HUE.varPct ?? 0)} y la bolsa Sin departamento ${porcentaje(EV_SINDEP.varPct ?? 0)} (−${q(Math.abs(EV_SINDEP.delta))}). ${corto(EV_SOLOLA.region)} va aparte: cayó a ${q(EV_SOLOLA.v2026)} en la ventana desde ${q(EV_SOLOLA.v2025)}, y su porcentaje no es publicable porque la base no llega al mínimo.`,
      problema:
        "Ninguna de las cuatro desapareció del reporte: las cuatro siguen sumando en el acumulado histórico y las cuatro conservan su posición en el ranking. Un territorio puede pasar años apagándose sin que el tablero cambie de color, porque el acumulado sólo puede crecer. Y ni siquiera todas se pueden leer igual: tres admiten porcentaje y Sololá sólo admite quetzales.",
      accion:
        "Publicar la variación contra ventana comparable al lado del acumulado en todo reporte territorial, en porcentaje donde la base lo aguante y en quetzales donde no, y declarar que el acumulado por sí solo no es un estado de salud.",
    },
    {
      id: "prioriza",
      grafica: "barras",
      kpiTexto: porcentaje(VAR_RESTO),
      etiqueta: `creció el país sin Guatemala, contra ${porcentaje(VAR_GT)} del líder`,
      resumen: `Fuera de la capital, el país pasó de ${q(RESTO_2025)} a ${q(RESTO_2026)} en la misma ventana.`,
      problema: `El ${porcentaje(CRECIMIENTO_PAIS_25_26)} del país es un promedio que mezcla dos velocidades incompatibles: un bloque de más de la mitad de la venta que crece ${porcentaje(VAR_GT)} y un resto que crece ${porcentaje(VAR_RESTO)}. Mientras el bloque lento sea el mayoritario, el promedio nacional va a bajar cada año aunque el resto siga acelerando. Eso es aritmética de mezcla, no desempeño de nadie.`,
      accion:
        "Publicar el crecimiento en dos velocidades —líder y resto del país— en vez de un solo porcentaje nacional, y fijar la meta de Guatemala aparte de la meta agregada.",
    },
    {
      id: "recomienda",
      grafica: "barras",
      kpiTexto: `${DEPARTAMENTOS_PCT_CONFIABLE}`,
      etiqueta: `de ${DEPARTAMENTOS_EVALUADOS} departamentos tienen una variación porcentual confiable`,
      resumen: `En el país, el ${porcentaje(FRACCION_VENTANA_PAIS)} de la venta anual cae dentro de la ventana ${VENTANA_COMPARABLE}. Pero en ${corto(EV_AVZ.region)} sólo el ${porcentaje(fraccionVentanaDe(EV_AVZ.region) ?? 0)}, en Totonicapán el ${porcentaje(fraccionVentanaDe("Totonicapán (GT)") ?? 0)}, en ${corto(EV_RETAL.region)} el ${porcentaje(fraccionVentanaDe(EV_RETAL.region) ?? 0)} y en ${corto(EV_SUCHI.region)} el ${porcentaje(fraccionVentanaDe(EV_SUCHI.region) ?? 0)}. En esos casos el porcentaje mide dónde corta la ventana, no el negocio.`,
      problema: `Por eso esta categoría publica quetzales ganados o perdidos por departamento, y reserva el porcentaje para el total del país y para los ${DEPARTAMENTOS_PCT_CONFIABLE} departamentos que cumplen el criterio: al menos la mitad de su año dentro de la ventana y una base de ${q(50_000)} en la ventana de 2025. Los otros catorce no tienen un crecimiento que publicar —tienen un corte de calendario que se les cruzó—, y llamarle crecimiento sería inventar el hallazgo.`,
      accion:
        "Al leer cualquier reporte territorial, propio o ajeno, mirar primero qué fracción del año cubre la ventana antes de creerle a un porcentaje. Si la ventana no cubre la mitad del año de ese territorio, el número que se está leyendo es el calendario, no el negocio.",
    },
  ],
};

// ── Contrato ──────────────────────────────────────────────────────────────

/**
 * La compañía única. La categoría EMPRESA se retiró —gastaba cuatro tarjetas
 * en un solo hecho—, pero el hecho NO se pierde: se declara en el pie y en la
 * nota de cobertura, porque distinguir "dimensión de valor único" de "dato
 * faltante" es una regla de honestidad de este proyecto.
 */
const UNICA = COMPANIAS[0];

export function construirEmpresaRegionB18(): ContratoB18 {
  return {
    eyebrow: EYEBROW,
    titulo: "Empresa y región",
    rotuloRiel: "Cortes disponibles",
    corte: `Odoo vivo · ${SELLO_LECTURA_REGION_LOCAL}`,
    categorias: [REGION, CONCENTRACION, COBERTURA_GEO, EVOLUCION],
    resumen: {
      subtitulo:
        "Cuatro cortes calculados con datos reales: tres territoriales —dónde está la venta, cuán desigual es el reparto y si el dato de ubicación aguanta— y uno temporal, el único capaz de distinguir un departamento que nace de uno que se está apagando. Ninguna cifra se rellenó para completar la cuadrícula.",
      kpis: [
        {
          etiqueta: "Departamento líder",
          valor: `${pct(LIDER.venta, VENTA_TOTAL_GTQ).toFixed(2)}%`,
          nota: `${LIDER.region} con ${q(LIDER.venta)} y ${LIDER.clientes} clientes`,
        },
        {
          etiqueta: "Crecimiento del país",
          valor: porcentaje(CRECIMIENTO_PAIS_25_26),
          nota: `De ${q(TOTAL_VENTANA.v2025)} a ${q(TOTAL_VENTANA.v2026)} en la ventana ${VENTANA_COMPARABLE}`,
        },
        {
          etiqueta: "Guatemala en esa ventana",
          valor: porcentaje(VAR_GT),
          nota: "La mitad del negocio crece a un tercio del ritmo del resto del país",
        },
        {
          etiqueta: "Territorios en retroceso",
          valor: `${PERDEDORES.length}`,
          nota: `${corto(EV_SM.region)} −${q(Math.abs(EV_SM.delta))}, ${corto(EV_SOLOLA.region)} −${q(Math.abs(EV_SOLOLA.delta))}, ${corto(EV_HUE.region)} −${q(Math.abs(EV_HUE.delta))}`,
        },
      ],
      tituloMix: "Reparto de la venta por departamento",
      preguntaMix: "¿Dónde está el negocio y qué tan concentrado está?",
      tituloCobertura: "Cobertura del dato geográfico",
      preguntaCobertura: "¿Qué parte del negocio se puede ubicar en el mapa?",
      notaCobertura: `Cobertura no significa lo mismo en las cuatro: en Venta por departamento es venta ubicable; en Concentración es el peso de los tres mayores sobre esa venta ubicable; en Calidad del dato es fichas con departamento; en Evolución territorial no mide calidad de dato sino RITMO —el crecimiento del país en la ventana comparable—. Aparte, y para que no se pierda al haber retirado la categoría que lo repetía: res.company devuelve UNA sola compañía, ${UNICA.nombre}, dueña del 100% de los ${UNICA.pedidos.toLocaleString("es-GT")} pedidos confirmados. Eso es una dimensión de VALOR ÚNICO, no un dato faltante, y por eso esta página no publica ninguna comparación por empresa.`,
      pie: `Lectura viva de Odoo del ${SELLO_LECTURA_REGION_LOCAL}. ${MONEDA_DECLARADA} La dimensión empresa SÍ se midió: res.company devuelve una sola compañía, ${UNICA.nombre}, con el 100% de los pedidos confirmados — dimensión de valor único, no dato faltante. ${LIMITE_VIVO}`,
    },
  };
}
