"use client";

// M8 — Ventas (Paso 11).
//
// Regla de procedencia (2026-08-23): cada número declara de qué capa viene.
//   TOTAL VENDIDO  -> ventas.total_odoo_referencia (capa "hecho", descuento ya
//                    aplicado por Odoo). Solo pedidos en estado "sale".
//   A precio de lista -> Sigma(cantidad x precio) de las líneas (capa
//                    "composicion"). El export de líneas NO trae la columna
//                    descuento, así que esa suma no es lo vendido, y todo lo
//                    que salga de ella se rotula "a precio de lista".
// El tipo Cifra<C> (lib/types.ts) impide sumar o dividir entre capas.
//
// El MARGEN BRUTO se retiró de esta página. Con el descuento ausente, el
// "margen" que salía de las líneas era precio de lista - costo: no un margen
// sesgado, sino otra magnitud con el nombre equivocado. Vuelve cuando el
// export traiga el descuento.
//
// La franja de cuadre compara vendido contra facturado y queda como estaba:
// son poblaciones distintas (pedidos contra facturas) y esa comparación es la
// que quiere hacer.
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
import {
  brechaEntreCapas,
  cadenaDeFactura,
  cuadreVentasFacturacion,
  hayCadena,
  totalAPrecioDeLista,
  totalVendidoReferencia,
  ventasConTotal,
  vinculoVentaFacturaDisponible,
} from "@/lib/cadena";
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

  // Capa "hecho": el total vendido. Sale de la referencia de Odoo, no de las líneas.
  const vendido = totalVendidoReferencia(dataset);
  // Capa "composicion": todo lo reconstruido desde las líneas, a precio de lista.
  const lista = totalAPrecioDeLista(dataset);
  // La única lectura que cruza las dos capas — y lo que produce es la distancia entre ellas.
  const brecha = brechaEntreCapas(dataset);

  const cuadre = cuadreVentasFacturacion(dataset);
  const cadena = cadenaDeFactura(dataset, facturaCruce, fmt);
  const facturasConVenta = dataset.facturas.filter((f) => f.id_venta);
  const vinculoDisponible = vinculoVentaFacturaDisponible(dataset);

  // ── Las cifras de los anillos ──
  // La venta líder sale de líneas, así que su reparto se calcula contra el
  // total de líneas: numerador y denominador de la MISMA capa. El tipo no
  // dejaría hacerlo de otra forma (porcentajeDe exige la misma Cifra<C>).
  const mayorVenta = [...ventas].sort((a, b) => b.total - a.total)[0] ?? null;
  const pctMayorVenta = mayorVenta ? mayorVenta.totalLista.porcentajeDe(lista.total) ?? 0 : 0;
  const ticketPromedioLista = lista.total.entre(lista.ventas);

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
          <p className="mb-2 px-1 text-[11.5px] leading-snug text-[#85878c]">
            Aviso de procedencia: el recorrido de abajo todavía arma sus cifras desde las líneas
            (capa composición, a precio de lista), incluido lo que llama margen. El total vendido
            de esta página, en cambio, sale de la referencia de Odoo. Mientras la banda de brecha
            esté visible, esas dos lecturas no son comparables.
          </p>
          <RecorridoArgumental
            rotulo="El caso de las ventas"
            arg={argumento}
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_VENTAS} />}
            kpis={[
              {
                etiqueta: "vendido a precio de lista · cuadre con lo facturado",
                valor: fmt(cuadre.totalVendido),
                pct: cuadre.totalVendido > 0 ? Math.min(100, (cuadre.totalFacturado / cuadre.totalVendido) * 100) : 0,
              },
              {
                etiqueta: "venta líder · del total a precio de lista",
                valor: mayorVenta ? fmt(mayorVenta.total) : "—",
                pct: pctMayorVenta,
              },
              {
                etiqueta: "total vendido · referencia Odoo (capa hecho)",
                valor: fmt(vendido.total.valorParaMostrar()),
                pct: 100,
              },
              {
                etiqueta: "brecha líneas vs referencia · del total vendido",
                valor: fmt(brecha.brecha),
                pct: Math.min(100, Math.abs(brecha.brechaPct ?? 0)),
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

          {/* La brecha entre capas, MEDIDA. No es una advertencia redactada: son
              los dos totales y su distancia. Desaparece sola cuando la brecha
              cae bajo la tolerancia (0.1% de la referencia) — nadie la borra. */}
          {!brecha.dentroDeTolerancia && (
            <div className="entrada-suave mt-4 rounded-tarjeta border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <p className="font-semibold">
                Dos capas, dos totales — brecha de {fmt(brecha.brecha)}
                {brecha.brechaPct !== null && <> ({Math.round(brecha.brechaPct)}% de la referencia)</>}
              </p>
              <div className="mt-2 grid gap-x-8 gap-y-1 text-[12.5px] sm:grid-cols-2">
                <p>
                  <b>Líneas (a precio de lista):</b>{" "}
                  <span className="tabular-nums">{fmt(brecha.lista)}</span> — {brecha.lineas} líneas de {brecha.ventas} pedidos
                </p>
                <p>
                  <b>Referencia Odoo (hecho):</b>{" "}
                  <span className="tabular-nums">{fmt(brecha.referencia)}</span> — {vendido.pedidos} pedidos
                </p>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug">
                Causa conocida: el export de líneas de Odoo (sale.order.line) no trae la columna
                descuento — no existe ni en el esquema ni en los datos. Por eso las líneas quedan a
                precio de lista y suman de más. El descuento NO se reconstruye acá: sólo una parte
                de los pedidos cae en escalones limpios, y rellenar el resto sería inventar un
                descuento que nadie otorgó. Esta banda se apaga sola cuando la brecha baje de{" "}
                {fmt(brecha.tolerancia)}.
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiPremiumCard
              etiqueta="Total vendido"
              valor={fmt(vendido.total.valorParaMostrar())}
              nota={`${vendido.pedidos} pedidos en estado sale · ventas.total_odoo_referencia (descuento ya aplicado por Odoo)`}
              variante="soft"
            />
            <KpiPremiumCard
              etiqueta="A precio de lista"
              valor={fmt(lista.total.valorParaMostrar())}
              tono={brecha.dentroDeTolerancia ? "normal" : "alerta"}
              nota={`Suma de ${lista.lineas} líneas (cantidad × precio). No es lo vendido: el export no trae descuento. El margen bruto se retiró por lo mismo — precio de lista menos costo no es margen.`}
              variante="cool"
            />
            <KpiPremiumCard
              etiqueta="Ticket promedio a precio de lista"
              valor={ticketPromedioLista ? fmt(ticketPromedioLista.valorParaMostrar()) : "—"}
              nota="líneas ÷ cantidad de pedidos — misma capa arriba y abajo de la división"
              variante="soft"
            />
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
