"use client";

import { useMemo } from "react";
import { useDecisionV2 } from "@/lib/decision-v2-client";
import { useApp } from "@/lib/store";
import { analizarCalidadDataset } from "@/lib/commercial-datos";

const ESTADO_CONCILIACION = {
  confirmado: "bg-emerald-500/10 text-emerald-800",
  parcial: "bg-amber-500/12 text-amber-800",
  "sin-dato": "bg-slate-500/12 text-slate-700",
} as const;

export function DatosConfiabilidad() {
  const { dataset } = useApp();
  const { bundle, origen, cargandoRemoto, errorRemoto, metricasDe, accionesDe } = useDecisionV2();
  const analisis = useMemo(() => analizarCalidadDataset(dataset), [dataset]);
  const cobertura = bundle.coverage;
  const metricas = metricasDe("datos");
  const integridadVentas = metricas.find((metrica) => metrica.key === "datos_integridad");
  const accionDatos = accionesDe("datos")[0];
  const erroresConConteo = analisis.errores.filter((error) => error.cantidad > 0);
  const maxError = Math.max(1, ...erroresConConteo.map((error) => error.cantidad));
  const errorDominante = erroresConConteo[0];
  const pctCompleto = cobertura.total > 0 ? (cobertura.complete / cobertura.total) * 100 : 0;

  const tarjetas = [
    {
      etiqueta: "Cobertura completa",
      valor: `${cobertura.complete} de ${cobertura.total}`,
      nota: `${pctCompleto.toFixed(1)}% con evidencia y definición`,
      estado: "confirmado",
    },
    {
      etiqueta: "Cobertura parcial",
      valor: `${cobertura.partial} de ${cobertura.total}`,
      nota: "Útil, con limitación declarada",
      estado: "parcial",
    },
    {
      etiqueta: "Cobertura bloqueada",
      valor: `${cobertura.blocked} de ${cobertura.total}`,
      nota: "No se convierte en cero",
      estado: "sin dato",
    },
    {
      etiqueta: "Control estructural del Dataset",
      valor:
        analisis.pctSinProblemaDetectado === null
          ? "Sin población"
          : `${analisis.pctSinProblemaDetectado.toFixed(1)}%`,
      nota: `${analisis.facturasSinProblemaDetectado} de ${analisis.totalFacturas} facturas sin los errores probados`,
      estado: "control local",
    },
  ];

  const agentes = [
    {
      nombre: "Oportunidad",
      glifo: "↗",
      pregunta: "¿Qué parte ya puede publicarse?",
      respuesta: `${cobertura.complete} de ${cobertura.total} solicitudes están completas bajo el snapshot verificado.`,
    },
    {
      nombre: "Riesgo y cambio",
      glifo: "△",
      pregunta: "¿Qué problema concentra más afectación?",
      respuesta: errorDominante
        ? `${errorDominante.nombre}: ${errorDominante.cantidad}. Afecta ${errorDominante.afecta.join(", ")}.`
        : `${cobertura.blocked} solicitudes siguen bloqueadas por ausencia de fuente o definición; el control estructural local no detectó incidencias.`,
    },
    {
      nombre: "Próxima acción",
      glifo: "→",
      pregunta: "¿Qué dato conviene desbloquear primero?",
      respuesta: accionDatos
        ? `${accionDatos.title}. Responsable: ${accionDatos.owner}. Fecha: ${accionDatos.dueLabel}.`
        : "No hay una acción de datos priorizada en el snapshot vigente.",
    },
    {
      nombre: "Control",
      glifo: "✓",
      pregunta: "¿Qué no se debe afirmar todavía?",
      respuesta:
        "Este panel mide cobertura y controles estructurales; no certifica exactitud contable. Sin mayor externo no existe conciliación contable completa.",
    },
  ];

  const corte = new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Panama",
  }).format(new Date(bundle.snapshot.cutoffAt));

  return (
    <section id="sec-confiabilidad" className="lienzo-referencia scroll-mt-24 overflow-hidden entrada-suave">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#778198]">Datos · cobertura, frescura y conciliación</p>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-tinta">¿Qué tan confiable es decidir con esta información?</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[#6b6f78]">
              Se separa cobertura publicable, control estructural y conciliación. Ninguno de estos controles sustituye una auditoría contable.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[10.5px] font-semibold text-[#4e596d] shadow-flotante">
              {cargandoRemoto ? "sincronizando…" : origen === "supabase-v2" ? "Supabase V2" : "snapshot verificado"}
            </span>
            <p className="mt-1.5 text-[10.5px] text-[#85878c]">Corte del snapshot {corte}</p>
            <p className="mt-0.5 text-[10px] text-[#9a9da4]">
              Última emisión observable: {analisis.ultimaFechaObservable ?? "sin fecha válida"}
            </p>
          </div>
        </div>

        {errorRemoto ? (
          <p className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800">
            Supabase V2 no respondió; se conserva el snapshot verificado. {errorRemoto}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tarjetas.map((tarjeta, indice) => (
            <details key={tarjeta.etiqueta} className="group tarjeta-calada min-w-0 p-4 open:ring-1 open:ring-[#536b91]/20">
              <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-semibold leading-snug text-[#606776]">{tarjeta.etiqueta}</p>
                <span className="rounded-full bg-white/75 px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#6b7280]">{tarjeta.estado}</span>
              </div>
              <p className="mt-3 text-[25px] font-extrabold leading-none tracking-[-0.025em] tabular-nums text-tinta">{tarjeta.valor}</p>
              <p className="mt-2 text-[10.5px] leading-snug text-[#7c808a]">{tarjeta.nota}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9edf4]"><span className="block h-full rounded-full bg-[#536b91]" style={{ width: `${[88, 58, 28, analisis.pctSinProblemaDetectado ?? 0][indice]}%` }} /></div>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#536b91] group-open:hidden">tocar para impacto ↘</p>
              </summary>
              <p className="mt-3 border-t border-black/[.06] pt-3 text-[10px] leading-relaxed text-[#6b6f78]">Esta cobertura no certifica contabilidad: indica qué indicadores pueden calcularse con su población, corte y campos actuales.</p>
            </details>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div id="sec-pareto" className="scroll-mt-24 rounded-[20px] border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[12px] font-bold text-tinta">Pareto de incidencias detectables</h3>
                <p className="mt-0.5 text-[10px] text-[#8b8f98]">Conteos; una factura puede aparecer en más de una causa.</p>
              </div>
              <span className="rounded-full bg-[#edf1f8] px-2.5 py-1 text-[9px] font-semibold text-[#53617a]">Dataset actual</span>
            </div>
            {erroresConConteo.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {erroresConConteo.map((error, indice) => (
                  <li key={error.id}>
                    <details className="group rounded-xl p-1 open:bg-[#fff7ef]">
                      <summary className="cursor-pointer list-none">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[11px] font-semibold text-tinta">{indice + 1}. {error.nombre}</p>
                      <p className="text-[11px] font-bold tabular-nums text-tinta">{error.cantidad}</p>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.06]">
                      <span className="block h-full rounded-full bg-[#c2703a]" style={{ width: `${(error.cantidad / maxError) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[9.5px] leading-snug text-[#8b8f98]">Afecta: {error.afecta.join(" · ")}</p>
                      </summary>
                      <p className="mt-2 border-t border-black/[.06] pt-2 text-[10px] text-[#6b6f78]">Abrí el reporte de calidad para ver las filas y el motivo exacto; esta pantalla no oculta la incidencia dentro de un promedio.</p>
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-emerald-50/70 px-3 py-4 text-[11px] text-emerald-800">
                Los controles estructurales definidos no detectaron incidencias en las facturas actuales. Esto no certifica exactitud contable.
              </p>
            )}
          </div>

          <div id="sec-conciliacion" className="scroll-mt-24 rounded-[20px] border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
            <h3 className="text-[12px] font-bold text-tinta">Conciliación y frescura</h3>
            <div className="mt-3 space-y-2">
              {analisis.conciliaciones.map((fila) => (
                <div key={fila.id} className="rounded-xl bg-white/75 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-tinta">{fila.nombre}</p>
                    <span className={`rounded-full px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.05em] ${ESTADO_CONCILIACION[fila.estado]}`}>{fila.valor}</span>
                  </div>
                  <p className="mt-1 text-[9.5px] leading-snug text-[#7c808a]">{fila.detalle}</p>
                </div>
              ))}
              {integridadVentas ? (
                <div className="rounded-xl bg-white/75 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold text-tinta">Pedidos ↔ líneas</p>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8.5px] font-bold uppercase tracking-[0.05em] text-emerald-800">{integridadVentas.displayValue}</span>
                  </div>
                  <p className="mt-1 text-[9.5px] leading-snug text-[#7c808a]">{integridadVentas.comparison} · {integridadVentas.sourceModel}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[20px] border border-white/70 bg-white/45 p-4">
            <h3 className="text-[12px] font-bold text-tinta">KPIs y agentes afectados</h3>
            {analisis.modulosAfectados.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {analisis.modulosAfectados.map((fila) => (
                  <div key={fila.modulo} className="rounded-xl bg-white/75 px-3 py-2.5">
                    <p className="text-[10.5px] font-semibold text-tinta">{fila.modulo}</p>
                    <p className="mt-1 text-[9.5px] leading-snug text-[#7c808a]">{fila.causas.join(" · ")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-[#7c808a]">Los controles definidos no identificaron un KPI afectado en el Dataset actual.</p>
            )}
          </div>

          <div className="rounded-[20px] bg-[#16181d] p-4 text-white shadow-[0_14px_30px_-18px_rgba(22,24,29,.7)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-bold">Agentes de confianza</h3>
              <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] text-white/65">sin falsos ceros</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {agentes.map((agente) => (
                <details key={agente.nombre} className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px]">{agente.glifo}</span>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">{agente.nombre}</p>
                    </div>
                    <p className="mt-2 text-[11.5px] font-semibold leading-snug text-white">{agente.pregunta}</p>
                  </summary>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-white/70">{agente.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
