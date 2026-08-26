"use client";

import { useMemo, useState } from "react";
import type { FilaImpactoEjecutivo } from "@/lib/commercial-ejecutivo";

export function KpiExplorable({
  etiqueta,
  valor,
  nota,
  porcentaje,
  tono = "azul",
  detalle,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  porcentaje?: number;
  tono?: "azul" | "rojo" | "ambar" | "violeta";
  detalle: React.ReactNode;
}) {
  const color = { azul: "#536b91", rojo: "#c2703a", ambar: "#b98120", violeta: "#796de0" }[tono];
  const pct = Math.max(0, Math.min(100, porcentaje ?? 0));
  return (
    <details className="group overflow-hidden rounded-[24px] border border-white/90 bg-white/80 p-4 shadow-flotante transition open:ring-1 open:ring-[#536b91]/20">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-tintaSuave">{etiqueta}</p>
          <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
            <circle cx="20" cy="20" r="15" fill="none" stroke="#e9edf4" strokeWidth="4" />
            <circle cx="20" cy="20" r="15" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * .942} 100`} />
          </svg>
        </div>
        <p className="mt-3 text-[clamp(1.25rem,2.1vw,2rem)] font-extrabold leading-none tracking-tight tabular-nums text-tinta">{valor}</p>
        <p className="mt-2 text-[10.5px] leading-snug text-tintaSuave">{nota}</p>
        <p className="mt-3 text-[9px] font-bold uppercase tracking-[.09em] text-[#536b91] group-open:hidden">tocar para evidencia ↘</p>
      </summary>
      <div className="mt-3 border-t border-slate-100 pt-3 text-[10.5px] leading-relaxed text-tintaSuave">{detalle}</div>
    </details>
  );
}

export function MapaImpactoCobranza({
  oportunidades,
  riesgos,
  total,
  fmt,
}: {
  oportunidades: FilaImpactoEjecutivo[];
  riesgos: FilaImpactoEjecutivo[];
  total: number;
  fmt: (n: number) => string;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const filas = useMemo(() => {
    const porId = new Map<string, FilaImpactoEjecutivo & { critico: boolean; dias: number }>();
    for (const fila of oportunidades) {
      const dias = Number(fila.detalle.match(/(\d+)\s*d/i)?.[1] ?? 0);
      porId.set(fila.id, { ...fila, critico: false, dias });
    }
    for (const fila of riesgos) {
      const anterior = porId.get(fila.id);
      const dias = Number(fila.detalle.match(/(\d+)\s*d/i)?.[1] ?? anterior?.dias ?? 91);
      porId.set(fila.id, { ...(anterior ?? fila), monto: Math.max(anterior?.monto ?? 0, fila.monto), participacion: Math.max(anterior?.participacion ?? 0, fila.participacion), detalle: anterior?.detalle ?? fila.detalle, critico: true, dias });
    }
    return [...porId.values()];
  }, [oportunidades, riesgos]);
  const maxMonto = Math.max(1, ...filas.map((f) => f.monto));
  const maxDias = Math.max(1, ...filas.map((f) => f.dias));
  const seleccionado = filas.find((f) => f.id === activo) ?? filas[0];
  const x = (d: number) => 64 + (d / maxDias) * 650;
  const y = (m: number) => 252 - (m / maxMonto) * 184;
  return (
    <section className="rounded-[28px] border border-white/90 bg-white/70 p-5 shadow-flotante">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#536b91]">Impacto de cobranza</p>
          <h3 className="mt-1 text-base font-bold text-tinta">Saldo, atraso y criticidad en un solo mapa</h3>
        </div>
        <div className="flex gap-3 text-[10px] font-semibold text-tintaSuave"><span>● riesgo operativo</span><span className="text-[#c2703a]">● mora crítica</span></div>
      </div>
      {filas.length === 0 ? <p className="mt-5 text-sm text-tintaSuave">No hay saldos vencidos clasificables al corte.</p> : (
        <>
          <svg viewBox="0 0 760 300" className="mt-4 w-full overflow-visible" role="img" aria-label="Mapa de clientes por días de atraso y saldo vencido">
            <rect x="64" y="28" width="650" height="224" rx="18" fill="#f6f8fc" />
            <line x1="64" y1="252" x2="714" y2="252" stroke="#b7c0d0" /><line x1="64" y1="28" x2="64" y2="252" stroke="#b7c0d0" />
            <text x="390" y="288" textAnchor="middle" fontSize="11" fill="#667085">DÍAS DE ATRASO →</text>
            <text transform="translate(18 150) rotate(-90)" textAnchor="middle" fontSize="11" fill="#667085">SALDO VENCIDO →</text>
            <text x="66" y="270" fontSize="9" fill="#8b96a8">0 d</text><text x="685" y="270" fontSize="9" fill="#8b96a8">{maxDias} d</text>
            {filas.map((fila, i) => {
              const r = 10 + Math.sqrt(fila.monto / maxMonto) * 14;
              const isActive = seleccionado?.id === fila.id;
              return <g key={fila.id} className="cursor-pointer" onClick={() => setActivo(fila.id)} onMouseEnter={() => setActivo(fila.id)}>
                <circle cx={x(fila.dias)} cy={y(fila.monto)} r={r + (isActive ? 4 : 0)} fill={fila.critico ? "#c2703a" : "#536b91"} opacity={isActive ? 1 : .76} stroke="white" strokeWidth="3" />
                <text x={x(fila.dias)} y={y(fila.monto) + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{i + 1}</text>
              </g>;
            })}
          </svg>
          {seleccionado && <div className="mt-2 grid gap-2 rounded-2xl bg-[#16181d] p-4 text-white sm:grid-cols-[1fr_auto]">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Caso seleccionado</p><p className="mt-1 text-sm font-bold">{seleccionado.nombre}</p><p className="mt-1 text-[11px] text-white/70">{seleccionado.detalle} · {seleccionado.participacion.toFixed(1)}% del vencido</p></div>
            <p className="self-center text-xl font-bold tabular-nums">{fmt(seleccionado.monto)}</p>
          </div>}
          <p className="mt-3 text-[10px] text-tintaSuave">Cada burbuja es un cliente. Tamaño = exposición; eje horizontal = atraso; color naranja = aparece en mora crítica. Base de cartera vencida: {fmt(total)}.</p>
        </>
      )}
    </section>
  );
}
