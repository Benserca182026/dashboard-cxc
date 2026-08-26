"use client";

import { useState } from "react";

import type { FilaComercial, PuntoTendencia } from "@/lib/commercial-operacion";

export function OperacionKpi({
  etiqueta,
  valor,
  nota,
  tono = "normal",
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  tono?: "normal" | "positivo" | "alerta";
}) {
  const color = tono === "positivo" ? "text-emerald-700" : tono === "alerta" ? "text-amber-700" : "text-tinta";
  const valorLargo = valor.length > 12;
  return (
    <details className="group min-w-0 overflow-hidden rounded-[24px] border border-white/90 bg-white/75 p-5 shadow-flotante open:ring-1 open:ring-[#6677ee]/20">
      <summary className="cursor-pointer list-none">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tintaSuave">{etiqueta}</p>
      <p
        className={`mt-2 max-w-full font-bold leading-none tabular-nums tracking-tight ${
          valorLargo ? "text-[clamp(1rem,1.1vw,1.2rem)]" : "text-[1.75rem]"
        } ${color}`}
      >
        {valor}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9edf4]"><span className={`block h-full rounded-full ${tono === "positivo" ? "bg-emerald-500" : tono === "alerta" ? "bg-amber-500" : "bg-[#6677ee]"}`} style={{ width: "68%" }} /></div>
      <p className="mt-2 text-[11px] leading-snug text-tintaSuave">{nota}</p>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#6677ee] group-open:hidden">ver alcance ↘</p>
      </summary>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10.5px] leading-relaxed text-tintaSuave">Este indicador conserva su cálculo actual. La barra es una señal visual de lectura, no una escala financiera ni una meta inventada.</p>
    </details>
  );
}

export function OperacionRanking({
  titulo,
  subtitulo,
  filas,
  formatear,
  vacio,
  maxFilas = 8,
}: {
  titulo: string;
  subtitulo: string;
  filas: FilaComercial[];
  formatear: (valor: number) => string;
  vacio: string;
  maxFilas?: number;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const visibles = filas.slice(0, maxFilas);
  return (
    <article className="rounded-[28px] border border-white/90 bg-white/65 p-5 shadow-flotante">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-tinta">{titulo}</h3>
          <p className="mt-1 text-[11px] leading-snug text-tintaSuave">{subtitulo}</p>
        </div>
        {visibles.length > 0 ? (
          <span className="rounded-full bg-[#17191e] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
            Top {visibles.length}
          </span>
        ) : null}
      </div>
      {visibles.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-borde bg-white/50 px-4 py-5 text-xs leading-relaxed text-tintaSuave">
          {vacio}
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {visibles.map((fila, indice) => (
            <li key={fila.id}>
            <button type="button" onClick={() => setSeleccionado(seleccionado === fila.id ? null : fila.id)} className={`grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl p-1.5 text-left transition ${seleccionado === fila.id ? "bg-[#edf1f8]" : "hover:bg-slate-50"}`}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#17191e] text-[9px] font-bold text-white">
                {indice + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-end justify-between gap-3">
                  <p className="truncate text-[11px] font-semibold text-tinta" title={fila.etiqueta}>{fila.etiqueta}</p>
                  <p className="shrink-0 text-[11px] font-bold tabular-nums text-tinta">{formatear(fila.valor)}</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e9edf4]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6677ee] to-[#8b7cf6]"
                    style={{ width: `${Math.max(2, Math.min(100, fila.pct))}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between gap-2 text-[9px] text-tintaSuave">
                  <span className="truncate">{fila.detalle ?? "participación del total"}</span>
                  <span className="shrink-0 tabular-nums">{fila.pct.toFixed(1)}%</span>
                </div>
              </div>
            </button>
            {seleccionado === fila.id && <p className="ml-9 mt-1 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-tintaSuave"><b className="text-tinta">{fila.etiqueta}</b> representa {fila.pct.toFixed(1)}% de la población de este ranking. {fila.detalle ?? "Tocá otra fila para comparar."}</p>}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function OperacionTendencia({
  puntos,
  formatear,
  variacion,
  etiquetaComparacion,
  notaCorte,
}: {
  puntos: PuntoTendencia[];
  formatear: (valor: number) => string;
  variacion: number | null;
  etiquetaComparacion: string;
  notaCorte: string;
}) {
  const visibles = puntos.slice(-12);
  const maximo = Math.max(1, ...visibles.map((p) => p.valor));
  return (
    <article className="rounded-[28px] border border-white/90 bg-white/65 p-5 shadow-flotante">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-tinta">Tendencia de venta registrada</h3>
          <p className="mt-1 text-[11px] text-tintaSuave">Total Odoo por mes · no usa precio de lista · {notaCorte}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
          variacion === null ? "bg-slate-100 text-slate-500" : variacion >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {variacion === null ? "Sin comparación" : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% · ${etiquetaComparacion}`}
        </span>
      </div>
      {visibles.length === 0 ? (
        <p className="mt-5 text-xs text-tintaSuave">No hay pedidos con total de referencia y fecha para construir la tendencia.</p>
      ) : (
        <div className="mt-6 flex h-44 items-end gap-2" role="img" aria-label="Barras mensuales de venta registrada">
          {visibles.map((p) => (
            <div key={p.periodo} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="hidden text-[9px] font-semibold tabular-nums text-tinta group-hover:block sm:block">{formatear(p.valor)}</span>
              <div
                className="w-full min-w-2 rounded-t-xl bg-gradient-to-t from-[#7787ef] to-[#c5cbff] transition hover:from-[#5f6fe0] hover:to-[#aeb8ff]"
                style={{ height: `${Math.max(5, (p.valor / maximo) * 120)}px` }}
                title={`${p.periodo}: ${formatear(p.valor)}`}
              />
              <span className="text-[9px] tabular-nums text-tintaSuave">{p.periodo.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function OperacionPuente({
  titulo,
  subtitulo,
  pasos,
}: {
  titulo: string;
  subtitulo: string;
  pasos: { etiqueta: string; valor: string; nota: string; tono?: "normal" | "positivo" | "alerta" }[];
}) {
  return (
    <article className="rounded-[28px] border border-white/90 bg-white/65 p-5 shadow-flotante">
      <h3 className="text-sm font-bold text-tinta">{titulo}</h3>
      <p className="mt-1 text-[11px] leading-snug text-tintaSuave">{subtitulo}</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
        {pasos.map((paso, indice) => (
          <div key={paso.etiqueta} className="contents">
            {indice > 0 ? <span aria-hidden className="hidden text-center text-lg text-tintaSuave lg:block">→</span> : null}
            <div className={`rounded-2xl border p-4 ${
              paso.tono === "positivo" ? "border-emerald-200 bg-emerald-50" : paso.tono === "alerta" ? "border-amber-200 bg-amber-50" : "border-white bg-white/75"
            }`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">{paso.etiqueta}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-tinta">{paso.valor}</p>
              <p className="mt-1 text-[10px] leading-snug text-tintaSuave">{paso.nota}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function OperacionControl({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <details className="group rounded-[24px] border border-amber-200 bg-amber-50/85 p-5 text-amber-950">
      <summary className="cursor-pointer list-none">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-200 text-sm">!</span>
        <div>
          <h3 className="text-sm font-bold">{titulo}</h3>
          <p className="mt-1 text-[10px] opacity-70 group-open:hidden">tocar para ver límites y datos faltantes ↘</p>
        </div>
      </div>
      </summary>
      <ul className="mt-3 space-y-1.5 border-t border-amber-200/70 pt-3 text-[11px] leading-relaxed">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </details>
  );
}
