import {
  analiticaInventario,
  type FilaInventarioComercial,
} from "@/lib/commercial-operacion";
import {
  repartir,
  pctB18,
  type CategoriaB18,
  type ContratoB18,
  type FilaB18,
} from "@/lib/contrato-b18";
import type { Dataset } from "@/lib/types";

/**
 * INVENTARIO — cuatro categorías sobre el molde B18.
 *
 * Todo lo que se muestra acá sale de analiticaInventario(dataset), que ya
 * existía y ya estaba probada. Este archivo no calcula inventario de nuevo:
 * traduce esa lectura al contrato del molde.
 *
 * "Salida" es un movimiento de almacén: puede ser una entrega, una venta u
 * otro motivo. Esta lectura no supone que toda salida fue una venta — ese
 * matiz se repite en el pie de metadatos de cada categoría (campo "Límite").
 *
 * COBERTURA no significa lo mismo en las cuatro categorías:
 *   - Movimiento: % de movimientos de salida con costo unitario conocido.
 *   - Rotación: % de productos con movimiento que además tiene salida
 *     valorizada y por lo tanto clasificación ABC.
 *   - Riesgo de quiebre: 0 si existencia o mínimo no son afirmables; si
 *     ambos lo son, % del catálogo con movimiento registrado en la ventana.
 *   - Baja rotación: % de productos con movimiento que no registra ninguna
 *     salida en la ventana observada.
 *
 * Cuando existenciaAfirmable o minimoAfirmable son false, o valorExistencia /
 * productosBajoMinimo son null, esta lectura lo declara explícitamente en
 * vez de tratarlo como cero.
 */

const LIMITE_SALIDA =
  '"Salida" es un movimiento de almacén: puede ser una entrega, una venta u otro motivo; esta lectura no supone que toda salida fue una venta.';

const num = (valor: number) => Math.round(valor).toLocaleString("es-GT");
const seguro = (valor: number) => (Number.isFinite(valor) ? valor : 0);
const clamp = (valor: number) => Math.min(Math.max(seguro(valor), 0), 100);

function fuenteDe(dataset: Dataset): string {
  return dataset.fuente === "odoo-real" ? "Odoo → Supabase (snapshot)" : "Demo ficticio";
}

function categoriaSinDatos(
  id: string,
  sigla: string,
  nombre: string,
  pregunta: string,
  fuenteTexto: string
): CategoriaB18 {
  return {
    id,
    sigla,
    nombre,
    senal: "Sin catálogo o movimientos suficientes",
    pregunta,
    filas: [{ nombre: "Sin datos suficientes", pct: 0 }],
    cobertura: 0,
    coberturaEtiqueta: "sin catálogo o movimientos suficientes para leer esta categoría",
    metricas: [
      { valor: "Sin dato", etiqueta: "—" },
      { valor: "Sin dato", etiqueta: "—" },
      { valor: "Sin dato", etiqueta: "—" },
    ],
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: 0,
        kpiTexto: "Sin dato", etiqueta: "Sin datos suficientes",
        resumen: "Este dataset no trae catálogo y movimientos suficientes para analizar inventario.",
        problema: "No hay catálogo de productos y/o movimientos de inventario en este dataset.",
        accion: "Cargar catálogo de productos y movimientos de inventario para habilitar esta lectura.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: "Sin dato", etiqueta: "Sin datos suficientes",
        resumen: "Sin productos ni movimientos, no hay reparto que mostrar.",
        problema: "No hay productos ni movimientos que explicar en esta ventana.",
        accion: "Verificar que el dataset incluya productos y movimientosInventario.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: "Sin dato", etiqueta: "Sin datos suficientes",
        resumen: "Sin datos no hay ranking que priorizar.",
        problema: "No hay señal suficiente para ordenar ningún ranking.",
        accion: "Confirmar el origen del dataset antes de intentar priorizar inventario.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: 0,
        kpiTexto: "Sin dato", etiqueta: "Sin datos suficientes",
        resumen: "No hay cobertura que declarar.",
        problema: "No hay datos con los que calcular una recomendación honesta.",
        accion: "No decidir sobre inventario con este dataset hasta cargar catálogo y movimientos.",
      },
    ],
    problema: "No hay catálogo de productos y/o movimientos de inventario suficientes en este dataset.",
    metadatos: [
      { termino: "Fuente", valor: fuenteTexto },
      { termino: "Capa", valor: "No aplica — sin datos suficientes" },
      { termino: "Corte", valor: "Sin ventana de movimientos" },
      { termino: "Moneda", valor: "No aplica" },
      { termino: "Cobertura", valor: "0.00%" },
      { termino: "Límite", valor: `Sin catálogo/movimientos no hay lectura. ${LIMITE_SALIDA}` },
    ],
  };
}

export function construirInventarioB18(
  dataset: Dataset,
  fmt: (monto: number) => string
): ContratoB18 {
  const analitica = analiticaInventario(dataset);
  const fuenteTexto = fuenteDe(dataset);

  if (!analitica.disponible) {
    return {
      eyebrow: "INVENTARIO · LECTURA OPERATIVA",
      titulo: "Inventario",
      rotuloRiel: "Categorías",
      corte: "Sin ventana de movimientos",
      categorias: [
        categoriaSinDatos("movimiento", "MO", "Movimiento", "¿Qué valor salió del almacén?", fuenteTexto),
        categoriaSinDatos("rotacion", "RO", "Rotación", "¿Qué tan concentrada está la salida entre productos?", fuenteTexto),
        categoriaSinDatos("riesgo", "RQ", "Riesgo de quiebre", "¿Hay riesgo de quedarse sin existencia?", fuenteTexto),
        categoriaSinDatos("baja-rotacion", "BR", "Baja rotación", "¿Qué entró y nunca salió?", fuenteTexto),
      ],
      resumen: {
        subtitulo: "Sin catálogo o movimientos suficientes",
        kpis: [
          { etiqueta: "Valor de salidas", valor: "Sin dato", nota: "sin datos suficientes" },
          { etiqueta: "Productos con salida valorizada", valor: "Sin dato", nota: "sin datos suficientes" },
          { etiqueta: "Existencia estimada", valor: "Sin dato", nota: "sin datos suficientes" },
          { etiqueta: "Entradas sin salida", valor: "Sin dato", nota: "sin datos suficientes" },
        ],
        tituloMix: "Salidas por producto",
        preguntaMix: "¿Qué mueve más valor?",
        tituloCobertura: "Calidad de la lectura",
        preguntaCobertura: "¿Cuánto respalda cada categoría?",
        notaCobertura: "Este dataset no trae catálogo y movimientos de inventario suficientes: las cuatro categorías quedan sin cobertura.",
        pie: `Este dataset no trae catálogo y movimientos suficientes para analizar inventario. ${LIMITE_SALIDA}`,
      },
    };
  }

  const corte = analitica.desde && analitica.hasta
    ? `${analitica.desde} → ${analitica.hasta}`
    : "sin ventana de movimientos";

  const filaToB18 = (fila: FilaInventarioComercial): FilaB18 => ({
    nombre: fila.etiqueta,
    pct: clamp(fila.pct),
    valorTexto: fmt(fila.valor),
  });

  // ── MO · Movimiento ──────────────────────────────────────────────────────
  // Cobertura = de los movimientos de salida, cuántos tienen costo unitario
  // conocido. Sin costo, el valor de salidas subestima lo que realmente salió.
  const filasMovimiento = analitica.topSalidas.length > 0
    ? analitica.topSalidas.slice(0, 5).map(filaToB18)
    : [{ nombre: "Sin salidas valorizadas en la ventana", pct: 0 }];
  const liderMovimiento = filasMovimiento[0];
  const coberturaMovimiento = analitica.movimientosSalida > 0
    ? clamp(((analitica.movimientosSalida - analitica.movimientosSalidaSinCosto) / analitica.movimientosSalida) * 100)
    : 0;

  const movimiento: CategoriaB18 = {
    id: "movimiento",
    sigla: "MO",
    nombre: "Movimiento",
    senal: analitica.movimientosSalida > 0
      ? `${num(analitica.movimientosSalida)} movimientos de salida, ${pctB18(coberturaMovimiento)} con costo conocido`
      : "Sin movimientos de salida en la ventana",
    pregunta: "¿Qué valor salió del almacén y con qué respaldo de costo?",
    filas: filasMovimiento,
    cobertura: coberturaMovimiento,
    coberturaEtiqueta: "de los movimientos de salida tiene costo unitario conocido",
    metricas: [
      { valor: fmt(analitica.valorSalidas), etiqueta: "valor de salidas" },
      { valor: num(analitica.unidadesSalida), etiqueta: "unidades de salida" },
      { valor: num(analitica.productosConSalidaValorizada), etiqueta: "productos con salida valorizada" },
    ],
    problema: analitica.movimientosSalidaSinCosto > 0
      ? `${num(analitica.movimientosSalidaSinCosto)} movimientos de salida (${num(analitica.unidadesSalidaSinCosto)} unidades) no tienen costo unitario: el valor de salidas los excluye o los subestima.`
      : "Todos los movimientos de salida registrados tienen costo unitario.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(liderMovimiento?.pct ?? 0),
        kpiTexto: fmt(analitica.valorSalidas), etiqueta: "valor total de salidas",
        resumen: `${liderMovimiento?.nombre ?? "Sin señal"} lidera con ${liderMovimiento?.valorTexto ?? "sin dato"}.`,
        problema: `${liderMovimiento?.nombre ?? "Un producto"} concentra ${pctB18(liderMovimiento?.pct ?? 0)} del valor de salidas mostrado en el ranking.`,
        accion: "Confirmar el producto líder contra el detalle de movimientos antes de reponer.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: num(analitica.unidadesSalida), etiqueta: "unidades de salida",
        resumen: `Registradas en ${num(analitica.productosConMovimiento)} productos con movimiento.`,
        problema: `${num(analitica.salidasSinVenta)} salidas no están vinculadas a una venta: no toda salida es una venta.`,
        accion: "Revisar el motivo de las salidas sin venta antes de leerlas como ingreso.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(analitica.productosConSalidaValorizada), etiqueta: "productos con salida valorizada",
        resumen: `Sobre ${num(analitica.productos)} productos del catálogo.`,
        problema: `${num(analitica.productosConCostoCero)} productos del catálogo tienen costo unitario cero: su salida no puede valorizarse.`,
        accion: "Completar el costo unitario en el catálogo antes de confiar en el valor total de salidas.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaMovimiento,
        kpiTexto: pctB18(coberturaMovimiento), etiqueta: "movimientos con costo conocido",
        resumen: analitica.movimientosSalidaSinCosto > 0
          ? `${num(analitica.movimientosSalidaSinCosto)} movimientos de salida sin costo unitario.`
          : "Sin movimientos de salida pendientes de costo.",
        problema: analitica.movimientosSalidaSinCosto > 0
          ? "El valor de salidas está subestimado mientras existan movimientos sin costo unitario."
          : "El valor de salidas no tiene movimientos sin costo pendientes.",
        accion: "Priorizar la carga de costo unitario en los productos con movimientos sin costo.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · movimientos de inventario y catálogo de productos` },
      { termino: "Capa", valor: "Salida de almacén valorizada a costo unitario, no venta confirmada" },
      { termino: "Corte", valor: corte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaMovimiento) },
      { termino: "Límite", valor: LIMITE_SALIDA },
    ],
  };

  // ── RO · Rotación ────────────────────────────────────────────────────────
  // Clasificación ABC por valor acumulado de salida (regla fija: A hasta 80%
  // del valor, B hasta 95%, C el resto — así la calcula analiticaInventario).
  // Cobertura = de los productos con movimiento, cuántos entraron a esa
  // clasificación (tienen salida valorizada).
  const filasRotacion = repartir([
    { nombre: "Clase A", valor: analitica.distribucionAbc.A, valorTexto: `${num(analitica.distribucionAbc.A)} productos` },
    { nombre: "Clase B", valor: analitica.distribucionAbc.B, valorTexto: `${num(analitica.distribucionAbc.B)} productos` },
    { nombre: "Clase C", valor: analitica.distribucionAbc.C, valorTexto: `${num(analitica.distribucionAbc.C)} productos` },
  ]);
  const liderRotacion = filasRotacion[0];
  const coberturaRotacion = analitica.productosConMovimiento > 0
    ? clamp((analitica.productosConSalidaValorizada / analitica.productosConMovimiento) * 100)
    : 0;

  const rotacion: CategoriaB18 = {
    id: "rotacion",
    sigla: "RO",
    nombre: "Rotación",
    senal: `${liderRotacion?.nombre ?? "Sin clase"} agrupa ${pctB18(liderRotacion?.pct ?? 0)} de los productos con salida valorizada`,
    pregunta: "¿Qué tan concentrada está la salida entre pocos productos?",
    filas: filasRotacion,
    forma: "apilada",
    cobertura: coberturaRotacion,
    coberturaEtiqueta: "de los productos con movimiento tiene salida valorizada y clasificación ABC",
    metricas: [
      { valor: num(analitica.distribucionAbc.A), etiqueta: "productos Clase A" },
      { valor: num(analitica.distribucionAbc.B), etiqueta: "productos Clase B" },
      { valor: num(analitica.distribucionAbc.C), etiqueta: "productos Clase C" },
    ],
    problema: `La clasificación ABC sólo cubre ${num(analitica.productosConSalidaValorizada)} de ${num(analitica.productosConMovimiento)} productos con movimiento: el resto no tiene salida valorizada.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(liderRotacion?.pct ?? 0),
        kpiTexto: pctB18(liderRotacion?.pct ?? 0), etiqueta: `productos en ${liderRotacion?.nombre ?? "clase líder"}`,
        resumen: `${liderRotacion?.valorTexto ?? "sin dato"} sobre ${num(analitica.productosConSalidaValorizada)} con salida valorizada.`,
        problema: `${liderRotacion?.nombre ?? "Una clase"} agrupa ${pctB18(liderRotacion?.pct ?? 0)} de los productos con salida valorizada.`,
        accion: "Priorizar reposición y seguimiento sobre los productos Clase A antes que sobre el resto.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18((filasRotacion[0]?.pct ?? 0) + (filasRotacion[1]?.pct ?? 0)), etiqueta: "Top 2 clases por cantidad de productos",
        resumen: "Clase A reúne, por definición, el 80% inicial del valor acumulado de salidas; Clase B llega hasta 95%; Clase C es el resto.",
        problema: "La cantidad de productos por clase no es su peso en valor: pocos productos Clase A pueden mover la mayoría del valor de salidas.",
        accion: "Leer la clase junto al valor de salidas de cada producto, no sólo el conteo de productos.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(analitica.topSalidas.length), etiqueta: "productos en el ranking de mayor salida",
        resumen: analitica.topSalidas[0] ? `${analitica.topSalidas[0].etiqueta} encabeza el ranking.` : "Sin productos con salida valorizada.",
        problema: "El ranking muestra hasta 10 productos; el resto de cada clase no queda listado individualmente aquí.",
        accion: "Abrir el detalle de movimientos para revisar el ranking completo antes de decidir sobre productos fuera del Top 10.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaRotacion,
        kpiTexto: pctB18(coberturaRotacion), etiqueta: "productos con movimiento y clasificación ABC",
        resumen: `${num(Math.max(analitica.productosConMovimiento - analitica.productosConSalidaValorizada, 0))} productos con movimiento no tienen salida valorizada y quedan fuera de la clasificación.`,
        problema: coberturaRotacion < 100
          ? "No todos los productos con movimiento entran a la clasificación ABC: algunos no registran salida valorizada."
          : "Todos los productos con movimiento entran a la clasificación ABC.",
        accion: "Revisar por separado los productos con movimiento sin salida valorizada; no tienen clase ABC asignada.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · movimientos de salida valorizados a costo unitario` },
      { termino: "Capa", valor: "Clasificación ABC por valor acumulado de salida, no por unidades" },
      { termino: "Corte", valor: corte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaRotacion) },
      { termino: "Límite", valor: LIMITE_SALIDA },
    ],
  };

  // ── RQ · Riesgo de quiebre ───────────────────────────────────────────────
  // existenciaAfirmable es global: si algún producto tuvo su primer
  // movimiento como salida (sin entrada previa que fije el punto de
  // partida), la existencia de TODO el dataset deja de ser afirmable y no se
  // inventa. minimoAfirmable exige que al menos un producto tenga mínimo
  // definido. productosBajoMinimo puede ser null: se declara, no se trata
  // como cero. topExistencia sólo lista los de MAYOR existencia (por valor),
  // no un ranking de menor existencia — no existe esa lista en esta función.
  const filasRiesgo = analitica.existenciaAfirmable && analitica.topExistencia.length > 0
    ? analitica.topExistencia.slice(0, 5).map(filaToB18)
    : [{
        nombre: analitica.existenciaAfirmable ? "Sin existencia positiva registrada" : "Existencia no afirmable en esta ventana",
        pct: 0,
      }];
  const coberturaRiesgo = analitica.existenciaAfirmable && analitica.minimoAfirmable
    ? clamp((analitica.productosConMovimiento / Math.max(analitica.productos, 1)) * 100)
    : 0;

  const riesgo: CategoriaB18 = {
    id: "riesgo",
    sigla: "RQ",
    nombre: "Riesgo de quiebre",
    senal: !analitica.existenciaAfirmable
      ? "Existencia no afirmable en esta ventana"
      : !analitica.minimoAfirmable
        ? "Existencia afirmable, sin stock mínimo definido en catálogo"
        : `${num(analitica.productosBajoMinimo ?? 0)} productos en o bajo el mínimo`,
    pregunta: "¿Es afirmable la existencia y hay riesgo de quedarse sin producto?",
    filas: filasRiesgo,
    cobertura: coberturaRiesgo,
    coberturaEtiqueta: !analitica.existenciaAfirmable
      ? "existencia no afirmable — no hay cobertura posible"
      : !analitica.minimoAfirmable
        ? "sin stock mínimo definido — no hay cobertura posible"
        : "del catálogo tiene movimiento registrado para leer existencia y mínimo",
    metricas: [
      {
        valor: analitica.existenciaAfirmable && analitica.valorExistencia !== null ? fmt(analitica.valorExistencia) : "No afirmable",
        etiqueta: "valor de existencia estimado",
      },
      {
        valor: analitica.minimoAfirmable && analitica.productosBajoMinimo !== null ? num(analitica.productosBajoMinimo) : "No afirmable",
        etiqueta: "productos en o bajo el mínimo",
      },
      { valor: num(analitica.productosConMovimiento), etiqueta: "productos con movimiento registrado" },
    ],
    problema: !analitica.existenciaAfirmable
      ? `La existencia no es afirmable: ${num(analitica.seriesTruncadas)} producto(s) tienen su primer movimiento registrado como salida, sin entrada previa que fije el punto de partida.`
      : !analitica.minimoAfirmable
        ? "Ningún producto del catálogo tiene definido un stock mínimo mayor a cero: no se puede calcular riesgo de quiebre."
        : `${num(analitica.productosBajoMinimo ?? 0)} productos están en o por debajo de su stock mínimo; esta lectura no identifica cuáles, sólo el conteo.`,
    tarjetas: [
      {
        id: "detecta", grafica: analitica.existenciaAfirmable ? "dona" : "cobertura", donaPct: clamp(filasRiesgo[0]?.pct ?? 0),
        kpiTexto: analitica.existenciaAfirmable && analitica.valorExistencia !== null ? fmt(analitica.valorExistencia) : "No afirmable",
        etiqueta: "valor de existencia estimado",
        resumen: analitica.existenciaAfirmable ? `${filasRiesgo[0]?.nombre ?? "Sin señal"} es el de mayor existencia estimada.` : "No hay punto de partida confiable para estimar existencia.",
        problema: analitica.existenciaAfirmable
          ? "El ranking muestra los productos de MAYOR existencia estimada; esta función no expone un ranking de menor existencia."
          : `${num(analitica.seriesTruncadas)} producto(s) impiden afirmar existencia: su primer movimiento registrado fue una salida.`,
        accion: analitica.existenciaAfirmable
          ? "Cruzar contra el detalle de movimientos para ubicar los productos de menor existencia; este ranking no los lista."
          : "Revisar el histórico completo de movimientos de esos productos antes de afirmar cualquier existencia.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: analitica.minimoAfirmable ? "Definido" : "No definido", etiqueta: "stock mínimo en catálogo",
        resumen: analitica.minimoAfirmable ? "Al menos un producto del catálogo tiene stock mínimo definido." : "Ningún producto del catálogo tiene stock mínimo mayor a cero.",
        problema: analitica.minimoAfirmable ? "El stock mínimo sólo se compara contra la existencia cuando ambos son afirmables." : "Sin stock mínimo definido no hay umbral contra el cual comparar la existencia.",
        accion: "Completar el stock mínimo por producto en el catálogo para habilitar el conteo de riesgo de quiebre.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: analitica.minimoAfirmable && analitica.productosBajoMinimo !== null ? num(analitica.productosBajoMinimo) : "Sin dato",
        etiqueta: "productos en o bajo el mínimo",
        resumen: `Sobre ${num(analitica.productos)} productos del catálogo.`,
        problema: analitica.minimoAfirmable && analitica.productosBajoMinimo !== null
          ? `${num(analitica.productosBajoMinimo)} productos están en o bajo su mínimo; esta lectura no identifica cuáles.`
          : "No hay un conteo afirmable de productos bajo el mínimo con este dataset.",
        accion: "Obtener el listado producto por producto de existencia contra mínimo antes de generar una orden de reposición.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaRiesgo,
        kpiTexto: pctB18(coberturaRiesgo), etiqueta: "catálogo con lectura afirmable",
        resumen: !analitica.existenciaAfirmable
          ? "La lectura de riesgo de quiebre no es afirmable en esta ventana."
          : !analitica.minimoAfirmable
            ? "Existencia afirmable, pero sin mínimo definido en el catálogo."
            : `${num(Math.max(analitica.productos - analitica.productosConMovimiento, 0))} productos del catálogo no registran movimiento en la ventana.`,
        problema: coberturaRiesgo === 0
          ? "Esta categoría no tiene lectura afirmable con los datos disponibles."
          : "Los productos sin movimiento en la ventana no entran a esta lectura de riesgo.",
        accion: coberturaRiesgo === 0
          ? "Cargar movimientos con entrada inicial y stock mínimo por producto antes de fiarse de esta categoría."
          : "Ampliar la ventana de movimientos para cubrir más del catálogo.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · movimientos de inventario y stock mínimo del catálogo` },
      { termino: "Capa", valor: "Existencia estimada por variación neta de movimientos, no conteo físico" },
      { termino: "Corte", valor: corte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaRiesgo) },
      { termino: "Límite", valor: `Existencia y mínimo sólo son afirmables cuando el dataset lo permite; sin eso no se inventa un cero. ${LIMITE_SALIDA}` },
    ],
  };

  // ── BR · Baja rotación ───────────────────────────────────────────────────
  // Cobertura = de los productos con movimiento, cuántos entraron y nunca
  // registraron salida en la ventana observada.
  const filasBaja = analitica.entradasSinSalida.length > 0
    ? analitica.entradasSinSalida.slice(0, 5).map(filaToB18)
    : [{ nombre: "Sin candidatos de baja rotación en la ventana", pct: 0 }];
  const liderBaja = filasBaja[0];
  const coberturaBaja = analitica.productosConMovimiento > 0
    ? clamp((analitica.candidatosSinSalida / analitica.productosConMovimiento) * 100)
    : 0;

  const bajaRotacion: CategoriaB18 = {
    id: "baja-rotacion",
    sigla: "BR",
    nombre: "Baja rotación",
    senal: `${num(analitica.candidatosSinSalida)} productos con entrada y cero salida`,
    pregunta: "¿Qué productos entraron y nunca salieron en la ventana?",
    filas: filasBaja,
    cobertura: coberturaBaja,
    coberturaEtiqueta: "de los productos con movimiento no registra ninguna salida en la ventana",
    metricas: [
      { valor: num(analitica.candidatosSinSalida), etiqueta: "productos con entrada y cero salida" },
      { valor: fmt(analitica.valorEntradasSinSalida), etiqueta: "valor de entradas sin salida" },
      { valor: num(analitica.productosConMovimiento), etiqueta: "productos con movimiento en la ventana" },
    ],
    problema: `${num(analitica.candidatosSinSalida)} productos entraron al almacén y no registran ninguna salida en la ventana observada (${fmt(analitica.valorEntradasSinSalida)}).`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(liderBaja?.pct ?? 0),
        kpiTexto: num(analitica.candidatosSinSalida), etiqueta: "productos sin ninguna salida",
        resumen: `${liderBaja?.nombre ?? "Sin señal"} es el de mayor valor de entrada sin salida.`,
        problema: `${liderBaja?.nombre ?? "Un producto"} concentra ${pctB18(liderBaja?.pct ?? 0)} del valor de entradas sin salida.`,
        accion: "Revisar si el producto líder necesita promoción, reubicación o liquidación.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: fmt(analitica.valorEntradasSinSalida), etiqueta: "valor de entradas sin salida",
        resumen: "Denominador completo: incluye todos los candidatos, no sólo los mostrados en el ranking.",
        problema: "El valor de entradas sin salida queda inmovilizado en almacén mientras no haya salida registrada.",
        accion: "Priorizar la revisión por valor de entrada, no por cantidad de referencias.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: pctB18(coberturaBaja), etiqueta: "de los productos con movimiento no registra salida",
        resumen: `${num(analitica.candidatosSinSalida)} de ${num(analitica.productosConMovimiento)} productos con movimiento.`,
        problema: `${pctB18(coberturaBaja)} de los productos con movimiento en la ventana entraron y nunca salieron.`,
        accion: "Cruzar contra la fecha de entrada: mientras más antigua, mayor la señal de baja rotación.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaBaja,
        kpiTexto: pctB18(coberturaBaja), etiqueta: "cobertura del diagnóstico",
        resumen: "Esta lectura no distingue si la ausencia de salida es por baja demanda o por ventana corta de observación.",
        problema: `La ventana observada va de ${analitica.desde ?? "sin inicio"} a ${analitica.hasta ?? "sin fin"}; un producto reciente puede no haber tenido tiempo de salir.`,
        accion: "Confirmar la fecha de entrada de cada candidato antes de decidir liquidación.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · movimientos de entrada y salida por producto` },
      { termino: "Capa", valor: "Entradas sin salida registrada en la ventana, no obsolescencia confirmada" },
      { termino: "Corte", valor: corte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaBaja) },
      { termino: "Límite", valor: LIMITE_SALIDA },
    ],
  };

  return {
    eyebrow: "INVENTARIO · LECTURA OPERATIVA",
    titulo: "Inventario",
    rotuloRiel: "Categorías",
    corte,
    categorias: [movimiento, rotacion, riesgo, bajaRotacion],
    resumen: {
      subtitulo: "Movimiento, rotación, riesgo de quiebre y baja rotación",
      kpis: [
        { etiqueta: "Valor de salidas", valor: fmt(analitica.valorSalidas), nota: `${pctB18(coberturaMovimiento)} con costo conocido` },
        { etiqueta: "Productos con salida valorizada", valor: num(analitica.productosConSalidaValorizada), nota: `sobre ${num(analitica.productos)} del catálogo` },
        {
          etiqueta: "Existencia estimada",
          valor: analitica.existenciaAfirmable && analitica.valorExistencia !== null ? fmt(analitica.valorExistencia) : "No afirmable",
          nota: analitica.minimoAfirmable && analitica.productosBajoMinimo !== null ? `${num(analitica.productosBajoMinimo)} en o bajo mínimo` : "sin mínimo afirmable",
        },
        { etiqueta: "Entradas sin salida", valor: fmt(analitica.valorEntradasSinSalida), nota: `${num(analitica.candidatosSinSalida)} productos` },
      ],
      tituloMix: "Salidas por producto",
      preguntaMix: "¿Qué mueve más valor en la categoría activa?",
      tituloCobertura: "Calidad de la lectura",
      preguntaCobertura: "¿Cuánto respalda cada categoría?",
      notaCobertura:
        "Cobertura significa algo distinto en cada categoría: costo conocido, clasificación ABC, existencia y mínimo afirmables, o participación de productos con movimiento. Cada una declara la suya en su pie de procedencia. No se comparan entre sí.",
      pie: `Inventario se lee sobre movimientos de almacén, no sobre ventas confirmadas. ${LIMITE_SALIDA} Ninguna fórmula de esta pantalla está aprobada por Finanzas.`,
    },
  };
}
