"use client";

import { SkeletonPagina } from "@/components/Basicos";
import { Encabezado } from "@/components/Encabezado";
import { FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes } from "@/components/Argumento";
import { DecisionPanelV2 } from "@/components/DecisionPanelV2";
import { AGENTES_COMERCIALES_FORECAST } from "@/components/commercial/OperacionAgentes";
import {
  OperacionControl,
  OperacionKpi,
  OperacionPuente,
  OperacionRanking,
} from "@/components/commercial/OperacionVisuales";
import { analiticaForecast, type PuntoForecastComercial } from "@/lib/commercial-operacion";
import { SUPUESTOS_FORECAST } from "@/lib/simulados";
import { useApp } from "@/lib/store";
import { useState } from "react";

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-puente", etiqueta: "Brecha" },
  { id: "sec-escenarios", etiqueta: "Escenarios" },
  { id: "sec-contribuyentes", etiqueta: "Contribuyentes" },
  { id: "sec-reactivacion", etiqueta: "Reactivación" },
  { id: "sec-control", etiqueta: "Confianza" },
];

const SERIES = [
  { clave: "optimista" as const, etiqueta: "Optimista", color: "#f4756b" },
  { clave: "base" as const, etiqueta: "Base", color: "#796de0" },
  { clave: "pesimista" as const, etiqueta: "Pesimista", color: "#2fbfae" },
];

function CurvaEscenarios({ puntos, fmt }: { puntos: PuntoForecastComercial[]; fmt: (valor: number) => string }) {
  const [activa, setActiva] = useState<"optimista" | "base" | "pesimista">("base");
  const ancho = 820;
  const alto = 300;
  const margen = { izquierda: 55, derecha: 28, arriba: 25, abajo: 38 };
  const maximo = Math.max(1, ...puntos.map((p) => p.optimista));
  const x = (semana: number) => margen.izquierda + ((semana - 1) / 12) * (ancho - margen.izquierda - margen.derecha);
  const y = (valor: number) => alto - margen.abajo - (valor / maximo) * (alto - margen.arriba - margen.abajo);
  const ruta = (clave: "optimista" | "base" | "pesimista") => puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.semana)},${y(p[clave])}`).join(" ");

  return (
    <article className="rounded-[28px] border border-white/90 bg-white/65 p-5 shadow-flotante">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-tinta">Cobro acumulado por escenario</h3>
          <p className="mt-1 text-[11px] text-tintaSuave">13 semanas · curva mecánica, no probabilidad de caja</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {SERIES.map((serie) => (
            <button type="button" onClick={() => setActiva(serie.clave)} key={serie.clave} className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold transition ${activa === serie.clave ? "bg-slate-100 text-tinta" : "text-tintaSuave"}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: serie.color }} />{serie.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="mt-4 w-full" role="img" aria-label="Curvas de cobro acumulado de los escenarios optimista, base y pesimista">
        {[0, 0.5, 1].map((proporcion) => (
          <g key={proporcion}>
            <line x1={margen.izquierda} y1={y(maximo * proporcion)} x2={ancho - margen.derecha} y2={y(maximo * proporcion)} stroke="#dfe5ef" strokeDasharray="3 6" />
            <text x={margen.izquierda - 9} y={y(maximo * proporcion) + 4} textAnchor="end" fontSize="9" fill="#8d96a8">{fmt(maximo * proporcion)}</text>
          </g>
        ))}
        {SERIES.map((serie) => <path key={serie.clave} d={ruta(serie.clave)} fill="none" stroke={serie.color} strokeWidth={activa === serie.clave ? "4" : "2"} opacity={activa === serie.clave ? "1" : ".28"} strokeLinejoin="round" strokeLinecap="round" onClick={() => setActiva(serie.clave)} className="cursor-pointer" />)}
        {puntos.map((p) => <text key={p.semana} x={x(p.semana)} y={alto - 13} textAnchor="middle" fontSize="9" fill="#8d96a8">{p.semana}</text>)}
      </svg>
      <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-tintaSuave"><b className="text-tinta">Escenario seleccionado: {activa}.</b> Tocá otra curva para aislarla. Esto cambia sólo la lectura visual; no transforma el supuesto mecánico en probabilidad.</p>
    </article>
  );
}

export default function PaginaForecast() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const analitica = analiticaForecast(dataset, fechaCorte);

  if (cargando) return <SkeletonPagina />;

  const agentes = (
    <FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_COMERCIALES_FORECAST} />
  );

  return (
    <div className="space-y-6">
      <Encabezado titulo="Forecast comercial" secciones={SECCIONES} dataset={dataset} modulo="forecast" />
      <DecisionPanelV2 modulo="forecast" />

      <section id="sec-puente" className="scroll-mt-24">
        <LienzoConAgentes titulo="Brecha actual y horizonte" agentes={agentes}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6876d8]">Lectura ejecutiva</p>
              <h2 className="mt-1 text-xl font-bold text-tinta">Cuánto podría entrar y qué queda fuera</h2>
            </div>
            <p className="text-[11px] text-tintaSuave">Corte {fechaCorte} · 13 semanas simuladas</p>
          </div>
          <div className="mt-5">
            <OperacionPuente
              titulo="Puente desde la cartera actual"
              subtitulo="La cartera abierta es una referencia operativa, no una meta comercial aprobada."
              pasos={[
                { etiqueta: "Cartera abierta", valor: fmt(analitica.saldoAbierto), nota: `${analitica.facturasAbiertas} facturas con saldo` },
                { etiqueta: "Elegible", valor: fmt(analitica.saldoElegible), nota: `${analitica.facturasElegibles} con vencimiento` },
                { etiqueta: "Base semana 13", valor: fmt(analitica.base13), nota: "escenario mecánico", tono: "positivo" },
                { etiqueta: "Brecha a cartera", valor: fmt(analitica.brechaHorizonte), nota: "fuera del base o sin dato", tono: "alerta" },
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OperacionKpi etiqueta="Escenario base" valor={fmt(analitica.base13)} nota="Cobro acumulado simulado a semana 13" tono="positivo" />
            <OperacionKpi etiqueta="Brecha de escenarios" valor={fmt(analitica.brechaEscenarios)} nota="Optimista menos pesimista · incertidumbre del simulacro" tono="alerta" />
            <OperacionKpi etiqueta="Saldo disputado" valor={fmt(analitica.saldoDisputado)} nota="El pesimista lo excluye por supuesto" tono={analitica.saldoDisputado > 0 ? "alerta" : "normal"} />
            <OperacionKpi etiqueta="Meta comercial" valor="Sin dato" nota="No existe una meta aprobada en el dataset; no se inventa cumplimiento" tono="alerta" />
          </div>
        </LienzoConAgentes>
      </section>

      <section id="sec-escenarios" className="scroll-mt-24">
        <LienzoConAgentes titulo="Escenarios y supuestos" agentes={agentes}>
          <div className="grid gap-4 sm:grid-cols-3">
            <OperacionKpi etiqueta="Optimista · semana 13" valor={fmt(analitica.optimista13)} nota="Cobro 10 días después del vencimiento o corte" />
            <OperacionKpi etiqueta="Base · semana 13" valor={fmt(analitica.base13)} nota="Cobro 30 días después del vencimiento o corte" tono="positivo" />
            <OperacionKpi etiqueta="Pesimista · semana 13" valor={fmt(analitica.pesimista13)} nota="Cobro a 60 días; disputas fuera del horizonte" />
          </div>
          <div className="mt-4"><CurvaEscenarios puntos={analitica.puntos} fmt={fmt} /></div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-tintaSuave">
            Ningún escenario tiene probabilidad asignada: no existe histórico de cobro para calibrarla. Elegir “base” no significa 50% ni “más probable”.
          </p>
        </LienzoConAgentes>
      </section>

      <section id="sec-contribuyentes" className="scroll-mt-24">
        <LienzoConAgentes titulo="Quién sostiene el escenario base" agentes={agentes}>
          <OperacionRanking titulo="Clientes por contribución al base" subtitulo="Saldo pendiente elegible que cae dentro del horizonte de 13 semanas" filas={analitica.topContribuyentes} formatear={fmt} vacio="No hay facturas elegibles dentro del horizonte base." />
        </LienzoConAgentes>
      </section>

      <section id="sec-reactivacion" className="scroll-mt-24">
        <LienzoConAgentes titulo="Oportunidades de reactivación" agentes={agentes}>
          <OperacionRanking titulo={`Top reactivación · ${analitica.reactivacionTotal} clientes perdidos`} subtitulo={`${fmt(analitica.reactivacionValorHistorico)} facturado por ellos el año anterior · no afirma probabilidad ni ingreso futuro`} filas={analitica.reactivacion} formatear={fmt} vacio="No hay dos años de facturación comparables o no existen clientes perdidos bajo esta definición." />
        </LienzoConAgentes>
      </section>

      <section id="sec-control" className="scroll-mt-24">
        <LienzoConAgentes titulo="Confianza y controles" agentes={agentes}>
          <OperacionControl
            titulo="Por qué esto sigue siendo una simulación"
            items={[
              "No existe meta comercial aprobada en el esquema; la brecha mostrada es contra la cartera abierta, no contra una cuota.",
              "No hay histórico de promesas y cobros para estimar probabilidades por cliente o factura.",
              `${fmt(analitica.saldoSinVencimiento)} de saldo no entra a las curvas porque no tiene fecha de vencimiento.`,
              ...SUPUESTOS_FORECAST.slice(0, 2),
            ]}
          />
        </LienzoConAgentes>
      </section>
    </div>
  );
}
