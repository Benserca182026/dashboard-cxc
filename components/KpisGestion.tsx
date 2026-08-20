"use client";

// KPIs de gestión (Paso 7) con su desglose abrible.
//
// Regla de trazabilidad: ningún número sin camino de vuelta al hecho. Cada
// tarjeta se abre y muestra las facturas o pagos que la componen, con la
// aritmética a la vista. Un KPI que no se puede abrir es una afirmación sin
// testigos — por eso el desglose no es un extra: es la condición de publicar
// el número.

import { useState } from "react";
import { fmtMoneda } from "@/lib/calculos";
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
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  formula: string;
  abierta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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
          valor={dso.dso === null ? "—" : `${dso.dso} d`}
          nota={
            dso.dso === null
              ? "sin facturación en la ventana: no calculable"
              : `cartera ${fmtMoneda(dso.carteraPendiente)} ÷ facturado ${fmtMoneda(dso.facturadoVentana)} × ${dso.ventanaDias}`
          }
          formula={`cartera ÷ facturado ${dso.ventanaDias}d × ${dso.ventanaDias}`}
          abierta={abierta === "dso"}
          onToggle={() => alternar("dso")}
        >
          <TablaMini
            cabeceras={["Factura", "Emisión", "Monto"]}
            filas={dso.facturasVentana.map((f) => [f.numero, f.fecha_emision, fmtMoneda(f.monto)])}
            pie={["Facturado en ventana", `${dso.desde} → ${dso.hasta}`, fmtMoneda(dso.facturadoVentana)]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Antigüedad ponderada por monto"
          valor={ant.ponderada === null ? "—" : `${ant.ponderada} d`}
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
              fmtMoneda(f.saldo),
              f.dias < 0 ? `${f.dias} → 0` : f.dias,
              f.aporte.toLocaleString("en-US"),
            ])}
            pie={[
              "Total",
              fmtMoneda(ant.saldoTotal),
              "",
              `${ant.totalPonderado.toLocaleString("en-US")} ÷ ${ant.saldoTotal.toLocaleString("en-US")} = ${ant.ponderada}`,
            ]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Efectividad de cobro"
          valor={efe.efectividadPct === null ? "—" : `${efe.efectividadPct}%`}
          nota={
            efe.efectividadPct === null
              ? "nada vencía en la ventana: 0/0 no se disfraza de porcentaje"
              : `cobrado ${fmtMoneda(efe.cobradoVentana)} ÷ vencía ${fmtMoneda(efe.montoQueVencia)} en ${efe.ventanaDias} días`
          }
          formula={`cobrado ${efe.ventanaDias}d ÷ vencía ${efe.ventanaDias}d`}
          abierta={abierta === "efe"}
          onToggle={() => alternar("efe")}
        >
          <p className="mb-1 text-[11px] font-semibold text-tintaSuave">Vencía en la ventana</p>
          <TablaMini
            cabeceras={["Factura", "Vencía", "Monto"]}
            filas={efe.facturasQueVencian.map((f) => [f.numero, f.fecha_vencimiento, fmtMoneda(f.monto)])}
            pie={["Total que vencía", "", fmtMoneda(efe.montoQueVencia)]}
          />
          <p className="mb-1 mt-3 text-[11px] font-semibold text-tintaSuave">Cobrado en la ventana</p>
          <TablaMini
            cabeceras={["Pago", "Fecha", "Monto"]}
            filas={
              efe.pagosVentana.length
                ? efe.pagosVentana.map((p) => [p.id_pago, p.fecha_pago, fmtMoneda(p.monto)])
                : [["—", "sin pagos en la ventana", fmtMoneda(0)]]
            }
            pie={["Total cobrado", "", fmtMoneda(efe.cobradoVentana)]}
          />
        </TarjetaAbrible>

        <TarjetaAbrible
          etiqueta="Concentración del riesgo"
          valor={con.mayorPct === null ? "—" : `${con.mayorPct}%`}
          nota={
            con.mayorCliente
              ? `${con.mayorCliente.nombre}: ${fmtMoneda(con.mayorCliente.saldo)} del total ${fmtMoneda(con.saldoTotal)}`
              : "sin saldo pendiente"
          }
          formula="mayor saldo por cliente ÷ saldo total"
          abierta={abierta === "con"}
          onToggle={() => alternar("con")}
        >
          <TablaMini
            cabeceras={["Cliente", "Saldo", "% del total"]}
            filas={con.porCliente.map((c) => [c.nombre, fmtMoneda(c.saldo), `${c.pct}%`])}
            pie={["Total", fmtMoneda(con.saldoTotal), "100%"]}
          />
        </TarjetaAbrible>
      </div>
    </section>
  );
}
