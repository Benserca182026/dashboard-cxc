create extension if not exists pgcrypto;

create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cutoff_at timestamptz not null,
  source_label text not null,
  note text not null default '',
  coverage_total integer not null check (coverage_total >= 0),
  coverage_complete integer not null check (coverage_complete >= 0),
  coverage_partial integer not null check (coverage_partial >= 0),
  coverage_blocked integer not null check (coverage_blocked >= 0),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_snapshots_coverage_check
    check (coverage_complete + coverage_partial + coverage_blocked = coverage_total)
);

create unique index if not exists dashboard_snapshots_one_active
  on public.dashboard_snapshots (is_active)
  where is_active = true;

create table if not exists public.dashboard_kpis (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.dashboard_snapshots(id) on delete cascade,
  metric_key text not null,
  module text not null check (module in ('resumen','ventas','aging','inventario','forecast','prioritarios','seguimiento','datos')),
  label text not null,
  display_value text not null,
  numeric_value numeric,
  comparison text not null,
  status text not null check (status in ('complete','partial','blocked')),
  definition text not null,
  source_model text not null,
  source_filter text not null,
  action_text text not null,
  position integer not null default 0,
  unique (snapshot_id, metric_key)
);

create index if not exists dashboard_kpis_snapshot_module_position
  on public.dashboard_kpis (snapshot_id, module, position);

create table if not exists public.dashboard_actions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.dashboard_snapshots(id) on delete cascade,
  action_key text not null,
  modules text[] not null,
  title text not null,
  impact text not null,
  owner text not null,
  due_label text not null,
  status text not null check (status in ('open','in_progress','done','blocked')),
  href text not null,
  position integer not null default 0,
  unique (snapshot_id, action_key)
);

create index if not exists dashboard_actions_snapshot_position
  on public.dashboard_actions (snapshot_id, position);

create table if not exists public.dashboard_agent_insights (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.dashboard_snapshots(id) on delete cascade,
  module text not null check (module in ('resumen','ventas','aging','inventario','forecast','prioritarios','seguimiento','datos')),
  agent text not null,
  prompt text not null,
  finding text not null,
  recommended_action text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  position integer not null default 0
);

create index if not exists dashboard_agent_insights_snapshot_module_position
  on public.dashboard_agent_insights (snapshot_id, module, position);

alter table public.dashboard_snapshots enable row level security;
alter table public.dashboard_kpis enable row level security;
alter table public.dashboard_actions enable row level security;
alter table public.dashboard_agent_insights enable row level security;

grant usage on schema public to anon, authenticated, service_role;

drop policy if exists "public_read_active_dashboard_snapshots" on public.dashboard_snapshots;
create policy "public_read_active_dashboard_snapshots"
  on public.dashboard_snapshots for select
  to anon, authenticated
  using (is_active = true and state = 'published');

drop policy if exists "public_read_active_dashboard_kpis" on public.dashboard_kpis;
create policy "public_read_active_dashboard_kpis"
  on public.dashboard_kpis for select
  to anon, authenticated
  using (exists (
    select 1 from public.dashboard_snapshots s
    where s.id = dashboard_kpis.snapshot_id and s.is_active = true and s.state = 'published'
  ));

drop policy if exists "public_read_active_dashboard_actions" on public.dashboard_actions;
create policy "public_read_active_dashboard_actions"
  on public.dashboard_actions for select
  to anon, authenticated
  using (exists (
    select 1 from public.dashboard_snapshots s
    where s.id = dashboard_actions.snapshot_id and s.is_active = true and s.state = 'published'
  ));

drop policy if exists "public_read_active_dashboard_agent_insights" on public.dashboard_agent_insights;
create policy "public_read_active_dashboard_agent_insights"
  on public.dashboard_agent_insights for select
  to anon, authenticated
  using (exists (
    select 1 from public.dashboard_snapshots s
    where s.id = dashboard_agent_insights.snapshot_id and s.is_active = true and s.state = 'published'
  ));

grant select on public.dashboard_snapshots to anon, authenticated;
grant select on public.dashboard_kpis to anon, authenticated;
grant select on public.dashboard_actions to anon, authenticated;
grant select on public.dashboard_agent_insights to anon, authenticated;

grant select, insert, update, delete on public.dashboard_snapshots to service_role;
grant select, insert, update, delete on public.dashboard_kpis to service_role;
grant select, insert, update, delete on public.dashboard_actions to service_role;
grant select, insert, update, delete on public.dashboard_agent_insights to service_role;

revoke insert, update, delete on public.dashboard_snapshots from anon, authenticated;
revoke insert, update, delete on public.dashboard_kpis from anon, authenticated;
revoke insert, update, delete on public.dashboard_actions from anon, authenticated;
revoke insert, update, delete on public.dashboard_agent_insights from anon, authenticated;
