"use client";

import { useState } from "react";

import type { FilaComercial, FilaInventarioComercial, PuntoTendencia } from "@/lib/commercial-operacion";

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
      <div className={`mt-3 h-1.5 rounded-full ${tono === "positivo" ? "bg-emerald-500" : tono === "alerta" ? "bg-amber-500" : "bg-[#6677ee]"}`} aria-hidden />
      <p className="mt-2 text-[11px] leading-snug text-tintaSuave">{nota}</p>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#6677ee] group-open:hidden">ver alcance ↘</p>
      </summary>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10.5px] leading-relaxed text-tintaSuave">Este indicador conserva su cálculo actual. El color declara su estado; no se dibuja una escala ni una meta que el dato no contiene.</p>
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

const COLORES_INVENTARIO = ["#6677ee", "#8f7cf6", "#45a7a0", "#f1a54c", "#d66f9c", "#a8b2c5"];

/** Vista estrictamente sobre flujo observado: los montos representan salidas
 * valorizadas, nunca existencia ni rotación de inventario. */
export function InventarioMovimientoVisual({
  filas,
  total,
  formatear,
}: {
  filas: FilaInventarioComercial[];
  total: number;
  formatear: (valor: number) => string;
}) {
  const [seleccionado, setSeleccionado] = useState<string | "resto" | null>(null);
  const principales = filas.slice(0, 5);
  const valorPrincipal = principales.reduce((suma, fila) => suma + fila.valor, 0);
  const pctPrincipal = principales.reduce((suma, fila) => suma + fila.pct, 0);
  const resto = Math.max(0, total - valorPrincipal);
  const pctResto = Math.max(0, 100 - pctPrincipal);
  const segmentos = [
    ...principales.map((fila, indice) => ({ id: fila.id, etiqueta: fila.etiqueta, valor: fila.valor, pct: fila.pct, color: COLORES_INVENTARIO[indice], detalle: fila.detalle })),
    ...(resto > 0 ? [{ id: "resto" as const, etiqueta: "Resto de productos", valor: resto, pct: pctResto, color: COLORES_INVENTARIO[5], detalle: "Productos fuera del Top 5" }] : []),
  ];
  let inicio = 0;
  const gradiente = segmentos.map((segmento) => {
    const fin = inicio + segmento.pct;
    const regla = `${segmento.color} ${inicio}% ${fin}%`;
    inicio = fin;
    return regla;
  }).join(", ");
  const activo = segmentos.find((segmento) => segmento.id === seleccionado);
  const maximo = Math.max(1, ...filas.slice(0, 8).map((fila) => fila.valor));

  if (!filas.length || total <= 0) return null;

  return (
    <article className="rounded-[28px] border border-white/90 bg-white/65 p-5 shadow-flotante">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-tinta">Dónde se concentra lo que salió del almacén</h3>
          <p className="mt-1 text-[11px] text-tintaSuave">Salida = entrega, venta u otro movimiento registrado · monto por producto</p>
        </div>
        <span className="rounded-full bg-[#edf1f8] px-3 py-1 text-[10px] font-bold tabular-nums text-[#536b91]">Total: {formatear(total)}</span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(210px,.75fr)_minmax(0,1.25fr)] lg:items-center">
        <div className="mx-auto w-full max-w-[250px]">
          <button
            type="button"
            aria-label="Distribución del valor que salió del almacén por producto"
            onClick={() => setSeleccionado(null)}
            className="relative mx-auto grid h-48 w-48 place-items-center rounded-full transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#6677ee]/40"
            style={{ background: `conic-gradient(${gradiente})` }}
          >
            <span className="grid h-[116px] w-[116px] place-items-center rounded-full bg-white text-center shadow-sm">
              <span>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Valor que salió</span>
                <span className="mt-1 block text-[17px] font-bold tabular-nums text-tinta">{formatear(total)}</span>
              </span>
            </span>
          </button>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            {segmentos.map((segmento) => (
              <button key={segmento.id} type="button" onClick={() => setSeleccionado(segmento.id)} className={`flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-left transition ${seleccionado === segmento.id ? "bg-[#edf1f8]" : "hover:bg-slate-50"}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segmento.color }} />
                <span className="truncate text-[9px] font-medium text-tintaSuave" title={segmento.etiqueta}>{segmento.etiqueta}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filas.slice(0, 8).map((fila, indice) => (
            <button key={fila.id} type="button" onClick={() => setSeleccionado(fila.id)} className={`w-full rounded-xl p-2 text-left transition ${seleccionado === fila.id ? "bg-[#edf1f8]" : "hover:bg-slate-50"}`}>
              <div className="flex items-end justify-between gap-3">
                <p className="min-w-0 truncate text-[10.5px] font-semibold text-tinta" title={fila.etiqueta}>{fila.etiqueta}</p>
                <p className="shrink-0 text-[10.5px] font-bold tabular-nums text-tinta">{formatear(fila.valor)}</p>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[#e9edf4]">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (fila.valor / maximo) * 100)}%`, background: COLORES_INVENTARIO[indice % 5] }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-tintaSuave"><span>{fila.detalle}</span><span>{fila.pct.toFixed(1)}%</span></div>
            </button>
          ))}
        </div>
      </div>
      {activo ? <p className="mt-4 rounded-xl bg-[#f4f6fb] px-3 py-2 text-[10px] text-tintaSuave"><b className="text-tinta">{activo.etiqueta}</b> · {formatear(activo.valor)} · {activo.pct.toFixed(1)}% del valor que salió del almacén. {activo.detalle}</p> : null}
    </article>
  );
}

export function OperacionTendencia({
  puntos,
  formatear,
  variacion,
  etiquetaComparacion,
  notaCorte,
  totalAnual,
  anio,
}: {
  puntos: PuntoTendencia[];
  formatear: (valor: number) => string;
  variacion: number | null;
  etiquetaComparacion: string;
  notaCorte: string;
  totalAnual: number;
  anio: string | null;
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
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-[#edf1f8] px-3 py-1 text-[10px] font-bold tabular-nums text-[#536b91]">Total {anio ?? "del año"}: {formatear(totalAnual)}</span>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            variacion === null ? "bg-slate-100 text-slate-500" : variacion >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {variacion === null ? "Sin comparación" : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% · ${etiquetaComparacion}`}
          </span>
        </div>
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
