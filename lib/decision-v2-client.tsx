"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DASHBOARD_V2_FALLBACK,
  type AccionV2,
  type DashboardV2Bundle,
  type InsightV2,
  type MetricaV2,
  type ModuloV2,
} from "@/lib/decision-v2";

type OrigenV2 = "supabase-v2" | "snapshot-verificado";

interface EstadoDecisionV2 {
  bundle: DashboardV2Bundle;
  origen: OrigenV2;
  cargandoRemoto: boolean;
  errorRemoto: string | null;
  metricasDe: (modulo: ModuloV2) => MetricaV2[];
  accionesDe: (modulo: ModuloV2) => AccionV2[];
  insightsDe: (modulo: ModuloV2) => InsightV2[];
}

interface SnapshotRow {
  id: string;
  snapshot_key: string;
  cutoff_at: string;
  source_label: string;
  note: string;
  coverage_total: number;
  coverage_complete: number;
  coverage_partial: number;
  coverage_blocked: number;
}

interface MetricRow {
  metric_key: string;
  module: ModuloV2;
  label: string;
  display_value: string;
  numeric_value: number | null;
  comparison: string;
  status: MetricaV2["status"];
  definition: string;
  source_model: string;
  source_filter: string;
  action_text: string;
  position: number;
}

interface ActionRow {
  action_key: string;
  modules: ModuloV2[];
  title: string;
  impact: string;
  owner: string;
  due_label: string;
  status: AccionV2["status"];
  href: string;
  position: number;
}

interface InsightRow {
  module: ModuloV2;
  agent: string;
  prompt: string;
  finding: string;
  recommended_action: string;
  confidence: InsightV2["confidence"];
  position: number;
}

const ContextoDecisionV2 = createContext<EstadoDecisionV2 | null>(null);

const SUPABASE_V2_URL = process.env.NEXT_PUBLIC_SUPABASE_V2_URL?.replace(/\/$/, "");
const SUPABASE_V2_KEY = process.env.NEXT_PUBLIC_SUPABASE_V2_PUBLISHABLE_KEY;

async function consultar<T>(path: string): Promise<T> {
  if (!SUPABASE_V2_URL || !SUPABASE_V2_KEY) {
    throw new Error("Supabase V2 aún no está configurado en esta copia.");
  }
  const respuesta = await fetch(`${SUPABASE_V2_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_V2_KEY,
      Authorization: `Bearer ${SUPABASE_V2_KEY}`,
    },
    cache: "no-store",
  });
  if (!respuesta.ok) {
    throw new Error(`Supabase V2 respondió HTTP ${respuesta.status}.`);
  }
  return (await respuesta.json()) as T;
}

async function cargarBundleRemoto(): Promise<DashboardV2Bundle> {
  const snapshots = await consultar<SnapshotRow[]>(
    "dashboard_snapshots?select=*&is_active=eq.true&state=eq.published&order=cutoff_at.desc&limit=1"
  );
  const snapshot = snapshots[0];
  if (!snapshot) throw new Error("Supabase V2 no tiene un snapshot publicado y activo.");

  const filtro = `snapshot_id=eq.${encodeURIComponent(snapshot.id)}`;
  const [metricRows, actionRows, insightRows] = await Promise.all([
    consultar<MetricRow[]>(`dashboard_kpis?select=*&${filtro}&order=module.asc,position.asc`),
    consultar<ActionRow[]>(`dashboard_actions?select=*&${filtro}&order=position.asc`),
    consultar<InsightRow[]>(`dashboard_agent_insights?select=*&${filtro}&order=module.asc,position.asc`),
  ]);

  return {
    snapshot: {
      key: snapshot.snapshot_key,
      cutoffAt: snapshot.cutoff_at,
      sourceLabel: snapshot.source_label,
      note: snapshot.note,
    },
    coverage: {
      total: snapshot.coverage_total,
      complete: snapshot.coverage_complete,
      partial: snapshot.coverage_partial,
      blocked: snapshot.coverage_blocked,
    },
    metrics: metricRows.map((m) => ({
      key: m.metric_key,
      module: m.module,
      label: m.label,
      displayValue: m.display_value,
      numericValue: m.numeric_value === null ? null : Number(m.numeric_value),
      comparison: m.comparison,
      status: m.status,
      definition: m.definition,
      sourceModel: m.source_model,
      sourceFilter: m.source_filter,
      action: m.action_text,
      position: m.position,
    })),
    actions: actionRows.map((a) => ({
      key: a.action_key,
      modules: a.modules,
      title: a.title,
      impact: a.impact,
      owner: a.owner,
      dueLabel: a.due_label,
      status: a.status,
      href: a.href,
      position: a.position,
    })),
    insights: insightRows.map((i) => ({
      module: i.module,
      agent: i.agent,
      prompt: i.prompt,
      finding: i.finding,
      recommendedAction: i.recommended_action,
      confidence: i.confidence,
      position: i.position,
    })),
  };
}

export function ProveedorDecisionV2({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState(DASHBOARD_V2_FALLBACK);
  const [origen, setOrigen] = useState<OrigenV2>("snapshot-verificado");
  const [cargandoRemoto, setCargandoRemoto] = useState(Boolean(SUPABASE_V2_URL && SUPABASE_V2_KEY));
  const [errorRemoto, setErrorRemoto] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_V2_URL || !SUPABASE_V2_KEY) return;
    let vigente = true;
    cargarBundleRemoto()
      .then((remoto) => {
        if (!vigente) return;
        setBundle(remoto);
        setOrigen("supabase-v2");
        setErrorRemoto(null);
      })
      .catch((error) => {
        if (!vigente) return;
        setErrorRemoto(error instanceof Error ? error.message : "No se pudo cargar Supabase V2.");
      })
      .finally(() => {
        if (vigente) setCargandoRemoto(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const valor = useMemo<EstadoDecisionV2>(() => ({
    bundle,
    origen,
    cargandoRemoto,
    errorRemoto,
    metricasDe: (modulo) => bundle.metrics.filter((m) => m.module === modulo).sort((a, b) => a.position - b.position),
    accionesDe: (modulo) => bundle.actions.filter((a) => a.modules.includes(modulo)).sort((a, b) => a.position - b.position),
    insightsDe: (modulo) => bundle.insights.filter((i) => i.module === modulo).sort((a, b) => a.position - b.position),
  }), [bundle, origen, cargandoRemoto, errorRemoto]);

  return <ContextoDecisionV2.Provider value={valor}>{children}</ContextoDecisionV2.Provider>;
}

export function useDecisionV2(): EstadoDecisionV2 {
  const contexto = useContext(ContextoDecisionV2);
  if (!contexto) throw new Error("useDecisionV2 debe usarse dentro de ProveedorDecisionV2.");
  return contexto;
}
