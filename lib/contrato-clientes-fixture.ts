/**
 * FIXTURE DEL CONTRATO · CLIENTES · B18
 * ==================================================================
 * CONGELADO junto con el contrato. Ni el Agente 1 ni el Agente 2 lo editan.
 *
 * Sirve para dos cosas distintas:
 *
 *  1. AGENTE 2 renderiza contra esto. No necesita el código del Agente 1
 *     ni tocar datos reales. Si el componente se ve bien con este objeto,
 *     se verá bien con el real.
 *
 *  2. AGENTE 1 lo usa como PRUEBA DE ACEPTACIÓN. Las cifras de control
 *     de abajo son las que el coordinador ya verificó contra el snapshot.
 *     Si `construirMapaClientesB18` no las reproduce, algo está mal en
 *     la lectura — no en las cifras.
 *
 * ── NOMBRES ────────────────────────────────────────────────────────
 * Los nombres de cliente acá son SINTÉTICOS a propósito. El snapshot
 * contiene razones sociales reales y este archivo vive en un repositorio.
 * La salida real de `construirMapaClientesB18` sí lleva nombres reales,
 * pero se lee en tiempo de ejecución y nunca se persiste como fixture.
 */

import {
  CAPA_COMPOSICION,
  CAPA_CXC,
  CAPA_VENTA,
  CXC_PENDIENTE_ENLACE,
  CXC_PENDIENTE_MENSAJE,
  FUENTE_CLIENTES,
  LIMITE_SNAPSHOT,
  MONEDA_CLIENTES,
  NO_AFIRMABLE,
  type MapaClientesB18,
  type ProcedenciaClientes,
} from "./contrato-clientes-b18";

/**
 * CIFRAS DE CONTROL — verificadas contra el snapshot al corte 2026-08-19.
 * El Agente 1 debe reproducirlas calculándolas, NUNCA leyéndolas de acá.
 */
export const CONTROL_CLIENTES = {
  corte: "2026-08-19",
  pedidosConfirmados: 3189,
  clientesHistoricos: 363,

  compradoresYtd: 168,
  compradoresYtdComparable: 124,
  compradoresYtdVar: 35.48,

  ventaYtd: 4766666.63,
  ventaYtdComparable: 3823275.81,
  ventaYtdVar: 24.67,

  pedidosYtd: 724,
  pedidosYtdComparable: 653,
  pedidosYtdVar: 10.87,

  /** "primera compra REGISTRADA", nunca "cliente nuevo": no hay alta real. */
  primeraCompraRegistradaYtd: 51,
  recurrentesYtd: 121,

  medianaPedidosHistorico: 3,
  medianaPedidosYtd: 2,
  ticketMedianoPedido: 2496.9,

  top5PctYtd: 28.25,
  top10PctYtd: 41.59,

  recencia: { d0a30: 60, d31a60: 37, d61a90: 23, mas90: 243 },

  cxc: { bruta: 1108597.24, saldoFavor: 173000.25, neta: 935596.99 },
} as const;

const q = (valor: number) =>
  `Q${valor.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const proc = (over: Partial<ProcedenciaClientes> = {}): ProcedenciaClientes => ({
  fuente: FUENTE_CLIENTES,
  periodo: "2022-08-01 → 2026-08-19",
  corte: CONTROL_CLIENTES.corte,
  moneda: MONEDA_CLIENTES,
  cobertura: { valor: 100, etiqueta: "pedidos confirmados del snapshot" },
  limite: LIMITE_SNAPSHOT,
  capa: CAPA_VENTA,
  ...over,
});

let semilla = 7;
const rnd = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);

/**
 * Clientes sintéticos, decrecientes en valor, para poblar listas.
 *
 * `rango` fuerza los días-al-corte dentro de una ventana. Es obligatorio
 * para los tramos de recencia: en v1 los cuatro tramos compartían el mismo
 * generador y el tramo "Más de 90 días" terminó listando clientes de 10 días.
 * Un cliente tiene que pertenecer de verdad al tramo donde aparece — si no,
 * la pantalla enseña a desconfiar de sí misma. Lo cubre `verificar-fixture`.
 */
const filas = (n: number, desde = 0, base = 520000, rango?: [number, number]) =>
  Array.from({ length: n }, (_, i) => {
    const k = desde + i;
    const valor = Math.round(base / (1 + k * 0.55) * (0.85 + rnd() * 0.3) * 100) / 100;
    const pedidos = Math.max(1, Math.round(14 / (1 + k * 0.25)));
    const dias = rango
      ? rango[0] + Math.round(rnd() * (rango[1] - rango[0]))
      : Math.round(3 + k * 4.4 + rnd() * 20);
    const fecha = new Date(Date.UTC(2026, 7, 19) - dias * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      id: `c-${String(k + 1).padStart(3, "0")}`,
      etiqueta: `CLIENTE DEMO ${String(k + 1).padStart(3, "0")}`,
      pedidos,
      valor,
      texto: q(valor),
      ultima: fecha,
      dias,
    };
  });

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const serie = () => {
  const puntos = [];
  for (let anio = 2022; anio <= 2026; anio++) {
    for (let mes = anio === 2022 ? 7 : 0; mes <= (anio === 2026 ? 7 : 11); mes++) {
      const parcial = (anio === 2022 && mes === 7) || (anio === 2026 && mes === 7);
      const f = parcial ? 0.6 : 1;
      const valor = Math.round((280000 + rnd() * 260000 + (anio - 2022) * 45000) * f * 100) / 100;
      puntos.push({
        clave: `${anio}-${String(mes + 1).padStart(2, "0")}`,
        etiqueta: `${MESES[mes]} ${String(anio).slice(2)}`,
        clientes: Math.round((28 + rnd() * 26) * f),
        pedidos: Math.round((52 + rnd() * 40) * f),
        valor,
        texto: q(valor),
        parcial,
        nota: parcial
          ? anio === 2022
            ? "Mes incompleto: el snapshot empieza a mitad de agosto 2022."
            : "Mes en curso al corte 2026-08-19. No comparable contra un mes cerrado."
          : null,
      });
    }
  }
  return puntos;
};

const meses = serie();

export const FIXTURE_CLIENTES_B18: MapaClientesB18 = {
  procedencia: proc(),

  agentes: [
    {
      id: "recencia",
      slot: "detecta",
      iniciales: "RE",
      nombre: "Recencia",
      titulo: "Detecta · Recencia",
      color: "#4b80ee",
      senal: "243 de 363 clientes llevan más de 90 días sin comprar",
      pregunta: "¿Quién dejó de comprar y desde cuándo?",
      kpi: "66.9%",
      kpiEtiqueta: "de la base sin compra en 90 días",
      micro: [
        { etiqueta: "0-30", alto: 25, parcial: false },
        { etiqueta: "31-60", alto: 15, parcial: false },
        { etiqueta: "61-90", alto: 9, parcial: false },
        { etiqueta: "+90", alto: 100, parcial: false },
      ],
      barras: [
        { clave: "0-30", etiqueta: "0 a 30 días", valor: 60, texto: "60 clientes", ancho: 24.7, parcial: false, nota: null, detalle: "Compraron dentro del último mes al corte." },
        { clave: "31-60", etiqueta: "31 a 60 días", valor: 37, texto: "37 clientes", ancho: 15.2, parcial: false, nota: null, detalle: "Ventana de seguimiento: aún no es pérdida." },
        { clave: "61-90", etiqueta: "61 a 90 días", valor: 23, texto: "23 clientes", ancho: 9.5, parcial: false, nota: null, detalle: "Umbral de alerta antes de caer a inactivo." },
        { clave: "90+", etiqueta: "Más de 90 días", valor: 243, texto: "243 clientes", ancho: 100, parcial: false, nota: "Incluye clientes de una sola compra histórica.", detalle: "Sin compra confirmada en más de un trimestre." },
      ],
      metricas: [
        { valor: "363", etiqueta: "clientes con venta histórica" },
        { valor: "243", etiqueta: "sin compra en +90 días" },
        { valor: "60", etiqueta: "activos en los últimos 30 días" },
        { valor: "3", etiqueta: "mediana de pedidos histórico", nota: "Mediana, no promedio: el promedio lo arrastran las cuentas grandes." },
      ],
      lista: filas(8, 0, 190000),
      listaTotal: 91,
      comparativo: null,
      hallazgo: "Dos tercios de la base registrada no ha vuelto a comprar en un trimestre.",
      problema: "La recencia no distingue al cliente perdido del que compra una vez al año; sin alta real del cliente no se puede separar.",
      accion: "Trabajar el tramo 61-90 antes de que cruce a +90: son 23 cuentas todavía recuperables.",
      formula: "dias = corte − max(fecha_venta) por cliente, sobre pedidos estado_odoo = 'sale'",
      procedencia: proc({ cobertura: { valor: 100, etiqueta: "clientes con al menos una venta" } }),
    },
    {
      id: "comparable",
      slot: "explica",
      iniciales: "CO",
      nombre: "Comparable",
      titulo: "Explica · Comparable",
      color: "#4b80ee",
      senal: "168 compradores YTD contra 124 del año anterior",
      pregunta: "¿El crecimiento viene de más clientes o de más compra por cliente?",
      kpi: "+35.48%",
      kpiEtiqueta: "compradores vs. comparable",
      micro: meses.slice(-12).map((m) => ({ etiqueta: m.etiqueta, alto: Math.round((m.clientes / 54) * 100), parcial: m.parcial })),
      barras: [
        { clave: "compradores", etiqueta: "Compradores", valor: 168, texto: "168 vs 124", ancho: 100, parcial: false, nota: null, detalle: "+35.48% — es el factor que más crece." },
        { clave: "pedidos", etiqueta: "Pedidos", valor: 724, texto: "724 vs 653", ancho: 30.6, parcial: false, nota: null, detalle: "+10.87% — crece menos que los clientes." },
        { clave: "venta", etiqueta: "Venta", valor: CONTROL_CLIENTES.ventaYtd, texto: `${q(CONTROL_CLIENTES.ventaYtd)} vs ${q(CONTROL_CLIENTES.ventaYtdComparable)}`, ancho: 69.5, parcial: false, nota: null, detalle: "+24.67% — queda entre los otros dos factores." },
      ],
      metricas: [
        { valor: "168", etiqueta: "compradores YTD" },
        { valor: "724", etiqueta: "pedidos YTD" },
        { valor: "2", etiqueta: "mediana de pedidos YTD", nota: "Baja de 3 histórico a 2 en el año: entran clientes que aún no repiten." },
        { valor: q(CONTROL_CLIENTES.ticketMedianoPedido), etiqueta: "ticket mediano por pedido" },
      ],
      lista: [],
      listaTotal: 0,
      comparativo: {
        titulo: "Venta YTD contra la misma ventana del año anterior",
        delta: "+24.67%",
        actual: { etiqueta: "2026 al 19-ago", texto: q(CONTROL_CLIENTES.ventaYtd), ancho: 100 },
        previo: { etiqueta: "2025 al 19-ago", texto: q(CONTROL_CLIENTES.ventaYtdComparable), ancho: 80.2 },
        nota: "Misma cantidad de días corridos en ambos años. No compara un año cerrado contra uno en curso.",
      },
      hallazgo: "Los compradores crecen 35.48% pero los pedidos sólo 10.87%: entran clientes que compran una vez.",
      problema: "La mediana de pedidos por cliente cae de 3 a 2 — la base se ensancha pero se vuelve menos frecuente.",
      accion: "Medir cuántos de los 51 de primera compra registrada vuelven en 90 días; ahí se decide si el crecimiento es real.",
      formula: "ventana YTD = [01-ene, corte]; comparable = misma ventana del año anterior, mismo número de días",
      procedencia: proc({ periodo: "2026-01-01 → 2026-08-19 vs 2025-01-01 → 2025-08-19", cobertura: { valor: 100, etiqueta: "pedidos dentro de la ventana comparable" } }),
    },
    {
      id: "concentracion",
      slot: "prioriza",
      iniciales: "CN",
      nombre: "Concentración",
      titulo: "Prioriza · Concentración",
      color: "#4b80ee",
      senal: "5 clientes concentran 28.25% de la venta del año",
      pregunta: "¿De cuántas cuentas depende el resultado?",
      kpi: "28.25%",
      kpiEtiqueta: "Top 5 sobre venta YTD",
      micro: [
        { etiqueta: "T1", alto: 22, parcial: false },
        { etiqueta: "T5", alto: 48, parcial: false },
        { etiqueta: "T10", alto: 70, parcial: false },
        { etiqueta: "T20", alto: 88, parcial: false },
        { etiqueta: "T50", alto: 100, parcial: false },
      ],
      barras: [
        { clave: "top1", etiqueta: "Top 1", valor: 9.8, texto: "9.80%", ancho: 23.6, parcial: false, nota: null, detalle: "Un solo cliente sostiene casi la décima parte del año." },
        { clave: "top5", etiqueta: "Top 5", valor: 28.25, texto: "28.25%", ancho: 67.9, parcial: false, nota: null, detalle: "Cifra de control verificada contra el snapshot." },
        { clave: "top10", etiqueta: "Top 10", valor: 41.59, texto: "41.59%", ancho: 100, parcial: false, nota: null, detalle: "Diez cuentas explican dos quintos de la venta." },
      ],
      metricas: [
        { valor: "28.25%", etiqueta: "Top 5 YTD" },
        { valor: "41.59%", etiqueta: "Top 10 YTD" },
        { valor: "168", etiqueta: "compradores en el denominador", nota: "El denominador es la venta YTD completa, nunca el subconjunto del top." },
      ],
      lista: filas(10, 0, 470000),
      listaTotal: 10,
      comparativo: null,
      hallazgo: "Diez cuentas explican 41.59% del año; la pérdida de una sola es material.",
      problema: "Hay clientes de alto valor dentro del tramo de +90 días sin compra: concentración y recencia se cruzan.",
      accion: "Revisar primero las cuentas que están en Top 20 y en el tramo +90 al mismo tiempo.",
      formula: "pct = Σ venta(top N) / Σ venta YTD × 100 — denominador siempre el total",
      procedencia: proc({ periodo: "2026-01-01 → 2026-08-19", cobertura: { valor: 100, etiqueta: "venta YTD en el denominador" } }),
    },
    {
      id: "recuperacion",
      slot: "recomienda",
      iniciales: "RC",
      nombre: "Recuperación",
      titulo: "Recomienda · Recuperación",
      color: "#4b80ee",
      senal: "Cuentas de alto valor detenidas, ordenadas por lo que aportaban",
      pregunta: "¿A quién llamar primero y por qué?",
      kpi: "121",
      kpiEtiqueta: "recurrentes con 2+ pedidos YTD",
      micro: [
        { etiqueta: "1 ped.", alto: 100, parcial: false },
        { etiqueta: "2-3", alto: 62, parcial: false },
        { etiqueta: "4-6", alto: 31, parcial: false },
        { etiqueta: "7+", alto: 14, parcial: false },
      ],
      barras: [
        { clave: "recuperar", etiqueta: "Alto valor detenido", valor: 18, texto: "18 cuentas", ancho: 100, parcial: false, nota: null, detalle: "Top 50 histórico sin compra en más de 90 días." },
        { clave: "recurrentes", etiqueta: "Recurrentes YTD", valor: 121, texto: "121 clientes", ancho: 72, parcial: false, nota: null, detalle: "Dos o más pedidos confirmados en el año." },
        { clave: "unica", etiqueta: "Una sola compra YTD", valor: 47, texto: "47 clientes", ancho: 28, parcial: false, nota: null, detalle: "168 compradores − 121 recurrentes." },
      ],
      metricas: [
        { valor: "121", etiqueta: "recurrentes 2+ pedidos YTD" },
        { valor: "51", etiqueta: "primera compra registrada YTD", nota: "Registrada, no nueva: el snapshot no tiene fecha de alta real del cliente." },
        { valor: "6", etiqueta: "pedidos en Q0.00 por revisar", nota: "Pedidos confirmados con total cero. Se listan, no se descartan." },
      ],
      lista: filas(12, 2, 240000),
      listaTotal: 243,
      comparativo: null,
      hallazgo: "18 cuentas del Top 50 histórico llevan más de 90 días detenidas.",
      problema: "Hay pedidos confirmados con total Q0.00 que no se pueden explicar sin ver la factura; distorsionan el ticket.",
      accion: "Llamar las 18 cuentas detenidas en orden de valor histórico y auditar los pedidos en Q0.00 uno por uno.",
      formula: "detenidos = clientes en top 50 histórico con dias > 90; Q0.00 = pedidos 'sale' con total = 0",
      procedencia: proc({ cobertura: { valor: 100, etiqueta: "clientes con historial previo al año en curso" } }),
    },
  ],

  b18: {
    cartera: {
      procedencia: proc(),
      metricas: [
        { valor: "363", etiqueta: "clientes con venta histórica" },
        { valor: "3,189", etiqueta: "pedidos confirmados" },
        { valor: "168", etiqueta: "compradores YTD" },
        { valor: "724", etiqueta: "pedidos YTD" },
        { valor: q(CONTROL_CLIENTES.ventaYtd), etiqueta: "venta YTD" },
        { valor: q(CONTROL_CLIENTES.ticketMedianoPedido), etiqueta: "ticket mediano por pedido" },
        { valor: "121", etiqueta: "recurrentes 2+ pedidos YTD" },
        { valor: "3 / 2", etiqueta: "mediana de pedidos histórico / YTD" },
      ],
    },

    recencia: {
      procedencia: proc({ cobertura: { valor: 100, etiqueta: "clientes con al menos una venta" } }),
      // Cada tramo genera sus clientes DENTRO de su propia ventana de días.
      // `totalFilas` es el conteo real; `filas` viene truncada a 10.
      tramos: [
        // `desde` no se solapa entre tramos: un cliente pertenece a UN solo
        // tramo de recencia. En v1 los rangos se pisaban y el mismo cliente
        // salía en dos tramos a la vez — lo cazó la prueba, no el ojo.
        { clave: "0-30", etiqueta: "0 a 30 días", clientes: 60, totalFilas: 60, ancho: 24.7, valor: 1980000, texto: q(1980000), filas: filas(6, 0, 210000, [0, 30]) },
        { clave: "31-60", etiqueta: "31 a 60 días", clientes: 37, totalFilas: 37, ancho: 15.2, valor: 940000, texto: q(940000), filas: filas(5, 6, 150000, [31, 60]) },
        { clave: "61-90", etiqueta: "61 a 90 días", clientes: 23, totalFilas: 23, ancho: 9.5, valor: 610000, texto: q(610000), filas: filas(5, 11, 120000, [61, 90]) },
        { clave: "90+", etiqueta: "Más de 90 días", clientes: 243, totalFilas: 243, ancho: 100, valor: 5240000, texto: q(5240000), filas: filas(10, 16, 330000, [91, 620]) },
      ],
    },

    concentracion: {
      procedencia: proc({ periodo: "2026-01-01 → 2026-08-19" }),
      // top50 lista 20 de 50: es el caso que obliga a la pantalla a decir
      // "20 de 50" en vez de "20 clientes listados".
      cortes: [
        { clave: "top1", etiqueta: "Top 1", pct: 9.8, valor: 467133.33, texto: q(467133.33), totalFilas: 1, filas: filas(1, 0, 467133) },
        { clave: "top5", etiqueta: "Top 5", pct: 28.25, valor: 1346583.32, texto: q(1346583.32), totalFilas: 5, filas: filas(5, 0, 467133) },
        { clave: "top10", etiqueta: "Top 10", pct: 41.59, valor: 1982456.05, texto: q(1982456.05), totalFilas: 10, filas: filas(10, 0, 467133) },
        { clave: "top20", etiqueta: "Top 20", pct: 57.4, valor: 2736066.65, texto: q(2736066.65), totalFilas: 20, filas: filas(20, 0, 467133) },
        { clave: "top50", etiqueta: "Top 50", pct: 79.2, valor: 3775199.97, texto: q(3775199.97), totalFilas: 50, filas: filas(20, 0, 467133) },
      ],
    },

    serie: {
      procedencia: proc({ periodo: "2022-08 → 2026-08" }),
      meses,
      maxClientes: Math.max(...meses.map((m) => m.clientes)),
      maxPedidos: Math.max(...meses.map((m) => m.pedidos)),
      maxValor: Math.max(...meses.map((m) => m.valor)),
    },

    composicion: {
      advertencia: CAPA_COMPOSICION,
      procedencia: proc({
        capa: CAPA_COMPOSICION,
        moneda: "Composición de líneas · no agregable como facturación",
        cobertura: { valor: 99.1, etiqueta: "líneas con familia identificada" },
        limite: "Cantidad × precio de lista. No coincide con la venta confirmada y no debe compararse con ella.",
      }),
      filas: [
        { etiqueta: "CASCOS", unidades: 24180, valor: 12460000, ancho: 100, texto: q(12460000) },
        { etiqueta: "EQUIPO", unidades: 9120, valor: 3257000, ancho: 26.1, texto: q(3257000) },
        { etiqueta: "LLANTAS", unidades: 4310, valor: 1172000, ancho: 9.4, texto: q(1172000) },
        { etiqueta: "ACCESORIOS", unidades: 3980, valor: 235000, ancho: 1.9, texto: q(235000) },
        { etiqueta: "SIN CLASIFICAR", unidades: 640, valor: 164000, ancho: 1.3, texto: q(164000) },
      ],
    },

    // v2 · CxC PENDIENTE. Ninguna cifra: `saldos_odoo` no está en el dataset
    // comercial de Clientes. La sección lo dice y manda a la página que sí la
    // tiene. Las cifras de CONTROL_CLIENTES.cxc quedan documentadas ahí arriba
    // como referencia de la segunda vuelta — no se dibujan acá.
    cxc: {
      estado: "pendiente",
      cifras: null,
      pendiente: {
        mensaje: CXC_PENDIENTE_MENSAJE,
        enlace: CXC_PENDIENTE_ENLACE,
      },
      advertencia: CAPA_CXC,
      procedencia: proc({
        capa: CAPA_CXC,
        fuente: "saldos_odoo — fuera del dataset comercial de Clientes",
        moneda: "No aplica — esta vista no calcula cartera",
        cobertura: { valor: 0, etiqueta: "de la cartera integrada a esta vista" },
        limite:
          "Clientes no calcula cartera. La cartera vive en Aging, con su propia fuente y su propio corte.",
      }),
    },

    cobertura: {
      procedencia: proc({ moneda: "No aplica — este panel no es dinero" }),
      noAfirmable: NO_AFIRMABLE,
      filas: [
        { concepto: "Venta confirmada por cliente", estado: "existe", nota: "3,189 pedidos 'sale' con total_odoo_referencia." },
        { concepto: "Recencia y frecuencia", estado: "existe", nota: "Derivadas de fecha_venta; no requieren nada externo." },
        { concepto: "Identidad del cliente", estado: "parcial", nota: "Se deriva del nombre. Variantes del mismo negocio cuentan como dos clientes." },
        { concepto: "Composición por SKU", estado: "parcial", nota: "Sirve para 'qué compra'. No es facturación." },
        { concepto: "Cartera CxC", estado: "parcial", nota: "Totales sí; reparto por cliente no." },
        { concepto: "Antigüedad real del cliente", estado: "falta", nota: "No hay fecha de alta. Sólo primera compra registrada." },
        { concepto: "Vendedor asignado", estado: "falta", nota: "No está importado al snapshot." },
        { concepto: "Canal y segmento comercial", estado: "falta", nota: "El canal se declara, no se observa. Sin captura no existe." },
      ],
    },
  },
};
