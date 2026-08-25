import snapshotJson from "@/fixtures/dashboard-v2.json";

export type ModuloV2 =
  | "resumen"
  | "ventas"
  | "aging"
  | "inventario"
  | "forecast"
  | "prioritarios"
  | "seguimiento"
  | "datos";

export type EstadoMetricaV2 = "complete" | "partial" | "blocked";
export type ConfianzaInsightV2 = "high" | "medium" | "low";
export type EstadoAccionV2 = "open" | "in_progress" | "done" | "blocked";

export interface MetricaV2 {
  key: string;
  module: ModuloV2;
  label: string;
  displayValue: string;
  numericValue: number | null;
  comparison: string;
  status: EstadoMetricaV2;
  definition: string;
  sourceModel: string;
  sourceFilter: string;
  action: string;
  position: number;
}

export interface AccionV2 {
  key: string;
  modules: ModuloV2[];
  title: string;
  impact: string;
  owner: string;
  dueLabel: string;
  status: EstadoAccionV2;
  href: string;
  position: number;
}

export interface InsightV2 {
  module: ModuloV2;
  agent: string;
  prompt: string;
  finding: string;
  recommendedAction: string;
  confidence: ConfianzaInsightV2;
  position: number;
}

export interface DashboardV2Bundle {
  snapshot: {
    key: string;
    cutoffAt: string;
    sourceLabel: string;
    note: string;
  };
  coverage: {
    total: number;
    complete: number;
    partial: number;
    blocked: number;
  };
  metrics: MetricaV2[];
  actions: AccionV2[];
  insights: InsightV2[];
}

export const DASHBOARD_V2_FALLBACK = snapshotJson as DashboardV2Bundle;

export const NOMBRE_MODULO_V2: Record<ModuloV2, string> = {
  resumen: "La empresa hoy",
  ventas: "Decisión comercial",
  aging: "Caja y riesgo",
  inventario: "Capital y disponibilidad",
  forecast: "Escenarios y clientes",
  prioritarios: "Worklist por impacto",
  seguimiento: "Próxima acción",
  datos: "Cobertura y confianza",
};
