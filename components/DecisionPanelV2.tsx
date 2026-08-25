"use client";

import Link from "next/link";
import {
  NOMBRE_MODULO_V2,
  type EstadoMetricaV2,
  type ModuloV2,
} from "@/lib/decision-v2";
import { useDecisionV2 } from "@/lib/decision-v2-client";
import { useApp } from "@/lib/store";
import type { Moneda, TipoCambio } from "@/lib/types";

const ESTADO: Record<EstadoMetricaV2, { label: string; className: string }> = {
  complete: { label: "confirmado", className: "bg-emerald-500/10 text-emerald-800" },
  partial: { label: "parcial", className: "bg-amber-500/12 text-amber-800" },
  blocked: { label: "bloqueado", className: "bg-slate-500/12 text-slate-700" },
};

const ESTADO_AUDITABLE: Record<EstadoMetricaV2, { label: string; className: string }> = {
  complete: { label: "verificado al corte", className: "bg-emerald-500/10 text-emerald-800" },
  partial: { label: "con límite", className: "bg-amber-500/12 text-amber-800" },
  blocked: { label: "no publicable", className: "bg-slate-500/12 text-slate-700" },
};

const MONTO_GTQ = /\bQ\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)([KkMm])?\b/g;

function convertirMontosDelTexto(
  texto: string,
  monedaVista: Moneda,
  tipoCambio: TipoCambio | null
): string {
  if (monedaVista !== "USD" || !tipoCambio) return texto;

  return texto.replace(MONTO_GTQ, (_coincidencia, numero: string, sufijo?: string) => {
    const multiplicador = sufijo?.toLowerCase() === "m" ? 1_000_000 : sufijo?.toLowerCase() === "k" ? 1_000 : 1;
    const dolares = (Number(numero.replaceAll(",", "")) * multiplicador) / tipoCambio.quetzalesPorDolar;

    return dolares.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      ...(sufijo
        ? { notation: "compact" as const, maximumFractionDigits: 2 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  });
}

export function DecisionPanelV2({
  modulo,
  modoAuditable = false,
}: {
  modulo: ModuloV2;
  modoAuditable?: boolean;
}) {
  const { bundle, origen, cargandoRemoto, errorRemoto, metricasDe, accionesDe } = useDecisionV2();
  const { monedaVista, tipoCambio } = useApp();
  const mostrar = (texto: string) => convertirMontosDelTexto(texto, monedaVista, tipoCambio);
  const metricas = metricasDe(modulo);
  const acciones = accionesDe(modulo).slice(0, 4);
  const corte = new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Panama",
  }).format(new Date(bundle.snapshot.cutoffAt));

  return (
    <section id="sec-decisiones-v2" className="lienzo-referencia scroll-mt-24 overflow-hidden entrada-suave">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#778198]">Snapshot publicado · {NOMBRE_MODULO_V2[modulo]}</p>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-tinta">KPIs gobernados y decisiones vigentes</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[#6b6f78]">{modoAuditable ? "El corte del contenedor no reemplaza el corte de cada KPI. Los valores sin fórmula o detalle reproducible se bloquean en vez de publicarse." : "Este bloque conserva el corte publicado y sus metadatos. El análisis operativo inferior declara su propio corte, que puede ser anterior o posterior."}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[10.5px] font-semibold text-[#4e596d] shadow-flotante">
              {cargandoRemoto ? "sincronizando Supabase V2…" : origen === "supabase-v2" ? "Supabase V2" : "snapshot local declarado"}
            </span>
            <p className="mt-1.5 text-[10.5px] text-[#85878c]">Corte {corte}</p>
          </div>
        </div>

        {errorRemoto ? (
          <p className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800">
            Supabase V2 no respondió; se conserva el snapshot local con sus límites declarados. {errorRemoto}
          </p>
        ) : null}

        {modoAuditable ? (
          <p className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/75 px-3 py-2 text-[10.5px] leading-relaxed text-amber-900">
            Inventario usa controles Odoo del 2026-08-19 y movimientos operativos con su propia ventana. Cada tarjeta declara el corte que realmente respalda su cifra.
          </p>
        ) : null}

        <details className="group/snapshot mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-[11px] font-semibold text-[#4f5a70] shadow-[inset_0_1px_0_rgba(255,255,255,.8)] hover:bg-white/75">
            <span>Ver {metricas.length} KPIs publicados, decisiones y estado de cobertura</span>
            <span className="rounded-full bg-[#16181d] px-3 py-1 text-[9px] uppercase tracking-[0.08em] text-white group-open/snapshot:hidden">abrir ↓</span>
            <span className="hidden rounded-full bg-[#16181d] px-3 py-1 text-[9px] uppercase tracking-[0.08em] text-white group-open/snapshot:inline-flex">cerrar ↑</span>
          </summary>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricas.map((metrica) => {
            const estado = (modoAuditable ? ESTADO_AUDITABLE : ESTADO)[metrica.status];
            const valorMostrado = mostrar(metrica.displayValue);
            const valorLargo = valorMostrado.length > 12;
            return (
              <details key={metrica.key} className="group tarjeta-calada min-w-0 p-4 open:sm:col-span-2">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11.5px] font-semibold leading-snug text-[#606776]">{metrica.label}</p>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] ${estado.className}`}>{estado.label}</span>
                  </div>
                  <p className={`mt-3 max-w-full font-extrabold leading-none tracking-[-0.025em] tabular-nums text-tinta ${valorLargo ? "text-[clamp(1rem,1.1vw,1.2rem)]" : "text-[25px]"}`}>{valorMostrado}</p>
                  <p className="mt-2 text-[11px] leading-snug text-[#7c808a]">{mostrar(metrica.comparison)}</p>
                  {modoAuditable ? <p className="mt-2 font-mono text-[9.5px] leading-snug text-[#8b8f98]">{metrica.sourceModel} · {metrica.sourceFilter}</p> : null}
                  <p className="mt-3 text-[10px] font-semibold text-[#9a643d] group-open:hidden">abrir trazabilidad ↘</p>
                </summary>
                <div className="mt-4 grid gap-3 border-t border-black/[.06] pt-3 text-[11px] leading-relaxed sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.06em] text-[#8b8f98]">Definición</p>
                    <p className="mt-1 text-[#5f6673]">{mostrar(metrica.definition)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.06em] text-[#8b8f98]">Fuente y filtro</p>
                    <p className="mt-1 font-mono text-[10.5px] text-[#5f6673]">{metrica.sourceModel} · {metrica.sourceFilter}</p>
                  </div>
                  <div className="sm:col-span-2 rounded-xl bg-[#f3f6fb] px-3 py-2 text-[#4f5a70]">
                    <span className="font-semibold">Siguiente decisión:</span> {mostrar(metrica.action)}
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="rounded-[20px] border border-white/70 bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.75)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-bold text-tinta">Decisiones de esta semana</h3>
              <span className="text-[10px] text-[#8b8f98]">ordenadas por impacto</span>
            </div>
            <ol className="mt-3 space-y-2">
              {acciones.map((accion, indice) => (
                <li key={accion.key} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-xl bg-white/75 px-3 py-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-tinta text-[10px] font-bold text-white">{indice + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-tinta">{accion.title}</p>
                    <p className="mt-0.5 text-[10.5px] text-[#6b6f78]">{mostrar(accion.impact)} · {accion.owner} · {accion.dueLabel}</p>
                  </div>
                  <Link href={accion.href} className="rounded-full bg-[#edf1f8] px-2.5 py-1 text-[10px] font-semibold text-[#4f5a70] hover:bg-white">ver</Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
        </details>
      </div>
    </section>
  );
}
