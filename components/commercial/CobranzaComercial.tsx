"use client";

import { useState } from "react";
import type {
  AgenteComercial,
  CargaResponsable,
  EtapaEmbudo,
  FilaPrioridadComercial,
  ProductividadResponsable,
} from "@/lib/commercial-cobranza";

export function AgentesComercialesCobranza({
  agentes,
  fmt,
}: {
  agentes: AgenteComercial[];
  fmt: (valor: number) => string;
}) {
  const tonos = {
    accion: { barra: "bg-[#536b91]", acento: "text-[#536b91]", fondo: "bg-[#eef2f9]" },
    atencion: { barra: "bg-[#c2703a]", acento: "text-[#b45f2c]", fondo: "bg-[#fdf3ed]" },
    control: { barra: "bg-slate-400", acento: "text-slate-600", fondo: "bg-slate-50" },
  } as const;

  return (
    <section className="border-y border-slate-200/80 bg-white/45 px-1 py-4 sm:px-2">
      <div className="flex flex-wrap items-end justify-between gap-3 px-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-etapa">
            Decisiones de cobranza
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-[-.025em] text-tinta">
            Lo que requiere gestión primero
          </h2>
        </div>
        <p className="text-right text-[10px] text-tintaSuave">cada señal abre su evidencia</p>
      </div>

      <div className={`mt-4 grid gap-px overflow-hidden rounded-[22px] border border-slate-200 bg-slate-200 md:grid-cols-2 ${agentes.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {agentes.map((agente, indice) => (
          <details
            key={agente.id}
            className="group min-w-0 bg-white p-4 transition hover:bg-slate-50 open:bg-slate-50"
            style={{ animationDelay: `${indice * 70}ms` }}
          >
            <summary className="cursor-pointer list-none">
              {(() => {
                const visual = agente.visual;
                const pct = visual && visual.total > 0 ? Math.max(0, Math.min(100, (visual.valor / visual.total) * 100)) : null;
                const tono = tonos[agente.estado];
                return <>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-[10px] font-bold uppercase tracking-[.12em] ${tono.acento}`}>{agente.nombre}</p>
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${tono.fondo} text-[12px] ${tono.acento}`} aria-hidden>{agente.estado === "accion" ? "→" : agente.estado === "atencion" ? "!" : "?"}</span>
                  </div>
                  <p className="mt-4 text-2xl font-extrabold tracking-tight tabular-nums text-tinta">{visual ? `${pct?.toFixed(0)}%` : "—"}</p>
                  <p className="mt-1 h-3 text-[9px] font-bold uppercase tracking-wider text-tintaSuave">{visual?.etiqueta ?? "dato no publicable"}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${tono.barra}`} style={{ width: `${pct ?? 0}%` }} /></div>
                  <p className="mt-3 text-[10px] font-semibold leading-snug text-tinta">{agente.accion}</p>
                  <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#536b91] group-open:hidden">ver evidencia ↘</p>
                </>;
              })()}
            </summary>
            <div className="mt-4 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-tintaSuave">
              <p><b className="text-tinta">Pregunta:</b> {agente.pregunta}</p>
              <p className="mt-1">{agente.respuesta}</p>
              {agente.impacto != null && (
                <p className="mt-2 font-bold tabular-nums text-tinta">Impacto observado: {fmt(agente.impacto)}</p>
              )}
              </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function BarrasRanking({
  filas,
  fmt,
  vacio = "No hay saldos para construir este ranking.",
}: {
  filas: { id: string; etiqueta: string; valor: number; meta?: string; acumuladoPct?: number }[];
  fmt: (valor: number) => string;
  vacio?: string;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const maximo = Math.max(...filas.map((fila) => fila.valor), 0);
  if (filas.length === 0 || maximo <= 0) {
    return <EstadoSinDatos texto={vacio} />;
  }

  return (
    <ol className="space-y-3">
      {filas.map((fila, indice) => (
        <li key={fila.id}>
        <button type="button" onClick={() => setSeleccionado(seleccionado === fila.id ? null : fila.id)} className={`grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-1.5 text-left transition ${seleccionado === fila.id ? "bg-[#edf1f8]" : "hover:bg-white/70"}`}>
          <span className="text-right text-[10px] font-bold tabular-nums text-etapa">{indice + 1}</span>
          <div className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <p className="truncate text-[12px] font-semibold text-tinta">{fila.etiqueta}</p>
              {fila.meta && <p className="shrink-0 text-[10px] text-tintaSuave">{fila.meta}</p>}
            </div>
            <div className="h-2 overflow-hidden rounded-pastilla bg-white/70">
              <div
                className="h-full rounded-pastilla bg-tinta transition-[width] duration-500"
                style={{ width: `${Math.max(2, (fila.valor / maximo) * 100)}%` }}
              />
            </div>
          </div>
          <div className="min-w-[106px] text-right">
            <p className="text-[12px] font-bold tabular-nums text-tinta">{fmt(fila.valor)}</p>
            {fila.acumuladoPct != null && (
              <p className="text-[9px] tabular-nums text-tintaSuave">
                {fila.acumuladoPct.toFixed(1)}% acum.
              </p>
            )}
          </div>
        </button>
        {seleccionado === fila.id && <p className="ml-9 mt-1 rounded-xl bg-white/80 px-3 py-2 text-[10px] leading-relaxed text-tintaSuave"><b className="text-tinta">{fila.etiqueta}</b> · {fmt(fila.valor)}. {fila.meta ?? "Sin metadato adicional registrado."}</p>}
        </li>
      ))}
    </ol>
  );
}

export function DistribucionResponsables({
  filas,
  fmt,
}: {
  filas: CargaResponsable[];
  fmt: (valor: number) => string;
}) {
  return (
    <BarrasRanking
      filas={filas.map((fila) => ({
        id: fila.responsable,
        etiqueta: fila.responsable,
        valor: fila.saldo,
        meta: `${fila.clientes} cliente(s)`,
      }))}
      fmt={fmt}
      vacio="No hay saldo vencido asignable a responsables."
    />
  );
}

export function CuadrantePrioridad({
  filas,
  medianaSaldo,
  medianaDias,
  fmt,
}: {
  filas: FilaPrioridadComercial[];
  medianaSaldo: number;
  medianaDias: number;
  fmt: (valor: number) => string;
}) {
  if (filas.length === 0) return <EstadoSinDatos texto="No hay cuentas abiertas para ubicar en el cuadrante." />;
  const ancho = 720;
  const alto = 330;
  const margen = { izquierda: 64, derecha: 24, arriba: 24, abajo: 46 };
  const areaAncho = ancho - margen.izquierda - margen.derecha;
  const areaAlto = alto - margen.arriba - margen.abajo;
  const maxDias = Math.max(...filas.map((fila) => fila.dias), 1);
  const maxSaldo = Math.max(...filas.map((fila) => fila.saldo), 1);
  const x = (dias: number) => margen.izquierda + (dias / maxDias) * areaAncho;
  const y = (saldo: number) => margen.arriba + areaAlto - (saldo / maxSaldo) * areaAlto;

  return (
    <div>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full"
        role="img"
        aria-label="Cuadrante de impacto monetario y días de atraso para las diez cuentas prioritarias"
      >
        <rect x={margen.izquierda} y={margen.arriba} width={areaAncho} height={areaAlto} rx="18" fill="rgba(255,255,255,.52)" />
        <rect x={x(medianaDias)} y={margen.arriba} width={ancho - margen.derecha - x(medianaDias)} height={Math.max(0, y(medianaSaldo) - margen.arriba)} fill="rgba(22,24,29,.055)" />
        <line x1={x(medianaDias)} x2={x(medianaDias)} y1={margen.arriba} y2={alto - margen.abajo} stroke="rgba(22,24,29,.16)" strokeDasharray="5 5" />
        <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(medianaSaldo)} y2={y(medianaSaldo)} stroke="rgba(22,24,29,.16)" strokeDasharray="5 5" />
        <text x={ancho - margen.derecha - 8} y={margen.arriba + 16} textAnchor="end" fontSize="11" fill="#6b7280">ALTO IMPACTO + ALTA URGENCIA</text>
        <text x={ancho / 2} y={alto - 12} textAnchor="middle" fontSize="11" fill="#6b7280">DÍAS MÁXIMOS DE ATRASO →</text>
        <text transform={`translate(16 ${alto / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#6b7280">SALDO ABIERTO →</text>
        {filas.map((fila, indice) => (
          <g key={fila.idCliente}>
            <circle
              cx={x(fila.dias)}
              cy={y(fila.saldo)}
              r={fila.enDisputa ? 12 : 14}
              fill={fila.enDisputa ? "#f59e0b" : "#16181d"}
              stroke="white"
              strokeWidth="3"
            >
              <title>{`${indice + 1}. ${fila.cliente}: ${fmt(fila.saldo)}, ${fila.dias} días, score ${fila.score}`}</title>
            </circle>
            <text x={x(fila.dias)} y={y(fila.saldo) + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">
              {indice + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {filas.map((fila, indice) => (
          <div key={fila.idCliente} className="flex min-w-0 items-center gap-2 text-[10.5px] text-tintaSuave">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${fila.enDisputa ? "bg-amber-500" : "bg-tinta"}`}>{indice + 1}</span>
            <span className="truncate font-semibold text-tinta">{fila.cliente}</span>
            <span className="ml-auto shrink-0 tabular-nums">{fmt(fila.saldo)} · {fila.dias} d</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-tintaSuave">
        Líneas punteadas = mediana observada del conjunto ({fmt(medianaSaldo)} y {Math.round(medianaDias)} días). El color ámbar identifica disputas; no representa probabilidad de cobro.
      </p>
    </div>
  );
}

export function EmbudoCobranza({ etapas }: { etapas: EtapaEmbudo[] }) {
  const base = Math.max(etapas[0]?.clientes ?? 0, 1);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {etapas.map((etapa, indice) => (
        <article key={etapa.id} className="relative overflow-hidden rounded-[18px] border border-white/90 bg-white/70 p-4 shadow-flotante">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white">
            <div className="h-full bg-tinta" style={{ width: `${(etapa.clientes / base) * 100}%` }} />
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tinta text-[10px] font-bold text-white">{indice + 1}</span>
            <span className="text-2xl font-bold tabular-nums text-tinta">{etapa.clientes}</span>
          </div>
          <p className="mt-3 text-[12px] font-bold text-tinta">{etapa.etiqueta}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-tintaSuave">{etapa.aclaracion}</p>
          {indice > 0 && (
            <p className="mt-2 text-[10px] font-semibold tabular-nums text-tinta">
              {base > 0 ? ((etapa.clientes / base) * 100).toFixed(0) : "0"}% del vencido
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

export function TablaProductividad({ filas }: { filas: ProductividadResponsable[] }) {
  if (filas.length === 0) {
    return <EstadoSinDatos texto="No hay gestiones sobre clientes vencidos para medir productividad. Se mostrará cuando se registren responsables y resultados." />;
  }
  return (
    <div className="overflow-x-auto rounded-[18px] border border-white/80 bg-white/65">
      <table className="w-full min-w-[620px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-white bg-white/60 text-[9px] font-bold uppercase tracking-[.09em] text-etapa">
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3 text-right">Gestiones</th>
            <th className="px-4 py-3 text-right">Clientes</th>
            <th className="px-4 py-3 text-right">Promesas</th>
            <th className="px-4 py-3 text-right">Conversión a promesa</th>
            <th className="px-4 py-3 text-right">Con pago posterior</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.responsable} className="border-b border-white/80 last:border-0">
              <td className="px-4 py-3 font-semibold text-tinta">{fila.responsable}</td>
              <td className="px-4 py-3 text-right tabular-nums text-tinta">{fila.gestiones}</td>
              <td className="px-4 py-3 text-right tabular-nums text-tinta">{fila.clientes}</td>
              <td className="px-4 py-3 text-right tabular-nums text-tinta">{fila.promesas}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-tinta">{fila.conversionPromesaPct.toFixed(0)}%</td>
              <td className="px-4 py-3 text-right tabular-nums text-tinta">{fila.clientesConPagoPosterior}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EstadoSinDatos({ texto }: { texto: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[rgba(22,24,29,.16)] bg-white/45 px-5 py-7 text-center text-[11px] leading-relaxed text-tintaSuave">
      {texto}
    </div>
  );
}
