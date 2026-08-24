"use client";

// Verificación contra Odoo — página secundaria, se llega con un clic desde
// /aging. Antes esta tabla completa vivía incrustada en la página principal
// de Aging; se movió acá siguiendo el mismo criterio que /aging/excluidas:
// la página principal muestra el número que importa a simple vista (la
// diferencia total), el desglose tramo por tramo vive en su propia página.

import Link from "next/link";
import { useEffect, useState } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { calcularAging } from "@/lib/calculos";
import { BUCKETS } from "@/lib/types";
import { BUCKET_INFO } from "@/lib/bucketInfo";
import { useApp } from "@/lib/store";
import { cargarComparacionOdoo, type ComparacionOdoo } from "@/lib/verificacionOdoo";

export default function PaginaVerificacionOdoo() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const [comparacion, setComparacion] = useState<ComparacionOdoo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dataset.fuente !== "odoo-real") return;
    let vigente = true;
    cargarComparacionOdoo()
      .then((c) => { if (vigente) setComparacion(c); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar la comparación."); });
    return () => { vigente = false; };
  }, [dataset.fuente]);

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const cartera = aging.totalClasificado + aging.saldoNoClasificable;
  // El dinero lo pinta el formateador del store: es el ÚNICO lugar donde una
  // cifra cambia de moneda, y lo hace al PINTAR. Todo lo de arriba (umbrales,
  // porcentajes, comparaciones, cuadres) se calculó en la moneda de registro y
  // no se entera de esta vista. Ver components/ControlMoneda.tsx.

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/aging" className="text-sm font-medium text-tintaSuave hover:text-tinta">
          ← Volver a Aging
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-tinta">Verificación contra Odoo</h1>
        <p className="mt-1 text-sm text-tintaSuave">
          Nuestro cálculo (por factura, desde <code>facturas.saldo_pendiente_odoo</code>) contra lo
          que Odoo ya declaró en &quot;Vencido por cobrar&quot; (por cliente, corte {fechaCorte}).
        </p>
      </div>

      {dataset.fuente !== "odoo-real" ? (
        <p className="text-sm text-tintaSuave">
          Esta comparación sólo aplica con datos reales (fuente actual: {dataset.fuente}).
        </p>
      ) : error ? (
        <p className="text-sm text-critico">
          <span aria-hidden className="mr-1.5 opacity-60">▲</span>
          No se pudo cargar la comparación: {error}
        </p>
      ) : !comparacion ? (
        <p className="text-[11.5px] text-[#a0a2a6]">Cargando saldos declarados por Odoo…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-tarjeta bg-white/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/80 bg-white/40 text-left text-[11px] font-semibold uppercase tracking-wide text-etapa">
                  <th className="px-5 py-3">Tramo</th>
                  <th className="px-5 py-3 text-right">App (por factura)</th>
                  <th className="px-5 py-3 text-right">Odoo declara</th>
                  <th className="px-5 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {BUCKETS.map((b) => {
                  const nuestro = aging.totalesPorBucket[b];
                  const odoo = comparacion.porBucket[b];
                  const dif = nuestro - odoo;
                  return (
                    <tr key={b} className="border-b border-white/70 last:border-0">
                      <td className="px-5 py-2.5 font-medium text-tinta">{BUCKET_INFO[b].etiqueta}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-tinta/80">{fmt(nuestro)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-tinta/80">{fmt(odoo)}</td>
                      <td className={`px-5 py-2.5 text-right tabular-nums font-semibold ${Math.abs(dif) < 1 ? "text-[#0F8B7B]" : "text-critico"}`}>
                        {dif >= 0 ? "+" : ""}{fmt(dif)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-white/40 font-semibold">
                  <td className="px-5 py-3 text-tinta">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums text-tinta">{fmt(cartera)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-tinta">{fmt(comparacion.total)}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${Math.abs(cartera - comparacion.total) < 1 ? "text-[#0F8B7B]" : "text-critico"}`}>
                    {cartera - comparacion.total >= 0 ? "+" : ""}{fmt(cartera - comparacion.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-relaxed text-[#a0a2a6]">
            La aritmética está verificada de forma independiente (2026-08-19): el total de la app,
            el total que declara Odoo, y la diferencia de {fmt(cartera - comparacion.total)} coinciden al centavo entre sí y contra el Excel
            original de Odoo. La CAUSA más probable de esa diferencia es que Odoo también
            descuenta, por cliente, pagos recibidos que todavía no están aplicados a una factura
            puntual — así suele operar Odoo. 🟡 Pero esa causa específica NO se pudo confirmar con
            los datos hoy disponibles: la tabla de pagos importada no distingue pagos aplicados de
            no aplicados (el 100% quedó marcado igual), así que no hay forma de aislar cuáles
            pagos explican exactamente este monto. Es una explicación plausible, no comprobada.
          </p>
        </>
      )}
    </div>
  );
}
