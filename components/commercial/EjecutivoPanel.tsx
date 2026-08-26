"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDecisionV2 } from "@/lib/decision-v2-client";
import { useApp } from "@/lib/store";
import {
  construirLecturaEjecutiva,
  convertirTextoMonetario,
  type FilaImpactoEjecutivo,
} from "@/lib/commercial-ejecutivo";
import { analiticaForecast, analiticaVentas } from "@/lib/commercial-operacion";
import { KpiExplorable, MapaImpactoCobranza } from "@/components/commercial/VisualesInteractivas";

const ESTADO_LIMITE = {
  complete: { etiqueta: "calculado", clase: "bg-emerald-500/10 text-emerald-800" },
  partial: { etiqueta: "con límite", clase: "bg-amber-500/12 text-amber-800" },
  blocked: { etiqueta: "no publicable", clase: "bg-slate-500/12 text-slate-700" },
} as const;

function ListaImpacto({
  filas,
  total,
  titulo,
  subtitulo,
  tono,
  fmt,
}: {
  filas: FilaImpactoEjecutivo[];
  total: number;
  titulo: string;
  subtitulo: string;
  tono: "oportunidad" | "riesgo";
  fmt: (valor: number) => string;
}) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.monto));
  const color = tono === "riesgo" ? "#c2703a" : "#536b91";
  return (
    <div className="rounded-[20px] border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-bold text-tinta">{titulo}</h3>
          <p className="mt-0.5 text-[10.5px] leading-snug text-[#7c808a]">{subtitulo}</p>
        </div>
        <p className="shrink-0 text-right text-[17px] font-extrabold tabular-nums text-tinta">{fmt(total)}</p>
      </div>
      {filas.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {filas.map((fila, indice) => (
            <li key={fila.id}>
              <div className="flex items-end gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#16181d] text-[9px] font-bold text-white">
                  {indice + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[11.5px] font-semibold text-tinta" title={fila.nombre}>{fila.nombre}</p>
                    <p className="shrink-0 text-[11px] font-bold tabular-nums text-tinta">{fmt(fila.monto)}</p>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.06]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(fila.monto / maximo) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between gap-3 text-[9.5px] text-[#8b8f98]">
                    <span>{fila.detalle}</span>
                    <span className="shrink-0 tabular-nums">{fila.participacion.toFixed(1)}% del total</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl bg-white/70 px-3 py-4 text-[11px] text-[#7c808a]">
          No hay saldos que cumplan esta condición al corte.
        </p>
      )}
    </div>
  );
}

export function EjecutivoPanel() {
  const { dataset, fechaCorte, fmt, monedaVista, tipoCambio } = useApp();
  const { bundle, cargandoRemoto, errorRemoto, metricasDe, accionesDe } = useDecisionV2();
  const lectura = useMemo(
    () => construirLecturaEjecutiva(dataset, fechaCorte),
    [dataset, fechaCorte]
  );
  const metricasSnapshot = metricasDe("resumen").slice(0, 4);
  const porcentajeVencido = lectura.totalCarteraClasificable > 0
    ? (lectura.totalVencido / lectura.totalCarteraClasificable) * 100
    : 0;
  const metricas = metricasSnapshot.map((metrica) =>
    metrica.key === "resumen_cartera_vencida"
      ? {
          ...metrica,
          displayValue: fmt(lectura.totalVencido),
          numericValue: lectura.totalVencido,
          comparison: `${porcentajeVencido.toFixed(2)}% de ${fmt(lectura.totalCarteraClasificable)} clasificables`,
          status: "complete" as const,
          definition: "Saldo pendiente con vencimiento anterior al corte operativo; usa la misma clasificación que Top 5 y aging.",
          sourceModel: `${dataset.fuente} · facturas y saldo conciliado de Odoo`,
          sourceFilter: `saldo > 0 · fecha_vencimiento < ${fechaCorte} · bucket actual excluido`,
          action: "Priorizar los clientes del Top 5 calculado con este mismo corte.",
        }
      : metrica
  );
  const accionesSnapshot = accionesDe("resumen").slice(0, 5);
  const ventas = useMemo(() => analiticaVentas(dataset), [dataset]);
  const forecast = useMemo(
    () => analiticaForecast(dataset, fechaCorte),
    [dataset, fechaCorte]
  );
  const acciones = accionesSnapshot.map((accion) => {
    if (accion.key === "cobrar_mora_180") {
      const participacion = lectura.totalVencido > 0
        ? (lectura.totalMora180 / lectura.totalVencido) * 100
        : 0;
      return {
        ...accion,
        impact: `${fmt(lectura.totalMora180)} · ${participacion.toFixed(2)}% de lo vencido · corte ${fechaCorte}`,
        dueLabel: "Requiere dueño y fecha",
        status: "open" as const,
        etiquetaEstado: "actualizada",
      };
    }
    if (accion.key === "asignar_cartera") {
      return {
        ...accion,
        title: "Importar y asignar al responsable de la cartera",
        impact: "No publicable: el dataset operativo no conserva vendedor ni gestor de cobranza",
        dueLabel: "Primero importar responsable",
        status: "blocked" as const,
        etiquetaEstado: "bloqueada",
      };
    }
    if (accion.key === "recuperar_clientes") {
      return {
        ...accion,
        impact: `${forecast.reactivacionTotal} clientes · ${fmt(forecast.reactivacionValorHistorico)} facturados en 2025 · cálculo operativo`,
        dueLabel: "Requiere dueño y fecha",
        status: "open" as const,
        etiquetaEstado: "actualizada",
      };
    }
    if (accion.key === "revisar_descuentos") {
      return {
        ...accion,
        title: "Separar descuento, IVA y margen",
        impact: `${Math.abs(ventas.brechaPct ?? 0).toFixed(2)}% es brecha lista vs total con IVA; no es descuento real`,
        dueLabel: "Requiere descuento por línea",
        status: "blocked" as const,
        etiquetaEstado: "bloqueada",
      };
    }
    return {
      ...accion,
      etiquetaEstado: accion.status === "blocked" ? "bloqueada" : "snapshot",
    };
  });
  const mostrar = (texto: string) => convertirTextoMonetario(texto, monedaVista, tipoCambio);
  const metricaCambio = metricas.find((metrica) => /vs|frente|−|\+/.test(metrica.comparison));
  const primeraOportunidad = lectura.oportunidades[0];
  const primeraAccion = acciones[0];
  const concentracionTop5 = lectura.totalVencido > 0
    ? (lectura.oportunidades.slice(0, 5).reduce((s, fila) => s + fila.monto, 0) / lectura.totalVencido) * 100
    : 0;
  const moraCriticaPct = lectura.totalVencido > 0 ? (lectura.totalMoraCritica / lectura.totalVencido) * 100 : 0;
  const corteSnapshot = new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Panama",
  }).format(new Date(bundle.snapshot.cutoffAt));

  const presentacion = (clave: string, estado: keyof typeof ESTADO_LIMITE) => {
    if (clave === "resumen_facturacion_mtd") {
      return {
        etiqueta: "resultado guardado",
        clase: ESTADO_LIMITE.partial.clase,
        procedencia: `Snapshot Odoo · corte ${corteSnapshot} · consulta no preservada`,
      };
    }
    if (clave === "resumen_cartera_vencida") {
      return {
        etiqueta: "calculado",
        clase: ESTADO_LIMITE.complete.clase,
        procedencia: `${dataset.fuente} · corte ${fechaCorte} · mismo cálculo que rankings y aging`,
      };
    }
    if (clave === "resumen_margen_ytd") {
      return {
        etiqueta: "estimación",
        clase: ESTADO_LIMITE.partial.clase,
        procedencia: `Snapshot Odoo · corte ${corteSnapshot} · costo estándar vigente, no histórico`,
      };
    }
    if (clave === "resumen_inventario") {
      return {
        etiqueta: "control histórico",
        clase: ESTADO_LIMITE.partial.clase,
        procedencia: "Exports Odoo · corte 2026-08-19 · valor y unidades vienen de modelos distintos",
      };
    }
    return { ...ESTADO_LIMITE[estado], procedencia: bundle.snapshot.sourceLabel };
  };

  const agentes = [
    {
      clave: "oportunidad",
      glifo: "↗",
      nombre: "Oportunidad",
      pregunta: "¿Dónde está la caja recuperable de mayor impacto?",
      respuesta: primeraOportunidad
        ? `${primeraOportunidad.nombre} encabeza el saldo vencido con ${fmt(primeraOportunidad.monto)} al corte ${fechaCorte}.`
        : "No hay saldo vencido clasificable al corte.",
    },
    {
      clave: "cambio",
      glifo: "△",
      nombre: "Riesgo y cambio",
      pregunta: "¿Qué cambió frente al período comparable?",
      respuesta: metricaCambio
        ? `${metricaCambio.label}: ${mostrar(metricaCambio.comparison)}. Es un resultado del snapshot ${corteSnapshot}; no fue recalculado en esta copia.`
        : "El snapshot no contiene una comparación aprobada para este corte.",
    },
    {
      clave: "accion",
      glifo: "→",
      nombre: "Próxima acción",
      pregunta: "¿Qué decisión de esta semana tiene prioridad?",
      respuesta: primeraAccion
        ? `${primeraAccion.title}. ${mostrar(primeraAccion.impact)} · ${primeraAccion.owner} · ${primeraAccion.dueLabel}.`
        : "No hay una acción priorizada en el snapshot vigente.",
    },
    {
      clave: "control",
      glifo: "✓",
      nombre: "Control",
      pregunta: "¿Qué no puede afirmarse todavía?",
      respuesta:
        dataset.fuente === "odoo-real"
          ? `Cartera, rankings y aging usan ${dataset.fuente} al ${fechaCorte}. Facturación, margen e inventario conservan su propio corte y límite; no se combinan para recalcular otro KPI.`
          : `Los rankings usan ${dataset.fuente} al ${fechaCorte}; muestran impacto actual, no probabilidad de cobro.`,
    },
  ];

  return (
    <section id="sec-pulso" className="lienzo-referencia scroll-mt-24 overflow-hidden entrada-suave">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#778198]">Centro ejecutivo · dinero, cambio y acción</p>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-tinta">Qué mueve el resultado ahora</h2>
            <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[#6b6f78]">
              Cada cifra declara su fuente y corte. Cartera, Top 5 y aging comparten el cálculo operativo; los demás KPI conservan sus límites históricos.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[10.5px] font-semibold text-[#4e596d] shadow-flotante">
              {cargandoRemoto ? "sincronizando…" : "fuentes y cortes declarados"}
            </span>
            <p className="mt-1.5 text-[10.5px] text-[#85878c]">Cartera {fechaCorte} · snapshot {corteSnapshot}</p>
          </div>
        </div>

        {errorRemoto ? (
          <p className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800">
            Supabase V2 no respondió; se conserva el snapshot local con sus límites declarados. {errorRemoto}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiExplorable etiqueta="Cartera vencida" valor={fmt(lectura.totalVencido)} nota={`${porcentajeVencido.toFixed(1)}% de cartera clasificable`} porcentaje={porcentajeVencido} tono="rojo" detalle={<><b>Hecho:</b> saldo pendiente con vencimiento anterior al corte {fechaCorte}.<br /><b>Fórmula:</b> saldo pendiente clasificado, bucket actual excluido.<br /><b>Fuente:</b> {dataset.fuente}.</>} />
          <KpiExplorable etiqueta="Mora crítica · 90+" valor={fmt(lectura.totalMoraCritica)} nota={`${moraCriticaPct.toFixed(1)}% de lo vencido`} porcentaje={moraCriticaPct} tono="ambar" detalle={<><b>Hecho:</b> saldo vencido clasificado en 90+ días.<br /><b>Acción:</b> revisar escalamiento, disputa o negociación; no significa pérdida automática.</>} />
          <KpiExplorable etiqueta="Concentración Top 5" valor={`${concentracionTop5.toFixed(1)}%`} nota="del vencido depende de cinco clientes" porcentaje={concentracionTop5} tono="violeta" detalle={<><b>Fórmula:</b> saldo de los cinco clientes vencidos principales ÷ cartera vencida.<br /><b>Uso:</b> detecta dependencia comercial; no estima probabilidad de cobro.</>} />
          <KpiExplorable etiqueta="Brecha de control" valor={`${lectura.sinFechaVencimiento}`} nota="facturas con saldo sin vencimiento" porcentaje={lectura.sinFechaVencimiento > 0 ? 100 : 0} tono="azul" detalle={<><b>Consecuencia:</b> estas facturas quedan fuera de aging y del ranking por atraso.<br /><b>Acción:</b> completar vencimiento y responsable antes de exigir gestión.</>} />
        </div>
        <details className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/45 px-3 py-2 text-[10.5px] text-tintaSuave"><summary className="cursor-pointer font-semibold text-[#536b91]">Contexto separado: facturación, margen e inventario ↘</summary><div className="mt-2 grid gap-2 sm:grid-cols-3">{metricas.filter((m) => m.key !== "resumen_cartera_vencida").map((m) => <div key={m.key}><b>{m.label}:</b> {mostrar(m.displayValue)} · {mostrar(m.comparison)}</div>)}</div></details>

        <div id="sec-impacto" className="mt-5 scroll-mt-24"><MapaImpactoCobranza oportunidades={lectura.oportunidades} riesgos={lectura.riesgos} total={lectura.totalVencido} fmt={fmt} /></div>
        <p className="mt-2 text-[10px] text-[#8b8f98]">
          Cambio por cuenta: sin histórico comparable disponible · {lectura.sinFechaVencimiento} factura(s) con saldo sin fecha de vencimiento quedan fuera del ranking.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div id="sec-acciones" className="scroll-mt-24 rounded-[20px] border border-white/70 bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.75)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-bold text-tinta">Acciones revisadas con el dato operativo</h3>
              <span className="text-[10px] text-[#8b8f98]">operación {fechaCorte} · histórico {corteSnapshot}</span>
            </div>
            {acciones.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {acciones.slice(0, 3).map((accion, indice) => (
                  <li key={accion.key} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-xl bg-white/75 px-3 py-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-tinta text-[10px] font-bold text-white">{indice + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[11.5px] font-semibold text-tinta">{accion.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] ${accion.status === "blocked" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{accion.etiquetaEstado}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-[#6b6f78]">{mostrar(accion.impact)} · {accion.owner} · {accion.dueLabel}</p>
                    </div>
                    <Link href={accion.href} className="rounded-full bg-[#edf1f8] px-2.5 py-1 text-[10px] font-semibold text-[#4f5a70] hover:bg-white">ver</Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[11px] text-[#7c808a]">No hay acciones publicadas para este corte.</p>
            )}
          </div>

          <div className="rounded-[20px] bg-[#16181d] p-4 text-white shadow-[0_14px_30px_-18px_rgba(22,24,29,.7)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-bold">Agentes de decisión</h3>
              <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] text-white/65">hallazgo + límite</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {agentes.map((agente) => (
                <details key={agente.clave} className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px]">{agente.glifo}</span>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/55">{agente.nombre}</p>
                    </div>
                    <div className="mt-3 h-14 rounded-xl bg-white/[.07] p-2">
                      {agente.clave === "oportunidad" ? <div className="flex h-full items-end gap-1.5"><span className="h-[28%] flex-1 rounded-t bg-[#9bb0df]"/><span className="h-[48%] flex-1 rounded-t bg-[#7590c8]"/><span className="h-[76%] flex-1 rounded-t bg-[#536b91]"/><span className="h-full flex-1 rounded-t bg-[#c2703a]"/></div> : null}
                      {agente.clave === "cambio" ? <div className="grid h-full grid-cols-4 gap-1"><span className="rounded bg-white/15"/><span className="rounded bg-white/15"/><span className="rounded bg-white/15"/><span className="grid place-items-center rounded border border-dashed border-white/30 text-xs text-white/60">?</span></div> : null}
                      {agente.clave === "accion" ? <div className="flex h-full items-center gap-1"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#9bb0df] text-[9px] text-[#16181d]">1</span><i className="h-px flex-1 bg-white/30"/><span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[9px]">2</span><i className="h-px flex-1 bg-white/30"/><span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[9px]">3</span></div> : null}
                      {agente.clave === "control" ? <div className="grid h-full grid-cols-4 items-end gap-1"><span className="h-[82%] rounded-t bg-emerald-400"/><span className="h-[55%] rounded-t bg-amber-300"/><span className="h-[36%] rounded-t bg-amber-300"/><span className="h-[18%] rounded-t bg-slate-400"/></div> : null}
                    </div>
                    <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-white/55 group-open:hidden">tocar evidencia ↘</p>
                  </summary>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-white/70"><b>{agente.pregunta}</b><br/>{agente.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
