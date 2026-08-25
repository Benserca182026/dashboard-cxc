"use client";

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
    <article className="min-w-0 overflow-hidden rounded-[24px] border border-white/90 bg-white/75 p-5 shadow-flotante">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tintaSuave">{etiqueta}</p>
      <p
        className={`mt-2 max-w-full font-bold leading-none tabular-nums tracking-tight ${
          valorLargo ? "text-[clamp(1rem,1.1vw,1.2rem)]" : "text-[1.75rem]"
        } ${color}`}
      >
        {valor}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-tintaSuave">{nota}</p>
    </article>
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
            <li key={fila.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2.5">
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
    <aside className="rounded-[24px] border border-amber-200 bg-amber-50/85 p-5 text-amber-950">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-200 text-sm">!</span>
        <div>
          <h3 className="text-sm font-bold">{titulo}</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed">
            {items.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      </div>
    </aside>
  );
}
