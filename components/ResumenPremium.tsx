"use client";

// Componentes premium exclusivos de "Resumen de cartera" (piloto de
// auditoria-visual-worklio-cxc.md, sección 2 y 8). No se reutilizan en otras
// pantallas — Basicos.tsx (KpiCard, BannerFicticio) queda intacto para el
// resto del dashboard, así ningún otro módulo cambia de apariencia.
//
// REFERENCIA ACTUAL (2026-08-17): "Customer Journey CRM Dashboard",
// RonDesignLab — dribbble.com/shots/24659454. Reemplaza a la referencia
// Worklio anterior. Rasgos adoptados: tarjetas BLANCAS TRANSLÚCIDAS con blur
// flotando sobre gris claro, esquinas 22px, UNA sola tarjeta negra como acento,
// íconos chicos dentro de las tarjetas. Se eliminaron los degradados de color
// (coral/turquesa) porque no pertenecen a esta referencia: aquí el color entra
// por acento puntual, no por fondo de tarjeta.

import React from "react";

export function HeroResumen({
  titulo,
  descripcion,
  kpiEtiqueta,
  kpiValor,
  kpiNota,
  children,
}: {
  titulo: string;
  descripcion: string;
  kpiEtiqueta: string;
  kpiValor: string;
  kpiNota?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="tarjeta-flotante p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tintaSuave">
            Cartera
          </p>
          <h1 className="mt-1 text-2xl font-bold text-tinta sm:text-[28px]">
            {titulo}
          </h1>
          <p className="mt-2 max-w-md text-sm text-tintaSuave">{descripcion}</p>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-xs font-medium text-tintaSuave">{kpiEtiqueta}</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-tinta sm:text-5xl">
            {kpiValor}
          </p>
          {kpiNota && (
            <p className="mt-1 text-xs text-tintaSuave sm:max-w-[220px]">
              {kpiNota}
            </p>
          )}
        </div>
      </div>

      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function BannerFicticioPremium({
  fuente,
}: {
  /** Sin prop: se asume ficticio (comportamiento previo, no rompe llamadas viejas). */
  fuente?: "demo-ficticio" | "csv-importado" | "odoo-real";
}) {
  if (fuente === "odoo-real") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 backdrop-blur">
        <span aria-hidden className="mt-0.5 text-base">
          ✓
        </span>
        <p>
          <b className="font-semibold">Datos reales de Benserca 18.</b> Cargados desde Odoo —
          nombres, montos y fechas corresponden a la empresa real.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 backdrop-blur">
      <span aria-hidden className="mt-0.5 text-base">
        ⚠️
      </span>
      <p>
        <b className="font-semibold">Datos 100% ficticios.</b> Ningún nombre,
        monto o fecha corresponde a una empresa real.
      </p>
    </div>
  );
}

// En la referencia NO hay tarjetas de colores: hay tarjetas blancas
// translúcidas y UNA sola negra como acento de acción. Los nombres de variante
// se conservan para no romper las llamadas existentes.
const VARIANTES = {
  cool: "tarjeta-flotante text-tinta",
  warm: "tarjeta-flotante text-tinta",
  soft: "tarjeta-flotante text-tinta",
  acento: "text-white",
} as const;

export function KpiPremiumCard({
  etiqueta,
  valor,
  nota,
  tono = "normal",
  variante = "soft",
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: "normal" | "alerta" | "critico" | "simulado";
  variante?: keyof typeof VARIANTES;
}) {
  const colorValor =
    tono === "critico"
      ? "text-critico"
      : tono === "alerta"
        ? "text-alerta"
        : tono === "simulado"
          ? "text-simulado"
          : "text-tinta";

  return (
    <div
      className={`p-5 ${VARIANTES[variante]}`}
      style={variante === "acento" ? { background: "#16181d", borderRadius: 22, boxShadow: "0 12px 32px rgba(22,24,29,.24)" } : undefined}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-tintaSuave">
        <span aria-hidden className="text-[11px] opacity-60">
          {tono === "critico" ? "▲" : tono === "alerta" ? "◆" : "✓"}
        </span>
        {etiqueta}
      </p>
      <p className={`mt-2 text-[26px] font-bold leading-none ${colorValor}`}>
        {valor}
      </p>
      {nota && <p className="mt-2 text-xs text-tintaSuave">{nota}</p>}
    </div>
  );
}

export function PanelAging({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="tarjeta-flotante p-6"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(23,32,51,.045) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        backgroundPosition: "-4px -4px",
      }}
    >
      <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
      <div className="mt-4 space-y-3">{children}</div>
      {nota && <p className="mt-4 text-xs text-tintaSuave">{nota}</p>}
    </section>
  );
}

export function AgingRow({
  bucket,
  monto,
  pct,
  fmtMoneda,
}: {
  bucket: string;
  monto: number;
  pct: number;
  fmtMoneda: (n: number) => string;
}) {
  // La escala vive en la paleta del tablero, no en la de un semáforo: el mismo
  // azul de la piel, oscureciéndose a medida que la deuda envejece. El verde y
  // los naranjas que había antes venían de otro sistema y rompían la página.
  const color =
    bucket === "90+"
      ? "bg-[#16181d]"
      : bucket === "61-90"
        ? "bg-[#2c3d63]"
        : bucket === "31-60"
          ? "bg-[#4f6795]"
          : bucket === "1-30"
            ? "bg-[#8fa4c8]"
            : "bg-[#b9c7dd]";

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="w-14 shrink-0 text-xs font-medium text-tintaSuave">
        {bucket}
      </span>
      <div className="h-6 flex-1 overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-borde/70">
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-tinta">
        {fmtMoneda(monto)}
      </span>
    </div>
  );
}
