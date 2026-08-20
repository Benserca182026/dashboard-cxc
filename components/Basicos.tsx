"use client";

// Componentes base reutilizables: tarjeta KPI, banners de datos ficticios y
// simulados, y estados de carga/vacío/error. Patrón visual de tarjetas KPI
// (label + valor grande + nota secundaria) tomado como concepto de la
// referencia visual, implementación propia.

import React from "react";

export function KpiCard({
  etiqueta,
  valor,
  nota,
  tono = "normal",
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: "normal" | "alerta" | "critico" | "simulado";
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
    <div className="rounded-xl border border-borde bg-tarjeta p-4">
      <p className="text-xs font-medium text-tintaSuave">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold ${colorValor}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-tintaSuave">{nota}</p>}
    </div>
  );
}

export function BannerFicticio() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      ⚠️ <b>Datos 100% ficticios.</b> Ningún nombre, monto o fecha corresponde a
      una empresa real.
    </div>
  );
}

export function BannerSimulado({ supuestos }: { supuestos: string[] }) {
  return (
    <div className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <p className="font-semibold">
        🟣 SIMULACIÓN — pendiente de validación por Finanzas
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
        {supuestos.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-borde ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonPagina() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="rounded-xl border border-dashed border-borde bg-tarjeta p-10 text-center text-sm text-tintaSuave">
      {mensaje}
    </div>
  );
}

export function EstadoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-center">
      <p className="text-sm font-semibold text-critico">{mensaje}</p>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="mt-3 rounded-lg border border-borde bg-tarjeta px-4 py-2 text-sm hover:bg-fondo"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function TituloPagina({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold text-tinta">{titulo}</h1>
      {descripcion && <p className="mt-1 text-sm text-tintaSuave">{descripcion}</p>}
    </div>
  );
}

export function EtiquetaEstado({ estado }: { estado: string }) {
  const estilos: Record<string, string> = {
    abierta: "bg-blue-50 text-blue-800 border-blue-200",
    pagada: "bg-emerald-50 text-emerald-800 border-emerald-200",
    disputada: "bg-amber-50 text-amber-900 border-amber-300",
    anulada: "bg-gray-100 text-gray-600 border-gray-300",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        estilos[estado] ?? "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {estado}
    </span>
  );
}
