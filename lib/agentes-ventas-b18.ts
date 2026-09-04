import {
  construirAlcancesVenta,
  etiquetaMesVenta,
  leerEstacionalidadVenta,
  leerEvolucionDetallada,
  leerEvolucionPorAlcance,
  leerSerieVentas,
  type AlcanceVenta,
  type CalculoVenta,
  type ComparativoYtdVenta,
  type EstacionalidadVenta,
  type LecturaCalidad,
  type LecturaConsistencia,
  type LecturaDependencia,
  type LecturaRitmo,
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

/**
 * Una sub-lectura del agente: un dato concreto que el KPI de titular no dice.
 *
 * `titulo` es EL DATO ("+21.97% sin Top 5") y `etiqueta` es cómo se llama esa
 * medida ("Crecimiento sin las 5 cuentas mayores"). El orden importa: cuatro
 * rótulos genéricos parecidos entre sí tapan cuatro cifras distintas, y el
 * lector termina sin poder distinguir una lectura de otra sin leerlas enteras.
 *
 * `robustez` NO es decorado: dice sobre cuántos pedidos se calcula el número y
 * cuánto se movería si se quitara el pedido más grande. Con ~100 pedidos al mes
 * hay cifras que cambian de signo al sacar uno solo, y eso tiene que verse al
 * lado del número, no en una nota al pie.
 */
export type SubKpiB18 = {
  id: string;
  titulo: string;
  etiqueta: string;
  veredicto: string;
  detalle: string;
  robustez: string;
  color: string;
  /**
   * Mini-serie para el gráfico de la tarjeta: 2 a 6 puntos. `valor` puede ser
   * negativo (una tasa que cae) — el gráfico dibuja desde una línea base, no
   * desde cero-abajo, para que un mes que retrocede se vea hacia abajo y no
   * como una barra más chica. Ausente cuando `calculo.dato` es null (no hay
   * cifra que graficar, no sólo que redondear).
   */
  serie?: { etiqueta: string; valor: number; texto: string }[];
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
  /**
   * Cuatro lecturas que descomponen el KPI de titular de ESTE agente. Opcional
   * a propósito: hoy sólo Evolución las tiene, y un agente sin ellas sigue
   * mostrando el mapa como siempre en vez de cuatro tarjetas vacías.
   */
  subKpis?: SubKpiB18[];
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
  /**
   * Los alcances temporales elegibles del agente de Evolución, cada uno con sus
   * cuatro sub-lecturas ya calculadas. El primero es "Todo el período" y es el
   * que se muestra por defecto: es la lectura que la página tenía antes de
   * existir el filtro, así que abrir la página no cambia lo que ya se leía.
   */
  alcances: AlcanceVentasB18[];
  /** Matriz mes × año: el mismo mes de todos los años, uno al lado del otro. */
  estacionalidad: EstacionalidadVenta;
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

// ── Sub-lecturas de Evolución, dentro de un ALCANCE ─────────────────────────
//
// Cuatro maneras distintas de equivocarse leyendo un solo porcentaje de
// crecimiento, y una cifra que cierra cada una:
//
//   1. ¿Crece el negocio o crecen cinco cuentas?  → concentración del Top 5
//   2. ¿Es un mes suelto o una racha?             → cada mes contra su mismo mes
//   3. ¿A qué ritmo va?                           → TTM, o el año contra el anterior
//   4. ¿Este año fue bueno o normal?              → su tasa contra la de cada año
//
// LAS CUATRO SE RECALCULAN POR ALCANCE. Al dejar elegir 2022, 2023, 2024, 2025,
// 2026 o todo, el riesgo deja de ser "leer mal un número" y pasa a ser
// "comparar dos períodos que no son comparables": 2022 tiene 146 días
// observados y 2024 tiene 366. Por eso ninguna de las cuatro decide su propia
// ventana — todas usan la que ya resolvió `construirAlcancesVenta`, que es
// siempre la intersección de los días observados de los dos lados, y cuando esa
// intersección no existe muestran el motivo en vez de un porcentaje.
//
// FRAGILIDAD DECLARADA, NO IMPLÍCITA: el negocio hace del orden de 60-90
// pedidos al mes. Un pedido grande mueve un mes entero y puede dar vuelta un
// "creció". Cada tarjeta carga sobre cuántos pedidos se calcula y cuánto se
// movería el número al quitar el pedido más grande.

type Formato = (valor: number) => string;

/** Puntos porcentuales: una diferencia de dos tasas NUNCA se escribe con "%". */
const pp = (valor: number) => `${valor >= 0 ? "+" : "−"}${Math.abs(valor).toFixed(2)} pp`;

/** 1 → "1º". El puesto se lee de un vistazo; "puesto 1 de 4" no. */
const ordinal = (valor: number) => `${valor}º`;

const subKpiSinBase = (id: string, etiqueta: string, motivo: string, detalle: string, color: string): SubKpiB18 => ({
  id,
  titulo: "Sin base para calcularlo",
  etiqueta,
  veredicto: motivo,
  detalle,
  robustez: "No hay pedidos sobre los cuales medir fragilidad porque no hay número que medir.",
  color,
});

/**
 * 1 · Dependencia de clientes · las cinco cuentas mayores DEL ALCANCE.
 *
 * Un +40% que se sostiene sobre cinco clientes no es el mismo hecho comercial
 * que un +40% repartido en toda la cartera, y la cifra de titular no distingue
 * entre los dos casos. La concentración se mide sobre el alcance ENTERO —es la
 * pregunta: de quién depende la venta de este período— y el crecimiento sin
 * ellas sobre la ventana comparable, que es lo único que tiene dos lados.
 *
 * ESTE KPI SUBESTIMA EL RIESGO Y HAY QUE DECIRLO. La identidad del cliente sale
 * del nombre: un mismo cliente escrito de dos formas se cuenta como dos cuentas
 * distintas, así que su venta se reparte y puede quedar fuera del Top 5. Toda
 * corrección de esos duplicados sólo puede SUBIR la concentración, nunca
 * bajarla. El número real de dependencia es igual o mayor que el mostrado.
 */
function subKpiDependencia(calculo: CalculoVenta<LecturaDependencia>, alcance: AlcanceVenta, fmt: Formato): SubKpiB18 {
  const etiqueta = `Dependencia de clientes · Top 5 de ${alcance.etiqueta}`;
  if (!calculo.dato) {
    return subKpiSinBase(
      "dependencia",
      etiqueta,
      calculo.motivo,
      "La concentración se mide sobre la venta del alcance: sin pedidos dentro del alcance no hay venta que repartir entre cuentas.",
      AZUL
    );
  }
  const dato = calculo.dato;
  const crecimiento = dato.crecimiento.dato;
  const brecha = crecimiento && crecimiento.variacionCompleta !== null ? dos(crecimiento.variacion - crecimiento.variacionCompleta) : null;
  const concentrado = dato.participacion >= 50 ? "alta" : dato.participacion >= 30 ? "media" : "baja";
  return {
    id: "dependencia",
    titulo: `${pct(dato.participacion)} en 5 cuentas`,
    etiqueta,
    veredicto:
      (concentrado === "alta"
        ? `El negocio DEPENDE de pocas cuentas: cinco clientes concentran ${pct(dato.participacion)} de la venta de ${alcance.etiqueta} y ${dato.nombreMayor} pesa ${pct(dato.participacionMayor)} por sí sola. Perder una de ellas cambia el año.`
        : concentrado === "media"
          ? `Concentración media: cinco de ${entero(dato.clientesTotales)} clientes ponen ${pct(dato.participacion)} de la venta de ${alcance.etiqueta}, con ${dato.nombreMayor} en ${pct(dato.participacionMayor)}. No es dependencia, pero tampoco está repartido.`
          : `La venta está repartida: las cinco cuentas mayores de ${alcance.etiqueta} suman apenas ${pct(dato.participacion)} entre ${entero(dato.clientesTotales)} clientes.`) +
      (crecimiento === null
        ? ` No se puede decir cuánto crecería sin ellas — ${dato.crecimiento.motivo}`
        : brecha === null
          ? ` Sin esas cinco cuentas el resto de la cartera se mueve ${firmado(crecimiento.variacion)}.`
          : brecha <= -5
            ? ` Y el crecimiento las necesita: sin ellas queda ${firmado(crecimiento.variacion)} en vez de ${firmado(crecimiento.variacionCompleta)} — ${pp(brecha)}.`
            : brecha >= 5
              ? ` Pero el crecimiento NO viene de ahí: el resto de la cartera crece ${firmado(crecimiento.variacion)}, ${pp(brecha)} por encima del total.`
              : ` El crecimiento no cuelga de ellas: sacarlas mueve la tasa apenas ${pp(brecha)}.`),
    detalle:
      `${dato.clientes.map((cliente) => `${cliente.nombre} ${fmt(cliente.valor)}`).join(" · ")}. Juntas ${fmt(dato.valorTop5)} de ${fmt(dato.valorAlcance)} en ${alcance.inicio} → ${alcance.fin}.` +
      (crecimiento === null
        ? ""
        : ` Sin ellas: ${fmt(crecimiento.actual)} contra ${fmt(crecimiento.previo)} sobre ${entero(crecimiento.dias)} días equivalentes (${crecimiento.etiqueta}).`),
    robustez:
      `${entero(dato.pedidos)} pedidos en el alcance, ${entero(dato.pedidosTop5)} de esas cinco cuentas.` +
      (crecimiento === null ? "" : ` La tasa sin ellas se calcula sobre ${entero(crecimiento.pedidos)} pedidos contra ${entero(crecimiento.pedidosPrevio)}; quitando además el mayor (${fmt(crecimiento.mayorPedido)}) daría ${firmado(crecimiento.variacionSinMayor)}.`) +
      ` LA CONCENTRACIÓN REAL ES MÁS ALTA QUE ÉSTA: la identidad del cliente se deriva del nombre, así que un mismo cliente escrito de varias formas («MOTOSVENTO GT, AG» y «MOTOSVENTO GT, SOCIEDAD ANONIMA») cuenta como dos cuentas y su venta se parte en dos. Unificar duplicados sólo puede subir el ${pct(dato.participacion)}, nunca bajarlo: este KPI subestima el riesgo.`,
    color: AZUL,
    // Las cinco cuentas, cada una con su peso: el gráfico sostiene el titular
    // (cuánta venta cuelga de cada cabeza) en lugar de repetir la tasa.
    serie: dato.clientes.map((cliente) => ({
      etiqueta: cliente.nombre,
      valor: dato.valorAlcance > 0 ? dos((cliente.valor / dato.valorAlcance) * 100) : 0,
      texto: `${fmt(cliente.valor)} · ${pct(dato.valorAlcance > 0 ? dos((cliente.valor / dato.valorAlcance) * 100) : 0)}`,
    })),
  };
}

/**
 * 2 · Consistencia del crecimiento · los meses cerrados del alcance.
 *
 * Un mes suelto no prueba nada acá: con ~60-90 pedidos mensuales, un pedido
 * grande mueve el mes entero. Doce meses seguidos, cada uno medido contra su
 * equivalente del año anterior, sí describen si el crecimiento es parejo — y si
 * un mes lo decidió un solo pedido, ese mes queda marcado en vez de contar como
 * uno más. El mejor y el peor mes van juntos a propósito: un promedio alto con
 * un rango de 400 puntos no describe ningún mes real.
 */
function subKpiConsistencia(calculo: CalculoVenta<LecturaConsistencia>, alcance: AlcanceVenta, fmt: Formato): SubKpiB18 {
  const etiqueta = `Consistencia del crecimiento · meses cerrados de ${alcance.etiqueta}`;
  if (!calculo.dato) {
    return subKpiSinBase(
      "consistencia",
      etiqueta,
      calculo.motivo,
      "Un mes cortado por el corte o por el inicio del histórico no compite contra un mes entero: esa comparación mide calendario, no negocio.",
      MORADO
    );
  }
  const dato = calculo.dato;
  const base = dato.conComparable;
  const parejo = dato.arriba * 4 >= base * 3;
  const flojo = dato.arriba * 2 <= base;
  const rango = dato.mejor && dato.peor ? dos((dato.mejor.variacion ?? 0) - (dato.peor.variacion ?? 0)) : null;
  return {
    id: "consistencia",
    titulo: `${entero(dato.arriba)} de ${entero(base)} meses arriba`,
    etiqueta,
    veredicto:
      (parejo
        ? `El crecimiento es parejo: ${entero(dato.arriba)} de los ${entero(base)} meses cerrados comparables de ${alcance.etiqueta} superan su mismo mes del año anterior.`
        : flojo
          ? `No hay racha: sólo ${entero(dato.arriba)} de ${entero(base)} meses cerrados superan su mismo mes del año anterior. El crecimiento del período lo ponen unos pocos meses buenos.`
          : `Crecimiento desparejo: ${entero(dato.arriba)} de ${entero(base)} meses superan su mismo mes del año anterior; el resto queda por debajo.`) +
      (dato.mejor && dato.peor
        ? ` Va de ${dato.mejor.etiqueta} (${firmado(dato.mejor.variacion)}) a ${dato.peor.etiqueta} (${firmado(dato.peor.variacion)})${rango === null ? "" : `: ${rango.toFixed(2)} puntos entre el mejor y el peor mes`}.`
        : "") +
      (dato.dominados.length > 0
        ? ` En ${entero(dato.dominados.length)} ${dato.dominados.length === 1 ? "mes" : "meses"} un solo pedido pesó más del 20% (${dato.dominados.map((mes) => `${mes.etiqueta} ${pct(mes.pesoMayorPedido)}`).join(", ")}): ese mes lo decidió un pedido, no la demanda.`
        : " Ningún mes lo decide un solo pedido."),
    detalle:
      dato.meses
        .filter((mes) => mes.variacion !== null)
        .map((mes) => `${mes.etiqueta} ${firmado(mes.variacion)}`)
        .join(" · ") || "Sin meses comparables.",
    robustez:
      `${entero(dato.pedidos)} pedidos en ${entero(dato.meses.length)} meses cerrados del alcance, unos ${entero(Math.round(dato.pedidos / Math.max(dato.meses.length, 1)))} por mes.` +
      (dato.sinComparable.length > 0
        ? ` ${entero(dato.sinComparable.length)} de esos meses (${dato.sinComparable.map((mes) => mes.etiqueta).join(", ")}) no tienen su mismo mes del año anterior cerrado en el histórico y quedan FUERA del marcador: no se los cuenta como perdidos, se los declara sin comparable.`
        : "") +
      (dato.mayorPedido
        ? ` Quitando el pedido más grande del bloque (${fmt(dato.mayorPedido.monto)}, ${dato.mayorPedido.etiqueta}) el marcador ${dato.arribaSinMayor === dato.arriba ? "no se mueve" : `pasa a ${entero(dato.arribaSinMayor)} de ${entero(base)}`}.`
        : ""),
    color: MORADO,
    // TODOS los meses comparables, no sólo los últimos seis: la tarjeta los
    // dibuja con scroll horizontal (mismo patrón que Estacionalidad) en vez de
    // recortar el historial, así el semáforo mes a mes no pierde ningún mes.
    serie: dato.meses
      .filter((mes) => mes.variacion !== null)
      .map((mes) => ({ etiqueta: mes.etiqueta, valor: mes.variacion ?? 0, texto: firmado(mes.variacion) })),
  };
}

/**
 * 3 · Ritmo · a qué velocidad se mueve el alcance.
 *
 * Cambia de forma con el alcance porque son dos preguntas distintas:
 *
 * TODO EL PERÍODO → TTM, total móvil de doce meses. DELIBERADAMENTE NO ES UNA
 * MEDIA MÓVIL DE 3 MESES: una MA3 sube cuando entra la temporada alta y baja
 * cuando sale, sin que el negocio se haya movido — confunde tendencia con
 * estacionalidad en vez de separarlas. El TTM tiene los mismos doce meses del
 * calendario de los dos lados, así que la estacionalidad se cancela sola.
 *
 * UN AÑO → ese año contra el anterior sobre días equivalentes. Nunca el año
 * entero contra un año que se observó a medias: la ventana viene recortada a la
 * intersección de los dos calendarios, y el recorte se declara.
 */
function subKpiRitmo(calculo: CalculoVenta<LecturaRitmo>, alcance: AlcanceVenta, fmt: Formato): SubKpiB18 {
  const etiqueta = alcance.anio === null ? "Ritmo · total móvil de 12 meses (TTM)" : `Ritmo · ${alcance.anio} contra ${Number(alcance.anio) - 1} en días equivalentes`;
  if (!calculo.dato) {
    return subKpiSinBase(
      "ritmo",
      etiqueta,
      calculo.motivo,
      alcance.anio === null
        ? "Se usa TTM y no media móvil de 3 meses a propósito: una MA3 confunde tendencia con estacionalidad, y el TTM la cancela por construcción."
        : "Un año sólo se compara contra el anterior sobre los días que los dos observaron. Sin esos días no hay tasa: hay motivo.",
      VERDE
    );
  }
  if (calculo.dato.tipo === "ttm") {
    const dato = calculo.dato.ttm;
    const golpe = dos(dato.variacionSinMayor - dato.variacion);
    return {
      id: "ritmo",
      titulo: `${firmado(dato.variacion)} TTM`,
      etiqueta,
      veredicto: `Doce meses cerrados contra los doce anteriores: ${firmado(dato.variacion)}. Los dos bloques contienen los mismos doce meses del calendario, así que nada de ese movimiento es estacionalidad — es nivel de negocio. Es el ritmo al que corre la empresa hoy, no el acumulado del año.`,
      detalle: `${fmt(dato.actual)} (${dato.etiqueta}) contra ${fmt(dato.previo)} (${dato.etiquetaPrevio}). No es media móvil de 3 meses: una MA3 sube al entrar la temporada alta aunque el negocio no crezca.`,
      robustez: `${entero(dato.pedidos)} pedidos en los doce meses contra ${entero(dato.pedidosPrevio)} del bloque anterior. Quitando el pedido más grande (${fmt(dato.mayorPedido)}) el TTM sería ${firmado(dato.variacionSinMayor)}: ${pp(golpe)}. Doce meses de base son la razón de que un solo pedido lo mueva tan poco.`,
      color: VERDE,
      serie: [
        { etiqueta: dato.etiquetaPrevio, valor: dato.previo, texto: fmt(dato.previo) },
        { etiqueta: dato.etiqueta, valor: dato.actual, texto: fmt(dato.actual) },
      ],
    };
  }
  const dato = calculo.dato.anual;
  const previo = String(Number(calculo.dato.anio) - 1);
  const golpe = dos(dato.variacionSinMayor - dato.variacion);
  return {
    id: "ritmo",
    titulo: `${firmado(dato.variacion)} en ${calculo.dato.anio}`,
    etiqueta,
    veredicto:
      `${calculo.dato.anio} se mueve ${firmado(dato.variacion)} contra ${previo} sobre los ${entero(dato.ventana.dias)} días que los dos años observaron.` +
      (dato.ventana.razonRecorte
        ? ` OJO CON LA VENTANA: ${dato.ventana.razonRecorte} Esta tasa NO es el año entero contra el año entero, y compararla contra la de un año completo mide dos porciones distintas del calendario.`
        : " Los dos lados son años calendario completos: la comparación no arrastra recorte de ningún tipo."),
    detalle: `${fmt(dato.actual)} contra ${fmt(dato.previo)} · ${dato.ventana.etiqueta} · ${entero(dato.ventana.dias)} días por lado.`,
    robustez: `${entero(dato.pedidos)} pedidos contra ${entero(dato.pedidosPrevio)} del año anterior en la misma ventana. Quitando el pedido más grande (${fmt(dato.mayorPedido)}) la tasa sería ${firmado(dato.variacionSinMayor)}: ${pp(golpe)}.`,
    color: VERDE,
    serie: [
      { etiqueta: `${previo} · ${dato.ventana.dias} días`, valor: dato.previo, texto: fmt(dato.previo) },
      { etiqueta: `${calculo.dato.anio} · ${dato.ventana.dias} días`, valor: dato.actual, texto: fmt(dato.actual) },
    ],
  };
}

/**
 * 4 · Calidad del alcance contra la historia de la empresa.
 *
 * Un +40% no dice nada solo: puede ser el mejor año de la empresa o el peor de
 * los últimos cuatro. Acá cada año se mide contra el anterior sobre SU propia
 * ventana equivalente y recién esas tasas se ordenan.
 *
 * DOS COSAS QUE NO SE ESCONDEN. Primera: los años sin ventana comparable
 * (2022, que no tiene 2021 en el histórico) quedan FUERA del ranking con su
 * motivo, no en el último puesto — mandarlos al fondo afirmaría que crecieron
 * poco, y lo que pasa es que no se sabe. Segunda: las tasas que sí entran no
 * cubren todas la misma porción del calendario, y eso se declara año por año:
 * una tasa medida sobre 146 días de temporada alta no es directamente
 * equiparable a una medida sobre los 365.
 */
function subKpiCalidad(calculo: CalculoVenta<LecturaCalidad>, alcance: AlcanceVenta, fmt: Formato): SubKpiB18 {
  const etiqueta = `Calidad de ${alcance.etiqueta} contra la historia de la empresa`;
  if (!calculo.dato) {
    return subKpiSinBase(
      "calidad",
      etiqueta,
      calculo.motivo,
      "Ubicar un año en la historia exige que los demás años tengan tasa comparable. Sin ninguna, no hay historia contra la cual medir.",
      NARANJA
    );
  }
  const dato = calculo.dato;
  const total = dato.ranking.length;
  const lider = dato.ranking[0];
  const ultimo = dato.ranking[total - 1];
  const elegido = dato.elegido;
  const contraMediana = elegido && dato.mediana !== null ? dos(elegido.tasa - dato.mediana) : null;
  const notaExcluidos =
    dato.excluidos.length === 0
      ? "Todos los años del histórico entran en el ranking."
      : `Fuera del ranking, ${entero(dato.excluidos.length)} ${dato.excluidos.length === 1 ? "año" : "años"}: ${dato.excluidos.map((fila) => `${fila.anio} — ${fila.motivo}`).join(" ")}`;
  const notaRecorte =
    dato.recortados.length === 0
      ? "Las cuatro tasas cubren años calendario completos."
      : `${dato.recortados.map((fila) => `${fila.anio} se mide sobre ${entero(fila.dias)} días (${fila.ventana})`).join(" y ")}: esas tasas son válidas —cada lado tiene los mismos días— pero no cubren la misma porción del calendario que las de año entero, así que el puesto se lee con ese margen.`;
  return {
    id: "calidad",
    // El titular nombra al alcance elegido, no a otro año: cuando el alcance
    // quedó fuera del ranking, lo que hay que leer primero es justamente que
    // quedó fuera, no quién lo encabeza.
    titulo:
      elegido && dato.posicion !== null
        ? `${ordinal(dato.posicion)} mejor de ${entero(total)} años`
        : alcance.anio !== null
          ? `${alcance.anio} fuera del ranking`
          : `${lider.anio} lidera ${entero(total)} años`,
    etiqueta,
    veredicto:
      elegido && dato.posicion !== null
        ? `${elegido.anio} crece ${firmado(elegido.tasa)} y queda ${ordinal(dato.posicion)} entre los ${entero(total)} años comparables del histórico.` +
          (dato.posicion === 1
            ? ` Es el mejor año de la empresa medido así; el siguiente es ${dato.ranking[1] ? `${dato.ranking[1].anio} con ${firmado(dato.ranking[1].tasa)}` : "—"}.`
            : dato.posicion === total
              ? ` Es el más flojo de los comparables: ${lider.anio} llegó a ${firmado(lider.tasa)}.`
              : ` Arriba queda ${lider.anio} (${firmado(lider.tasa)}) y abajo ${ultimo.anio} (${firmado(ultimo.tasa)}).`) +
          (contraMediana === null ? "" : ` Contra la mediana del histórico (${firmado(dato.mediana)}): ${pp(contraMediana)}.`)
        : `${dato.motivoElegido ?? ""} El ranking lo encabeza ${lider.anio} con ${firmado(lider.tasa)} y lo cierra ${ultimo.anio} con ${firmado(ultimo.tasa)}; la mediana de los ${entero(total)} años comparables es ${firmado(dato.mediana)}.`,
    detalle: dato.ranking
      .map((fila, indice) => `${ordinal(indice + 1)} ${fila.anio} ${firmado(fila.tasa)} (${fmt(fila.valor)} vs ${fmt(fila.previo)} · ${entero(fila.ventana.dias)} días)`)
      .join(" · "),
    robustez: `${notaExcluidos} ${notaRecorte}`,
    color: NARANJA,
    serie: dato.ranking.map((fila) => ({ etiqueta: fila.anio, valor: fila.tasa, texto: firmado(fila.tasa) })),
  };
}

/**
 * Un alcance listo para la UI: el botón del filtro, lo que hay que declarar al
 * elegirlo, y sus cuatro sub-lecturas ya calculadas.
 *
 * Los seis alcances se calculan de una sola vez en vez de recalcularse al
 * pulsar: son ~3.200 pedidos, el costo es despreciable, y a cambio el filtro no
 * puede quedar mostrando cuatro tarjetas de un alcance y un rótulo de otro
 * mientras algo se recalcula.
 */
export type AlcanceVentasB18 = {
  id: string;
  etiqueta: string;
  /** Rótulo corto del botón, debajo del nombre: los días observados. */
  resumen: string;
  parcial: boolean;
  /** Por qué el alcance es parcial. null cuando se observa entero. */
  aviso: string | null;
  /** Contra qué se está comparando, o por qué no hay contra qué. Siempre presente. */
  comparacion: string;
  /** true cuando el alcance NO tiene ventana equivalente: no hay tasa posible. */
  sinComparacion: boolean;
  /** true cuando la ventana comparable tuvo que recortar días para igualar los lados. */
  comparacionRecortada: boolean;
  subKpis: SubKpiB18[];
};

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
  //
  // Evolución es el único agente con sub-lecturas, y no por privilegio: es el
  // que publica el número del que cuelga toda la página. Un solo porcentaje de
  // crecimiento admite cuatro lecturas equivocadas —concentración, mes suelto,
  // ritmo y "qué tan bueno fue este año"— y cada sub-KPI cierra una de ellas.
  //
  // `leerEvolucionDetallada` se sigue llamando por UNA razón concreta: ahí vive
  // el TTM, que se calcula sobre los meses cerrados de la serie completa. El
  // ritmo de "Todo el período" lo consume tal cual en vez de recalcularlo por
  // alcance, para que la regla de "qué mes se ve entero" siga escrita en un
  // solo lugar. Una regla escrita dos veces es una regla que va a diferir.
  const evolucion = leerEvolucionDetallada(dataset, serie);
  const alcancesCrudos = construirAlcancesVenta(serie);
  const alcances: AlcanceVentasB18[] = alcancesCrudos.map((alcance) => {
    const lectura = leerEvolucionPorAlcance(dataset, serie, alcance, alcancesCrudos, evolucion.ttm);
    const ventana = alcance.comparable.dato;
    return {
      id: alcance.id,
      etiqueta: alcance.etiqueta,
      resumen: `${entero(alcance.dias)} días observados · ${alcance.inicio} → ${alcance.fin}`,
      parcial: alcance.parcial,
      aviso: alcance.razonParcial,
      // Nunca se deja implícito contra qué se compara: la regla entera de esta
      // página es que se enfrentan días equivalentes, y el filtro es justo el
      // lugar donde alguien podría suponer que "2023" se compara contra "2022"
      // completo cuando de 2022 sólo hay 146 días.
      comparacion: ventana
        ? ventana.razonRecorte
          ? `Se compara ${ventana.etiqueta} · ${entero(ventana.dias)} días por lado. ${ventana.razonRecorte}`
          : `Se compara ${ventana.etiqueta} · ${entero(ventana.dias)} días por lado, años calendario completos de los dos lados.`
        : alcance.comparable.motivo,
      sinComparacion: ventana === null,
      comparacionRecortada: ventana?.recortada ?? false,
      subKpis: [
        subKpiDependencia(lectura.dependencia, alcance, fmt),
        subKpiConsistencia(lectura.consistencia, alcance, fmt),
        subKpiRitmo(lectura.ritmo, alcance, fmt),
        subKpiCalidad(lectura.calidad, alcance, fmt),
      ],
    };
  });
  // El agente sigue publicando UN juego de sub-lecturas —las de "Todo el
  // período"— para que nada de lo que ya consumía `subKpis` dependa del filtro.
  // `undefined` y no un arreglo vacío cuando no hay ventas confirmadas: el
  // anillo distingue "este agente no descompone su KPI" (y muestra a los cuatro
  // agentes) de "lo descompone en cero tarjetas", que dejaría el mapa vacío.
  const subKpisVenta: SubKpiB18[] | undefined = alcances[0]?.subKpis;

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
    subKpis: subKpisVenta,
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
    alcances,
    estacionalidad: leerEstacionalidadVenta(serie),
  };
}
