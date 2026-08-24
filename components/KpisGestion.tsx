"use client";

// KPIs de gestión (Paso 7) con su desglose abrible.
//
// Regla de trazabilidad: ningún número sin camino de vuelta al hecho. Cada
// tarjeta se abre y muestra las facturas o pagos que la componen, con la
// aritmética a la vista. Un KPI que no se puede abrir es una afirmación sin
// testigos — por eso el desglose no es un extra: es la condición de publicar
// el número.

import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  antiguedadPonderada,
  calcularDso,
  concentracionRiesgo,
  efectividadCobro,
} from "@/lib/kpis";
import type { Dataset } from "@/lib/types";

function TarjetaAbrible({
  etiqueta,
  valor,
  nota,
  formula,
  abierta,
  onToggle,
  children,
  sinDato,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  formula: string;
  abierta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /**
   * EL HUECO DECLARADO. Cuando viene, reemplaza al número.
   *
   * Importa especialmente ACÁ: cerrada, esta tarjeta muestra ÚNICAMENTE
   * `valor`, así que un "—" quedaba completamente mudo hasta que alguien la
   * abriera. La explicación existía pero estaba escondida un clic más adentro,
   * que es casi lo mismo que no existir. Ahora el hueco se anuncia cerrado y
   * se explica entero al abrir, con el mismo tinte azul frío del estado
   * "sin-dato" de los agentes.
   */
  sinDato?: { queFalta: string; consecuencia: string; comoSeLlena: string };
}) {
  return (
    // Abierta ocupa dos columnas: el desglose necesita mostrar su aritmética
    // completa, y una tabla recortada seria un desglose que no desglosa.
    <div
      className={`rounded-2xl border border-borde/60 bg-tarjeta shadow-[0_6px_18px_rgba(23,32,51,.05)] ${abierta ? "sm:col-span-2" : ""}`}
    >
      <button
        onClick={onToggle}
        aria-expanded={abierta}
        className="w-full p-5 text-left transition hover:bg-black/[.02]"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-tintaSuave">{etiqueta}</p>
          <span className="text-xs text-tintaSuave" aria-hidden>
            {abierta ? "▾" : "▸"}
          </span>
        </div>
        {sinDato ? (
          <>
            <p className="mt-1.5">
              <span
                className="inline-block rounded-pastilla px-2.5 py-1 text-[11px] font-semibold leading-none"
                style={{ background: "rgba(91,122,153,.14)", color: "#3f5a75" }}
              >
                ? sin dato
              </span>
            </p>
            {/* Cerrada, ésta es la línea que impide que el hueco quede mudo. */}
            <p className="mt-1.5 text-xs leading-snug text-tintaSuave">{sinDato.queFalta}</p>
            {abierta && (
              <>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#3f5a75]">
                  Qué se pierde
                </p>
                <p className="mt-0.5 text-xs leading-snug text-tintaSuave">{sinDato.consecuencia}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#3f5a75]">
                  Cómo se llena
                </p>
                <p className="mt-0.5 text-xs leading-snug text-tintaSuave">{sinDato.comoSeLlena}</p>
                <p className="mt-2 text-[11px] font-medium text-tintaSuave/80">
                  fórmula que NO se pudo aplicar: <span className="font-mono">{formula}</span>
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-tinta">{valor}</p>
            {/* Cerrada, la tarjeta muestra sólo el número: la nota y la fórmula se
                leen al abrirla. La página pedía la menor cantidad de texto posible
                y esto no se pierde, se guarda un clic más adentro. */}
            {abierta && (
              <>
                <p className="mt-1 text-xs text-tintaSuave">{nota}</p>
                <p className="mt-2 text-[11px] font-medium text-tintaSuave/80">
                  fórmula: <span className="font-mono">{formula}</span>
                </p>
              </>
            )}
          </>
        )}
      </button>
      {abierta && (
        <div className="border-t border-borde/60 px-5 py-4">
          {children}
          <p className="mt-3 text-[11px] text-tintaSuave">
            Desglose completo: el número de arriba es la suma exacta de estas filas.
          </p>
        </div>
      )}
    </div>
  );
}

function TablaMini({
  cabeceras,
  filas,
  pie,
}: {
  cabeceras: string[];
  filas: (string | number)[][];
  pie?: string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-borde/60 text-left text-[10px] uppercase tracking-wide text-tintaSuave">
            {cabeceras.map((c) => (
              <th key={c} className="py-1.5 pr-3 font-semibold last:text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-borde/30 last:border-0">
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`py-1.5 pr-3 tabular-nums ${j === fila.length - 1 ? "text-right font-semibold" : ""} ${j === 0 ? "font-mono" : ""}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
          {pie && (
            <tr className="border-t border-borde/60 font-bold">
              {pie.map((celda, j) => (
                <td key={j} className={`py-1.5 pr-3 tabular-nums ${j === pie.length - 1 ? "text-right" : ""}`}>
                  {celda}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function KpisGestion({ dataset, fechaCorte }: { dataset: Dataset; fechaCorte: string }) {
  const { fmt } = useApp();
  // El dinero lo pinta el formateador del store: es el ÚNICO lugar donde una
  // cifra cambia de moneda, y lo hace al PINTAR. Todo lo de arriba (umbrales,
  // porcentajes, comparaciones, cuadres) se calculó en la moneda de registro y
  // no se entera de esta vista. Ver components/ControlMoneda.tsx.
  const [abierta, setAbierta] = useState<string | null>(null);
  const alternar = (k: string) => setAbierta(abierta === k ? null : k);

  const dso = calcularDso(dataset, fechaCorte);
  const ant = antiguedadPonderada(dataset, fechaCorte);
  const efe = efectividadCobro(dataset, fechaCorte);
  const con = concentracionRiesgo(dataset, fechaCorte);

  return (
    <section className="space-y-3">
      {/* El título ya lo pone el lienzo que envuelve este bloque: tenerlo dos
          veces era ruido. Y la advertencia larga se redujo a lo mínimo que
          sigue siendo cierto. */}
      <p className="text-[10.5px] font-medium text-amber-700">
        fórmulas 🟡 pendientes de validación · cada tarjeta se abre hasta sus facturas
      </p>

      {/* Dos por fila: ahora este panel ocupa media pantalla, no el ancho
          entero. Con cuatro en línea las fórmulas se partían en cuatro
          renglones y dejaban de leerse. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaAbrible
          etiqueta="DSO — días de venta en calle"
          valor={dso.dso === null ? "" : `${dso.dso} d`}
          sinDato={
            dso.dso === null
              ? {
                  queFalta: `No hubo facturación en la ventana de ${dso.ventanaDias} días que termina en el corte: el divisor de la fórmula es cero.`,
                  consecuencia:
                    "No hay días de venta en calle que informar. Un DSO de 0 días significaría que se cobra al instante — lo contrario de no poder medirlo.",
                  comoSeLlena:
                    "Con facturas emitidas dentro de la ventana. Si las hay en Odoo y acá no aparecen, revisar scripts/importar-facturas-odoo.mjs y la fecha de corte.",
                }
              : undefined
          }
          nota={
            dso.dso === null
              ? "sin facturación en la ventana: no calculable"
              : `cartera ${fmt(dso.carteraPendiente)} ÷ facturado ${fmt(dso.facturadoVentana)} × ${dso.ventanaDias}`
          }
          formula={`cartera ÷ facturado ${dso.ventanaDias}d × ${dso.ventanaDias}`}
          abierta={abierta === "dso"}
          onToggle={() => alternar("dso")}
        >
          <TablaMini
            cabeceras={["Factura", "Emisión", "Monto"]}
            filas={dso.facturasVentana.map((f) => [f.numero, f.fecha_emision, fmt(f.monto)])}
            pie={["Facturado en ventana", `${dso.desde} → ${dso.hasta}`, fmt(dso.facturadoVentana)]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Antigüedad ponderada por monto"
          valor={ant.ponderada === null ? "" : `${ant.ponderada} d`}
          sinDato={
            ant.ponderada === null
              ? {
                  queFalta:
                    "No hay ninguna factura clasificada en el aging al corte: sin facturas con saldo y fecha de vencimiento no hay antigüedad que ponderar.",
                  consecuencia:
                    "No se puede saber si el saldo grande está en lo viejo o en lo reciente. Un promedio sobre cero facturas no es 0 días: es ninguna respuesta.",
                  comoSeLlena:
                    "Con facturas abiertas con fecha de vencimiento al corte. Las que no la traen quedan fuera del aging y no se les inventa una.",
                }
              : undefined
          }
          nota={
            ant.simple === null
              ? "sin facturas clasificadas"
              : `promedio simple: ${ant.simple} d — la ponderación evita que veinte facturas chicas escondan una grande`
          }
          formula="Σ(saldo × días) ÷ Σ(saldo)"
          abierta={abierta === "ant"}
          onToggle={() => alternar("ant")}
        >
          <TablaMini
            cabeceras={["Factura", "Saldo", "Días", "Saldo × días"]}
            filas={ant.filas.map((f) => [
              f.numero,
              fmt(f.saldo),
              f.dias < 0 ? `${f.dias} → 0` : f.dias,
              f.aporte.toLocaleString("en-US"),
            ])}
            pie={[
              "Total",
              fmt(ant.saldoTotal),
              "",
              `${ant.totalPonderado.toLocaleString("en-US")} ÷ ${ant.saldoTotal.toLocaleString("en-US")} = ${ant.ponderada}`,
            ]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Efectividad de cobro"
          valor={efe.efectividadPct === null ? "" : `${efe.efectividadPct}%`}
          sinDato={
            efe.efectividadPct === null
              ? {
                  queFalta: `Nada vencía en la ventana de ${efe.ventanaDias} días que termina en el corte: el divisor de la fórmula es cero.`,
                  consecuencia:
                    "No se puede medir qué proporción de lo exigible se cobró. Un 0% diría que no se cobró nada de lo que vencía, cuando lo cierto es que no vencía nada.",
                  comoSeLlena:
                    "Con facturas cuya fecha de vencimiento caiga dentro de la ventana. Cambiar la fecha de corte en el módulo Aging mueve esa ventana.",
                }
              : undefined
          }
          nota={
            efe.efectividadPct === null
              ? "nada vencía en la ventana: 0/0 no se disfraza de porcentaje"
              // La segunda mitad de esta frase mostraba la efectividad por
              // COHORTE (efectividadCohortePct). Se retiró: sobre datos reales
              // vale 0% siempre — los pagos importados de Odoo llegan con
              // id_factura en null, y la cohorte cruza por ese campo — así que
              // la tarjeta terminaba diciendo dos números contradictorios en el
              // mismo renglón. El cálculo sigue en lib/kpis.ts, con el detalle
              // de qué lo reactiva (pagos con id_factura poblado) y de dónde
              // está hoy la cobranza real (notas de crédito sintéticas
              // REC-<id_factura>, lib/datosReales.ts:189-205).
              : `caja recibida en el período: cobrado ${fmt(efe.cobradoVentana)} ÷ vencía ${fmt(efe.montoQueVencia)} en ${efe.ventanaDias} días`
          }
          formula={`cobrado ${efe.ventanaDias}d ÷ vencía ${efe.ventanaDias}d`}
          abierta={abierta === "efe"}
          onToggle={() => alternar("efe")}
        >
          <p className="mb-1 text-[11px] font-semibold text-tintaSuave">Vencía en la ventana</p>
          <TablaMini
            cabeceras={["Factura", "Vencía", "Monto"]}
            filas={efe.facturasQueVencian.map((f) => [f.numero, f.fecha_vencimiento, fmt(f.monto)])}
            pie={["Total que vencía", "", fmt(efe.montoQueVencia)]}
          />
          <p className="mb-1 mt-3 text-[11px] font-semibold text-tintaSuave">Cobrado en la ventana</p>
          <TablaMini
            cabeceras={["Pago", "Fecha", "Monto"]}
            filas={
              efe.pagosVentana.length
                ? efe.pagosVentana.map((p) => [p.id_pago, p.fecha_pago, fmt(p.monto)])
                : [["sin pagos", `ninguno entre ${efe.desde} y ${efe.hasta}`, fmt(0)]]
            }
            pie={["Total cobrado", "", fmt(efe.cobradoVentana)]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Concentración del riesgo"
          valor={con.mayorPct === null ? "" : `${con.mayorPct}%`}
          sinDato={
            con.mayorPct === null
              ? {
                  queFalta:
                    "No hay saldo pendiente al corte: ningún cliente debe nada, así que no hay total entre el cual repartir el riesgo.",
                  consecuencia:
                    "No hay concentración que medir. Un 0% afirmaría un reparto perfectamente parejo entre clientes que no existen.",
                  comoSeLlena:
                    "Con facturas abiertas con saldo al corte declarado.",
                }
              : undefined
          }
          nota={
            con.mayorCliente
              ? `${con.mayorCliente.nombre}: ${fmt(con.mayorCliente.saldo)} del total ${fmt(con.saldoTotal)}`
              : "sin saldo pendiente"
          }
          formula="mayor saldo por cliente ÷ saldo total"
          abierta={abierta === "con"}
          onToggle={() => alternar("con")}
        >
          <TablaMini
            cabeceras={["Cliente", "Saldo", "% del total"]}
            filas={con.porCliente.map((c) => [c.nombre, fmt(c.saldo), `${c.pct}%`])}
            pie={["Total", fmt(con.saldoTotal), "100%"]}
          />
        </TarjetaAbrible>
      </div>
    </section>
  );
}
