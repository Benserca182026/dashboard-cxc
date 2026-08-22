"use client";

// M7 — Inventario (Paso 11). La existencia NUNCA es un campo: es la suma de los
// movimientos, y el kardex abrible lo demuestra fila por fila. Una pantalla
// donde el stock se calcula y una donde alguien lo tecleó se ven idénticas —
// el kardex es lo único que las distingue.
//
// Reestructuración (M6): mismo esqueleto de "/" y "/aging". De arriba abajo:
// Encabezado con menú interno y BarraUsuario → el motor de argumentación
// propio de este módulo (argumentoInventario, con los agentes
// AGENTES_INVENTARIO asomados en el mordisco) → las existencias por producto,
// envueltas en el mismo LienzoConAgentes del resto.
//
// argumentoInventario puede resolver en 3 o 4 etapas según si hay algún
// producto bajo mínimo (la etapa "¿con qué urgencia?" sólo se agrega cuando
// hace falta) — comportamiento propio de esa función, no se fuerza acá.

import { useState } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BannerFicticioPremium, KpiPremiumCard } from "@/components/ResumenPremium";
import { fmtMoneda } from "@/lib/calculos";
import { hayCadena, salidasSinVenta, stockPorProducto } from "@/lib/cadena";
import { argumentoInventario } from "@/lib/argumento";
import { useApp } from "@/lib/store";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_INVENTARIO, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";

const SECCIONES_SIN_CADENA = [{ id: "sec-aviso", etiqueta: "Aviso" }];
const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-existencias", etiqueta: "Existencias" },
];

export default function PaginaInventario() {
  const { dataset, cargando, fechaCorte } = useApp();
  const moneda = dataset.fuente === "odoo-real" ? "GTQ" : "USD";
  const fmt = (n: number) => fmtMoneda(n, moneda);
  const [abierto, setAbierto] = useState<string | null>("PRD-C");

  if (cargando) return <SkeletonPagina />;

  if (!hayCadena(dataset)) {
    return (
      <div className="space-y-6">
        <Encabezado titulo="Inventario" secciones={SECCIONES_SIN_CADENA} dataset={dataset} modulo="inventario" />
        <section id="sec-aviso" className="scroll-mt-24">
          <div className="tarjeta-flotante entrada-suave p-8 text-center text-sm text-tintaSuave">
            Este dataset no trae la cadena de inventario (fuente: {dataset.fuente}).
            El módulo avisa en vez de mostrar ceros que parecerían datos — no se puede
            calcular ningún KPI de este módulo sin inventar cifras.
          </div>
        </section>
      </div>
    );
  }

  const argumento = argumentoInventario(dataset);
  const stock = stockPorProducto(dataset);
  const valorTotal = stock.reduce((s, x) => s + x.valorCosto, 0);
  const bajos = stock.filter((x) => x.bajoMinimo);
  const huerfanas = salidasSinVenta(dataset);

  // ── Las cifras de los cuatro anillos — derivadas del mismo stock que arma
  //    el argumento, no números sueltos. ──
  const mayorValor = [...stock].sort((a, b) => b.valorCosto - a.valorCosto)[0] ?? null;
  const pctMayorValor = mayorValor && valorTotal > 0 ? (mayorValor.valorCosto / valorTotal) * 100 : 0;
  const critico = [...bajos].sort(
    (a, b) =>
      b.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0) -
      a.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0)
  )[0] ?? null;
  const valorEnRiesgo = bajos.reduce((s, x) => s + x.valorCosto, 0);

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones de acá hablan de kardex y reposición, no de cartera
          general. */}
      <Encabezado titulo="Inventario" secciones={SECCIONES} dataset={dataset} modulo="inventario" />

      {/* El motor de argumentación del módulo: ¿el total dice algo, qué está
          por faltar, con qué urgencia, y qué se sigue de eso? argumento nunca
          es null acá porque ya se filtró !hayCadena arriba. */}
      {argumento && (
        <section id="sec-argumento" className="scroll-mt-24">
          <RecorridoArgumental
            rotulo="El caso del inventario"
            arg={argumento}
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_INVENTARIO} />}
            kpis={[
              {
                etiqueta: "SKU líder por valor · del valor total",
                valor: mayorValor ? fmt(mayorValor.valorCosto) : "—",
                pct: pctMayorValor,
              },
              {
                etiqueta: "bajo mínimo · de los SKU",
                valor: `${bajos.length} de ${stock.length}`,
                pct: stock.length > 0 ? (bajos.length / stock.length) * 100 : 0,
              },
              {
                etiqueta: critico ? "existencia del urgente · del mínimo" : "sin producto urgente",
                valor: critico ? `${critico.existencia} u (mín. ${critico.producto.stock_minimo})` : "—",
                pct: critico && critico.producto.stock_minimo > 0
                  ? Math.min(100, (critico.existencia / critico.producto.stock_minimo) * 100)
                  : 0,
              },
              {
                etiqueta: "valor en riesgo · del valor total",
                valor: fmt(valorEnRiesgo),
                pct: valorTotal > 0 ? (valorEnRiesgo / valorTotal) * 100 : 0,
              },
            ]}
          />
        </section>
      )}

      {/* Existencias por producto: mismo kardex abrible de siempre — la
          existencia sigue siendo la suma exacta de sus movimientos. */}
      <section id="sec-existencias" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Existencias por producto"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_INVENTARIO} />}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiPremiumCard etiqueta="Productos" valor={String(stock.length)} nota="en catálogo ficticio" variante="soft" />
            <KpiPremiumCard
              etiqueta="Bajo mínimo"
              valor={String(bajos.length)}
              tono={bajos.length > 0 ? "critico" : "normal"}
              nota={bajos.length ? bajos.map((b) => b.producto.sku).join(", ") : "ninguno"}
              variante="warm"
            />
            <KpiPremiumCard
              etiqueta="Salidas sin venta de origen"
              valor={String(huerfanas.length)}
              tono={huerfanas.length > 0 ? "alerta" : "normal"}
              nota="toda salida debe decir qué venta la produjo"
              variante="cool"
            />
            <KpiPremiumCard etiqueta="Valor a costo" valor={fmt(valorTotal)} nota="derivado, no almacenado" variante="soft" />
          </div>

          <p className="mb-2 mt-5 text-[11.5px] leading-snug text-[#85878c]">
            Clic en un producto abre su kardex — el desglose que ES la existencia.
          </p>

          <div className="space-y-2.5">
            {stock.map((s, i) => {
              const estaAbierto = abierto === s.producto.id_producto;
              return (
                <div
                  key={s.producto.id_producto}
                  className={`entrada-suave rounded-tarjeta transition-shadow ${
                    estaAbierto
                      ? "border border-white/90 bg-white/80 shadow-flotanteAlta"
                      : "border border-white/70 bg-white/55 shadow-flotante"
                  }`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <button
                    onClick={() => setAbierto(estaAbierto ? null : s.producto.id_producto)}
                    aria-expanded={estaAbierto}
                    className="grid w-full grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-tarjeta px-4 py-3.5 text-left transition hover:bg-white/60 sm:gap-6"
                  >
                    <span className="font-mono text-xs text-tintaSuave">{s.producto.sku}</span>
                    <span className="text-sm font-semibold text-tinta">{s.producto.nombre_producto}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${s.bajoMinimo ? "text-red-600" : "text-tinta"}`}
                    >
                      {s.existencia} u
                      {s.bajoMinimo && (
                        <span className="ml-1.5 rounded-pastilla bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                          ▲ bajo mín. {s.producto.stock_minimo}
                        </span>
                      )}
                    </span>
                    <span className="hidden text-xs tabular-nums text-tintaSuave sm:block">{fmt(s.valorCosto)}</span>
                    <span
                      className={`text-[11px] transition ${
                        estaAbierto ? "pastilla-activa px-2 py-0.5 opacity-90" : "text-tintaSuave opacity-45"
                      }`}
                    >
                      {estaAbierto ? "▾" : "▸"}
                    </span>
                  </button>

                  {estaAbierto && (
                    <div className="border-t border-black/[.06] px-4 py-3">
                      <p className="etiqueta-fase mb-2 uppercase">
                        <span className="mr-1 opacity-50">◆</span>
                        Kardex — los movimientos que suman la existencia
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-borde/60 text-left text-[10px] uppercase tracking-wide text-tintaSuave">
                            <th className="py-1.5 pr-3 font-semibold">Fecha</th>
                            <th className="py-1.5 pr-3 font-semibold">Tipo</th>
                            <th className="py-1.5 pr-3 font-semibold">Origen</th>
                            <th className="py-1.5 text-right font-semibold">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.movimientos.map((m) => (
                            <tr key={m.id_movimiento} className="border-b border-borde/30 last:border-0">
                              <td className="py-1.5 pr-3 tabular-nums">{m.fecha}</td>
                              <td className="py-1.5 pr-3">{m.tipo}</td>
                              <td className="py-1.5 pr-3 font-mono">
                                {m.id_venta ?? <span className="text-tintaSuave">{m.motivo ?? "—"}</span>}
                              </td>
                              <td className={`py-1.5 text-right font-semibold tabular-nums ${m.cantidad < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-borde/60 font-bold">
                            <td className="py-1.5 pr-3" colSpan={3}>Existencia (suma exacta de las filas)</td>
                            <td className={`py-1.5 text-right tabular-nums ${s.bajoMinimo ? "text-red-600" : ""}`}>{s.existencia} u</td>
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
    </div>
  );
}
