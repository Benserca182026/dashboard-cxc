/**
 * CONTRATO B18 — el molde único.
 *
 * La referencia visual aprobada es /ventas/productos: riel interno a la
 * izquierda, dos agentes arriba y abajo a cada lado, reporte ejecutivo al
 * centro, B18 cerrado que sólo abre con clic.
 *
 * Ese molde estaba escrito a mano dentro de MapaB18Producto. Cada página nueva
 * lo volvía a escribir — por eso /ventas/clientes llegó a 1.077 líneas para
 * hacer lo mismo que otra hace en 175, y por eso /ventas/detalle y los módulos
 * pendientes quedaron fuera del formato: no había molde que copiar.
 *
 * Este archivo es ese molde, pero como DATO. Una página no dibuja: describe.
 * MoldeB18 dibuja. Si el formato cambia, cambia en un solo lugar.
 *
 * REGLA DE HONESTIDAD: este contrato no formatea cifras. Recibe texto ya
 * formateado por quien conoce la unidad (quetzales, pedidos, porcentaje). El
 * molde no puede inventar una unidad que no le dieron, y por lo tanto no puede
 * presentar una composición de líneas como si fuera venta neta, ni sumar dos
 * monedas por descuido de formato.
 */

export type RolB18 = "detecta" | "explica" | "prioriza" | "recomienda";

/** Los cuatro roles, en el orden en que la grilla los coloca. */
export const ROLES_B18: RolB18[] = ["detecta", "explica", "prioriza", "recomienda"];

export const COLORES_B18: Record<RolB18, string> = {
  detecta: "#0789e6",
  explica: "#7b2bf4",
  prioriza: "#16a34a",
  recomienda: "#f97316",
};

export const NOMBRES_B18: Record<RolB18, string> = {
  detecta: "Detecta",
  explica: "Explica",
  prioriza: "Prioriza",
  recomienda: "Recomienda",
};

export type GraficaB18 = "dona" | "barras" | "pareto" | "cobertura";

/** Una fila del reparto que se está leyendo (un bucket, un cliente, un año). */
export type FilaB18 = {
  nombre: string;
  /** Participación 0-100 dentro del total de su categoría. */
  pct: number;
  /** El monto o conteo, ya formateado con su unidad. Opcional. */
  valorTexto?: string;
};

/** Una de las cuatro tarjetas que rodean al centro. */
export type TarjetaB18 = {
  id: RolB18;
  /** Cifra grande, YA formateada con su unidad. */
  kpiTexto: string;
  /** Qué mide esa cifra. */
  etiqueta: string;
  /** Línea al pie de la tarjeta. */
  resumen: string;
  /** Qué problema señala — se lee en el drill-down. */
  problema: string;
  /** Qué hacer con eso — se lee en el drill-down. */
  accion: string;
  grafica: GraficaB18;
  /** Obligatorio para "dona" y "cobertura": el porcentaje del anillo (0-100). */
  donaPct?: number;
};

export type MetricaB18 = { valor: string; etiqueta: string };

/** Una línea del pie de procedencia: Fuente, Capa, Corte, Moneda, Cobertura... */
export type MetadatoB18 = { termino: string; valor: string };

/** Un botón del riel, con todo lo que la pantalla muestra cuando está activo. */
export type CategoriaB18 = {
  id: string;
  /** Dos letras para el riel y las insignias. */
  sigla: string;
  nombre: string;
  /** Lo que dice el "Agent status" del riel. */
  senal: string;
  /** El h3 del centro: siempre una pregunta. */
  pregunta: string;
  /** El reparto que dibujan la dona y las barras del centro. */
  filas: FilaB18[];
  /** 0-100. Cuánto del total tiene lectura identificada. */
  cobertura: number;
  /** Qué significa "cobertura" AQUÍ — no es lo mismo en cartera que en ventas. */
  coberturaEtiqueta: string;
  /** Las tres cajas bajo la dona del centro. */
  metricas: [MetricaB18, MetricaB18, MetricaB18];
  /** Las cuatro tarjetas. */
  tarjetas: TarjetaB18[];
  /** Titular del problema de esta categoría — se lee en el dashboard B18. */
  problema: string;
  /** El pie de procedencia de ESTA categoría. */
  metadatos: MetadatoB18[];
};

/** Las cuatro cajas de arriba del dashboard integral B18. */
export type KpiB18 = { etiqueta: string; valor: string; nota: string };

export type ResumenB18 = {
  subtitulo: string;
  kpis: [KpiB18, KpiB18, KpiB18, KpiB18];
  tituloMix: string;
  preguntaMix: string;
  tituloCobertura: string;
  preguntaCobertura: string;
  notaCobertura: string;
  pie: string;
};

export type ContratoB18 = {
  /** Antetítulo: "VENTAS · PORTAFOLIO". */
  eyebrow: string;
  titulo: string;
  /** Rótulo del riel: "Categorías", "Dominios", "Tramos"... */
  rotuloRiel: string;
  corte: string;
  categorias: CategoriaB18[];
  resumen: ResumenB18;
};

export function pctB18(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

/** Reparto → participación, sin dividir entre cero y sin inventar el resto. */
export function repartir(
  filas: { nombre: string; valor: number; valorTexto?: string }[]
): FilaB18[] {
  const total = filas.reduce((suma, fila) => suma + Math.max(fila.valor, 0), 0);
  return filas
    .map((fila) => ({
      nombre: fila.nombre,
      pct: total > 0 ? Math.round((Math.max(fila.valor, 0) / total) * 10000) / 100 : 0,
      valorTexto: fila.valorTexto,
    }))
    .sort((a, b) => b.pct - a.pct);
}
