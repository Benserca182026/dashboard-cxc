"use client";

import { useMemo, useState } from "react";
import type { FilaImpactoEjecutivo } from "@/lib/commercial-ejecutivo";
import type { AnaliticaVentas } from "@/lib/commercial-operacion";

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
  // La ancla siempre es el dato real. Sólo se desplaza la representación para
  // evitar que dos clientes con coordenadas cercanas se oculten mutuamente.
  const posiciones = useMemo(() => {
    const ocupadas: { x: number; y: number; r: number }[] = [];
    const candidatos = [{ x: 0, y: 0 }];
    for (let anillo = 1; anillo <= 7; anillo += 1) {
      const radio = anillo * 15;
      const pasos = Math.max(8, anillo * 8);
      for (let paso = 0; paso < pasos; paso += 1) {
        const angulo = (paso / pasos) * Math.PI * 2;
        candidatos.push({ x: Math.cos(angulo) * radio, y: Math.sin(angulo) * radio });
      }
    }
    return filas.map((fila) => {
      const r = 10 + Math.sqrt(fila.monto / maxMonto) * 14;
      const anclaX = x(fila.dias);
      const anclaY = y(fila.monto);
      const candidato = candidatos.find((desplazamiento) => {
        const px = Math.max(64 + r, Math.min(714 - r, anclaX + desplazamiento.x));
        const py = Math.max(28 + r, Math.min(252 - r, anclaY + desplazamiento.y));
        return ocupadas.every((ocupada) => Math.hypot(px - ocupada.x, py - ocupada.y) >= r + ocupada.r + 6);
      }) ?? candidatos.at(-1)!;
      const px = Math.max(64 + r, Math.min(714 - r, anclaX + candidato.x));
      const py = Math.max(28 + r, Math.min(252 - r, anclaY + candidato.y));
      ocupadas.push({ x: px, y: py, r });
      return { id: fila.id, anclaX, anclaY, x: px, y: py, r };
    });
  }, [filas, maxMonto, maxDias]);
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
              const posicion = posiciones[i];
              const isActive = seleccionado?.id === fila.id;
              return <g key={fila.id} className="cursor-pointer" onClick={() => setActivo(fila.id)} onMouseEnter={() => setActivo(fila.id)}>
                <circle cx={posicion.anclaX} cy={posicion.anclaY} r="2.5" fill="#687487" opacity=".6" />
                {(posicion.x !== posicion.anclaX || posicion.y !== posicion.anclaY) && <line x1={posicion.anclaX} y1={posicion.anclaY} x2={posicion.x} y2={posicion.y} stroke="#8792a5" strokeWidth="1.25" strokeDasharray="3 3" />}
                <circle cx={posicion.x} cy={posicion.y} r={posicion.r + (isActive ? 4 : 0)} fill={fila.critico ? "#c2703a" : "#536b91"} opacity={isActive ? 1 : .84} stroke="white" strokeWidth="3" />
                <text x={posicion.x} y={posicion.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">{i + 1}</text>
              </g>;
            })}
          </svg>
          {seleccionado && <div className="mt-2 grid gap-2 rounded-2xl bg-[#16181d] p-4 text-white sm:grid-cols-[1fr_auto]">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Caso seleccionado</p><p className="mt-1 text-sm font-bold">{seleccionado.nombre}</p><p className="mt-1 text-[11px] text-white/70">{seleccionado.detalle} · {seleccionado.participacion.toFixed(1)}% del vencido</p></div>
            <p className="self-center text-xl font-bold tabular-nums">{fmt(seleccionado.monto)}</p>
          </div>}
          <p className="mt-3 text-[10px] text-tintaSuave">Cada burbuja es un cliente. Punto gris = coordenada real; línea punteada = separación visual por colisión. Tamaño = exposición; eje horizontal = atraso; naranja = mora crítica. Base: {fmt(total)}.</p>
        </>
      )}
    </section>
  );
}

export function ResumenVentasEjecutivo({
  ventas,
  fmt,
}: {
  ventas: AnaliticaVentas;
  fmt: (n: number) => string;
}) {
  const [activo, setActivo] = useState<string | null>(null);
  const puntos = ventas.tendencia.slice(-8);
  const maximo = Math.max(1, ...puntos.map((p) => p.valor));
  const seleccion = puntos.find((p) => p.periodo === activo) ?? puntos.at(-1);
  const anioActual = ventas.tendencia.at(-1)?.periodo.slice(0, 4) ?? null;
  const totalAnioActual = anioActual
    ? ventas.tendencia.filter((punto) => punto.periodo.startsWith(anioActual)).reduce((suma, punto) => suma + punto.valor, 0)
    : 0;
  if (!ventas.disponible) return null;
  return (
    <section className="rounded-[28px] border border-white/90 bg-white/70 p-5 shadow-flotante">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#796de0]">Ventas · contexto comercial separado</p>
          <h3 className="mt-1 text-base font-bold text-tinta">La señal comercial debajo de la cobranza</h3>
        </div>
        <a href="/ventas" className="rounded-full bg-[#edf1f8] px-3 py-1.5 text-[10px] font-semibold text-[#536b91] hover:bg-white">abrir Ventas ↗</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-[#f4f6fb] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Total histórico</p><p className="mt-1 text-lg font-extrabold tabular-nums text-tinta">{fmt(ventas.vendidoOdoo)}</p><p className="mt-1 text-[9px] text-tintaSuave">{ventas.desde ?? "—"} → {ventas.hasta ?? "—"}</p></div>
        <div className="rounded-2xl bg-[#f0eefc] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#796de0]">Acumulado {anioActual ?? "actual"}</p><p className="mt-1 text-lg font-extrabold tabular-nums text-tinta">{fmt(totalAnioActual)}</p><p className="mt-1 text-[9px] text-tintaSuave">suma de los meses mostrados</p></div>
        <div className="rounded-2xl bg-[#f4f6fb] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Top 5 clientes</p><p className="mt-1 text-lg font-extrabold tabular-nums text-tinta">{ventas.concentracionTop5 === null ? "—" : `${ventas.concentracionTop5.toFixed(1)}%`}</p></div>
        <div className="rounded-2xl bg-[#f4f6fb] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">MTD comparable</p><p className="mt-1 text-lg font-extrabold tabular-nums text-tinta">{ventas.variacionUltimoPeriodo === null ? "—" : `${ventas.variacionUltimoPeriodo >= 0 ? "▲" : "▼"} ${Math.abs(ventas.variacionUltimoPeriodo).toFixed(1)}%`}</p></div>
      </div>
      {puntos.length > 0 && <div className="mt-5 flex h-24 items-end gap-2" role="img" aria-label="Tendencia reciente de ventas registradas">
        {puntos.map((p) => <button key={p.periodo} type="button" onClick={() => setActivo(p.periodo)} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5" aria-label={`${p.periodo}: ${fmt(p.valor)}`}>
          <span className="hidden text-[9px] font-semibold tabular-nums text-tinta group-hover:block sm:block">{fmt(p.valor)}</span>
          <span className={`w-full rounded-t-lg transition ${seleccion?.periodo === p.periodo ? "bg-[#796de0]" : "bg-[#c6c0f5] hover:bg-[#9b91e7]"}`} style={{ height: `${Math.max(6, (p.valor / maximo) * 64)}px` }} />
          <span className="text-[9px] text-tintaSuave">{p.periodo.slice(5)}</span>
        </button>)}
      </div>}
      <p className="mt-3 text-[10px] text-tintaSuave">Histórico = toda la ventana {ventas.desde ?? "—"} a {ventas.hasta ?? "—"}; acumulado = sólo {anioActual ?? "el año de la última serie"}. Es contexto comercial: no altera cartera, aging ni las posiciones del mapa.</p>
    </section>
  );
}
