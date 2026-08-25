import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const url = process.env.SUPABASE_V2_URL?.replace(/\/$/, "");
const serviceRole = process.env.SUPABASE_V2_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("Definí SUPABASE_V2_URL y SUPABASE_V2_SERVICE_ROLE_KEY antes de importar.");
}

const fixtureUrl = new URL("../fixtures/dashboard-v2.json", import.meta.url);
const fixture = JSON.parse(await readFile(fileURLToPath(fixtureUrl), "utf8"));

const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  "Content-Type": "application/json",
};

async function request(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} falló (${response.status}): ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const [snapshot] = await request("dashboard_snapshots?on_conflict=snapshot_key", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({
    snapshot_key: fixture.snapshot.key,
    cutoff_at: fixture.snapshot.cutoffAt,
    source_label: fixture.snapshot.sourceLabel,
    note: fixture.snapshot.note,
    coverage_total: fixture.coverage.total,
    coverage_complete: fixture.coverage.complete,
    coverage_partial: fixture.coverage.partial,
    coverage_blocked: fixture.coverage.blocked,
    state: "draft",
    is_active: false,
    updated_at: new Date().toISOString(),
  }),
});

for (const table of ["dashboard_kpis", "dashboard_actions", "dashboard_agent_insights"]) {
  await request(`${table}?snapshot_id=eq.${snapshot.id}`, { method: "DELETE" });
}

await request("dashboard_kpis", {
  method: "POST",
  body: JSON.stringify(fixture.metrics.map((m) => ({
    snapshot_id: snapshot.id,
    metric_key: m.key,
    module: m.module,
    label: m.label,
    display_value: m.displayValue,
    numeric_value: m.numericValue,
    comparison: m.comparison,
    status: m.status,
    definition: m.definition,
    source_model: m.sourceModel,
    source_filter: m.sourceFilter,
    action_text: m.action,
    position: m.position,
  }))),
});

await request("dashboard_actions", {
  method: "POST",
  body: JSON.stringify(fixture.actions.map((a) => ({
    snapshot_id: snapshot.id,
    action_key: a.key,
    modules: a.modules,
    title: a.title,
    impact: a.impact,
    owner: a.owner,
    due_label: a.dueLabel,
    status: a.status,
    href: a.href,
    position: a.position,
  }))),
});

await request("dashboard_agent_insights", {
  method: "POST",
  body: JSON.stringify(fixture.insights.map((i) => ({
    snapshot_id: snapshot.id,
    module: i.module,
    agent: i.agent,
    prompt: i.prompt,
    finding: i.finding,
    recommended_action: i.recommendedAction,
    confidence: i.confidence,
    position: i.position,
  }))),
});

await request(`dashboard_snapshots?id=neq.${snapshot.id}&is_active=eq.true`, {
  method: "PATCH",
  body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
});

await request(`dashboard_snapshots?id=eq.${snapshot.id}`, {
  method: "PATCH",
  body: JSON.stringify({ state: "published", is_active: true, updated_at: new Date().toISOString() }),
});

console.log(`Snapshot ${fixture.snapshot.key} publicado con ${fixture.metrics.length} KPIs, ${fixture.actions.length} acciones y ${fixture.insights.length} hallazgos de agentes.`);
