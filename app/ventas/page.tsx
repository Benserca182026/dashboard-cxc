"use client";

// M8 — Ventas (Paso 11). El total de cada venta es Σ(cantidad × precio) de sus
// líneas — nunca un número tecleado. La franja de cuadre compara vendido contra
// facturado: cuadran por construcción, y si algún día difieren, se muestra el
// monto exacto del descuadre, no un booleano mudo.
//
// Reestructuración (M6): mismo esqueleto de "/" y "/aging". De arriba abajo:
// Encabezado con menú interno y BarraUsuario → el motor de argumentación
// propio de este módulo (argumentoVentas, con los agentes AGENTES_VENTAS
// asomados en el mordisco) → el detalle de ventas y el cruce de punta a
// punta, cada uno envuelto en el mismo LienzoConAgentes del resto.
//
// Si el dataset activo NO trae la cadena del Paso 11 (p. ej. un CSV solo-CxC
// importado), la página avisa en vez de mostrar ceros que parecerían datos —
// exactamente como antes.

import { useState } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BannerFicticioPremium, KpiPremiumCard } from "@/components/ResumenPremium";
import { fmtMoneda } from "@/lib/calculos";
import { cadenaDeFactura, cuadreVentasFacturacion, hayCadena, ventasConTotal, vinculoVentaFacturaDisponible } from "@/lib/cadena";
import { argumentoVentas } from "@/lib/argumento";
import { useApp } from "@/lib/store";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_VENTAS, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";

const SECCIONES_SIN_CADENA = [{ id: "sec-aviso", etiqueta: "Aviso" }];
const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-ventas", etiqueta: "Ventas" },
  { id: "sec-cruce", etiqueta: "Cruce end-to-end" },
];

export default function PaginaVentas() {
  const { dataset, cargando, fechaCorte } = useApp();
  const moneda = dataset.fuente === "odoo-real" ? "GTQ" : "USD";
  const fmt = (n: number) => fmtMoneda(n, moneda);
  const [abierta, setAbierta] = useState<string | null>("VTA-9003");
  const [facturaCruce, setFacturaCruce] = useState("FAC-1003");

  if (cargando) return <SkeletonPagina />;

  if (!hayCadena(dataset)) {
    return (
      <div className="space-y-6">
        <Encabezado titulo="Ventas" secciones={SECCIONES_SIN_CADENA} dataset={dataset} modulo="ventas" />
        <section id="sec-aviso" className="scroll-mt-24">
          <div className="tarjeta-flotante entrada-suave p-8 text-center text-sm text-tintaSuave">
            Este dataset no trae la cadena de ventas (fuente: {dataset.fuente}).
            El módulo avisa en vez de mostrar ceros que parecerían datos — no se puede
            calcular ningún KPI de este módulo sin inventar cifras.
          </div>
        </section>
      </div>
    );
  }

  const argumento = argumentoVentas(dataset);
  const ventas = ventasConTotal(dataset);
  const totalVendido = ventas.reduce((s, v) => s + v.total, 0);
  const margenTotal = ventas.reduce((s, v) => s + v.margen, 0);
  const cuadre = cuadreVentasFacturacion(dataset);
  const cadena = cadenaDeFactura(dataset, facturaCruce, fmt);
  const facturasConVenta = dataset.facturas.filter((f) => f.id_venta);
  const vinculoDisponible = vinculoVentaFacturaDisponible(dataset);

  // ── Las cifras de los cuatro anillos — las mismas que arma el argumento. ──
  const mayorVenta = [...ventas].sort((a, b) => b.total - a.total)[0] ?? null;
  const pctMayorVenta = mayorVenta && totalVendido > 0 ? (mayorVenta.total / totalVendido) * 100 : 0;
  const mayorMargen = [...ventas].sort((a, b) => b.margen - a.margen)[0] ?? null;
  const pctMayorMargen = mayorMargen && margenTotal > 0 ? (mayorMargen.margen / margenTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones de acá hablan de ventas, no de cartera general. */}
      <Encabezado titulo="Ventas" secciones={SECCIONES} dataset={dataset} modulo="ventas" />

      {/* El motor de argumentación del módulo: ¿vendido y facturado cuadran,
          cuál venta pesa más, se concentra el margen, y qué se sigue de eso?
          argumento nunca es null acá porque ya se filtró !hayCadena arriba. */}
      {argumento && (
        <section id="sec-argumento" className="scroll-mt-24">
          <RecorridoArgumental
            rotulo="El caso de las ventas"
            arg={argumento}
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_VENTAS} />}
            kpis={[
              {
                etiqueta: "vendido · cuadre con lo facturado",
                valor: fmt(cuadre.totalVendido),
                pct: cuadre.totalVendido > 0 ? Math.min(100, (cuadre.totalFacturado / cuadre.totalVendido) * 100) : 0,
              },
              {
                etiqueta: "venta líder · de lo vendido",
                valor: mayorVenta ? fmt(mayorVenta.total) : "—",
                pct: pctMayorVenta,
              },
              {
                etiqueta: "mayor margen · del margen total",
                valor: mayorMargen ? fmt(mayorMargen.margen) : "—",
                pct: pctMayorMargen,
              },
              {
                etiqueta: "margen bruto · sobre lo vendido",
                valor: fmt(margenTotal),
                pct: totalVendido > 0 ? (margenTotal / totalVendido) * 100 : 0,
              },
            ]}
          />
        </section>
      )}

      {/* Detalle de ventas: mismos KPI de resumen, mismo acordeón con líneas
          (cantidad × precio, costo y margen), sin cambios de comportamiento. */}
      <section id="sec-ventas" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Ventas del período"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_VENTAS} />}
        >
          <div
            className={`entrada-suave rounded-tarjeta border px-5 py-3.5 text-sm ${
              cuadre.cuadra
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {cuadre.cuadra ? (
              <>✓ <b>Ventas y facturación cuadran</b> — vendido {fmt(cuadre.totalVendido)} = facturado {fmt(cuadre.totalFacturado)}.</>
            ) : (
              <>✗ <b>DESCUADRE de {fmt(Math.abs(cuadre.diferencia))}</b> — vendido {fmt(cuadre.totalVendido)} contra facturado {fmt(cuadre.totalFacturado)}. La cadena se rompió: hay ventas sin factura o facturas sin venta.</>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiPremiumCard etiqueta="Total vendido" valor={fmt(totalVendido)} nota={`${ventas.length} ventas confirmadas`} variante="soft" />
            <KpiPremiumCard
              etiqueta="Margen bruto"
              valor={fmt(margenTotal)}
              nota={`${totalVendido > 0 ? Math.round((margenTotal / totalVendido) * 100) : 0}% — sin costo por línea se vende sin saber si se gana`}
              variante="cool"
            />
            <KpiPremiumCard etiqueta="Ticket promedio" valor={fmt(ventas.length ? totalVendido / ventas.length : 0)} nota="total ÷ cantidad de ventas" variante="soft" />
            <KpiPremiumCard
              etiqueta="Ventas con factura"
              valor={`${ventas.filter((v) => v.id_factura).length}/${ventas.length}`}
              tono={!vinculoDisponible || ventas.every((v) => v.id_factura) ? "normal" : "alerta"}
              nota={
                !vinculoDisponible
                  ? "vínculo venta↔factura no disponible en este export de Odoo — no es una alarma de negocio, es un límite de la fuente de datos"
                  : "una venta sin factura es cadena rota"
              }
              variante="warm"
            />
          </div>

          <p className="mb-2 mt-5 text-[11.5px] leading-snug text-[#85878c]">
            Clic abre las líneas: cantidad × precio sumando el total, con su costo y su margen.
          </p>

          <div className="space-y-2.5">
            {ventas.map((v, i) => {
              const estaAbierta = abierta === v.id_venta;
              return (
                <div
                  key={v.id_venta}
                  className={`entrada-suave rounded-tarjeta transition-shadow ${
                    estaAbierta
                      ? "border border-white/90 bg-white/80 shadow-flotanteAlta"
                      : "border border-white/70 bg-white/55 shadow-flotante"
                  }`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <button
                    onClick={() => setAbierta(estaAbierta ? null : v.id_venta)}
                    aria-expanded={estaAbierta}
                    className="grid w-full grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-tarjeta px-4 py-3.5 text-left transition hover:bg-white/60 sm:gap-6"
                  >
                    <span className="font-mono text-xs text-tintaSuave">{v.id_venta}</span>
                    <span className="text-sm font-semibold text-tinta">
                      {v.cliente}
                      <span className="ml-2 text-xs font-normal text-tintaSuave">{v.fecha}</span>
                    </span>
                    <span className="hidden text-xs text-tintaSuave sm:block">
                      {v.id_factura ? <span className="font-mono">{v.id_factura}</span> : <span className="font-bold text-red-600">SIN FACTURA</span>}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-tinta">{fmt(v.total)}</span>
                    <span
                      className={`text-[11px] transition ${
                        estaAbierta ? "pastilla-activa px-2 py-0.5 opacity-90" : "text-tintaSuave opacity-45"
                      }`}
                    >
                      {estaAbierta ? "▾" : "▸"}
                    </span>
                  </button>

                  {estaAbierta && (
                    <div className="border-t border-black/[.06] px-4 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-borde/60 text-left text-[10px] uppercase tracking-wide text-tintaSuave">
                            <th className="py-1.5 pr-3 font-semibold">Producto</th>
                            <th className="py-1.5 pr-3 text-right font-semibold">Cantidad</th>
                            <th className="py-1.5 pr-3 text-right font-semibold">Precio</th>
                            <th className="py-1.5 pr-3 text-right font-semibold">Importe</th>
                            <th className="py-1.5 text-right font-semibold">Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.lineas.map((l, j) => (
                            <tr key={j} className="border-b border-borde/30 last:border-0">
                              <td className="py-1.5 pr-3"><span className="font-mono text-tintaSuave">{l.sku}</span> {l.producto}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{l.cantidad}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(l.precio)}</td>
                              <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{fmt(l.importe)}</td>
                              <td className="py-1.5 text-right tabular-nums text-emerald-700">{fmt(l.importe - l.costo)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-borde/60 font-bold">
                            <td className="py-1.5 pr-3">Total (suma exacta de las líneas)</td>
                            <td className="py-1.5 pr-3" colSpan={2} />
                            <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(v.total)}</td>
                            <td className="py-1.5 text-right tabular-nums text-emerald-700">
                              {fmt(v.margen)} ({v.margenPct}%)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
            <BannerFicticioPremium fuente={dataset.fuente} />
          </div>
        </LienzoConAgentes>
      </section>

      {/* El cruce: una operación seguida por los tres módulos, sin cambios. */}
      <section id="sec-cruce" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Una operación de punta a punta"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_VENTAS} />}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11.5px] leading-snug text-[#85878c]">
              Tres capturas de tres módulos probarían que hay tres pantallas. Sólo el recorrido
              continuo de un mismo hecho prueba que el modelo es UNO.
            </p>
            <select
              value={facturaCruce}
              onChange={(e) => setFacturaCruce(e.target.value)}
              className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-1.5 text-xs text-tinta shadow-flotante"
            >
              {facturasConVenta.map((f) => (
                <option key={f.id_factura} value={f.id_factura}>{f.numero_factura}</option>
              ))}
            </select>
          </div>

          {cadena && (
            <>
              <ol className="mt-4 flex flex-wrap items-stretch gap-x-1 gap-y-4">
                {cadena.pasos.map((p, i) => (
                  <li key={i} className="flex items-stretch gap-1">
                    <div
                      className="entrada-suave flex w-[188px] flex-col"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <div className="tarjeta-calada flex h-full flex-col gap-1.5 px-3.5 py-3">
                        <div className="flex items-center justify-between text-[10px] text-tintaSuave">
                          <span className="tabular-nums">{p.fecha}</span>
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 rounded-pastilla ${
                              p.modulo === "Inventario"
                                ? "bg-teal-600"
                                : p.modulo === "Ventas"
                                  ? "bg-indigo-600"
                                  : "bg-amber-600"
                            }`}
                          />
                        </div>
                        <p className="text-xs leading-snug text-tinta">{p.hecho}</p>
                        {p.monto && (
                          <p className="mt-auto pt-1 text-sm font-bold tabular-nums text-tinta">{p.monto}</p>
                        )}
                      </div>
                      <p className="etiqueta-fase mt-2 px-1">{p.modulo}</p>
                    </div>
                    {i < cadena.pasos.length - 1 && (
                      <span aria-hidden className="flex items-center px-1 text-sm text-conector">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>

              <div
                className="entrada-suave mt-6 flex flex-wrap gap-x-10 gap-y-3 px-5 py-4 text-xs text-white/70"
                style={{ background: "#16181d", borderRadius: 22, animationDelay: "260ms" }}
              >
                <p>
                  <span className="mr-1.5 opacity-40">◆</span>
                  <b className="font-semibold text-white">Ciclo de conversión:</b>{" "}
                  {cadena.cicloDias === null ? "sin cobro todavía" : `${cadena.cicloDias} días entre entrar a bodega y cobrar`}
                </p>
                <p>
                  <span className="mr-1.5 opacity-40">✓</span>
                  <b className="font-semibold text-white">Saldo hoy:</b>{" "}
                  <span className="tabular-nums text-white">{fmt(cadena.saldoHoy)}</span> — el mismo que deriva CxC
                </p>
              </div>
            </>
          )}
        </LienzoConAgentes>
      </section>
    </div>
  );
}
