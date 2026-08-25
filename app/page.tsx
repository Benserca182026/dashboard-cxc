"use client";

import { SkeletonPagina } from "@/components/Basicos";
import { AgingRow, BannerFicticioPremium, PanelAging } from "@/components/ResumenPremium";
import { Encabezado } from "@/components/Encabezado";
import { EjecutivoPanel } from "@/components/commercial/EjecutivoPanel";
import { calcularAging } from "@/lib/calculos";
import { BUCKETS } from "@/lib/types";
import { useApp } from "@/lib/store";

const SECCIONES = [
  { id: "sec-pulso", etiqueta: "Pulso" },
  { id: "sec-impacto", etiqueta: "Top impacto" },
  { id: "sec-acciones", etiqueta: "Acciones" },
  { id: "sec-antiguedad", etiqueta: "Antigüedad" },
];

export default function PaginaResumen() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;

  return (
    <div className="space-y-6">
      <Encabezado titulo="Centro de decisiones" secciones={SECCIONES} dataset={dataset} />

      <EjecutivoPanel />

      <section id="sec-antiguedad" className="lienzo-referencia scroll-mt-24 entrada-suave">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#778198]">Contexto de cartera</p>
            <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-tinta">Distribución por antigüedad</h2>
            <p className="mt-1 text-[11px] text-[#7c808a]">
              Vista secundaria para explicar el Top de impacto; los rankings y las acciones permanecen arriba.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">Cartera total pendiente</p>
            <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-tinta">{fmt(carteraTotal)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/70 bg-white/45 p-4">
          <PanelAging
            titulo=""
            nota={`La suma de los buckets (${fmt(aging.totalClasificado)}) cubre solo facturas clasificables.`}
          >
            {BUCKETS.map((bucket) => {
              const monto = aging.totalesPorBucket[bucket];
              const pct = aging.totalClasificado > 0 ? (monto / aging.totalClasificado) * 100 : 0;
              return (
                <AgingRow
                  key={bucket}
                  bucket={bucket}
                  monto={monto}
                  pct={pct}
                  fmtMoneda={fmt}
                />
              );
            })}
            <div className="mt-5 border-t border-[rgba(22,24,29,.07)] pt-4">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">Procedencia</p>
              <p className="mt-1 text-[11.5px] leading-snug text-[#85878c]">
                Fecha de corte: {fechaCorte} · Fuente: {dataset.fuente}
              </p>
              <div className="mt-3">
                <BannerFicticioPremium fuente={dataset.fuente} />
              </div>
            </div>
          </PanelAging>
        </div>
      </section>
    </div>
  );
}
