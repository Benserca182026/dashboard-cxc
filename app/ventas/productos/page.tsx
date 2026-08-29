"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelAgentesReferencia } from "@/components/commercial/PanelAgentesReferencia";
import type { AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import { useApp } from "@/lib/store";

type AgenteProducto = "familia" | "tipo" | "modelo" | "licencia" | "cobertura";
type Enfoque = "riesgo" | "atencion" | "oportunidad" | "analisis";
type FilaLectura = { nombre: string; pct: number; etiqueta?: string };
type LecturaProducto = {
  iniciales: string;
  nombre: string;
  pregunta: string;
  kpiVisual: "dona" | "barras" | "pareto" | "cobertura";
  kpiPct: number;
  kpiEtiqueta: string;
  kpis: string[];
  miniDatos: { etiqueta: string; valor: number }[];
  lecturas: Record<Enfoque, string>;
  filas: FilaLectura[];
  notaKpi?: string;
};

const LECTURAS: Record<AgenteProducto, LecturaProducto> = {
  familia: {
    iniciales: "FA",
    nombre: "Familias",
    pregunta: "¿Qué familia sostiene la venta?",
    kpiVisual: "dona",
    kpiPct: 72.07,
    kpiEtiqueta: "Cascos",
    kpis: ["Cascos 72.07%", "Equipo 18.84%"],
    miniDatos: [
      { etiqueta: "Cascos", valor: 72.07 },
      { etiqueta: "Equipo", valor: 18.84 },
      { etiqueta: "Otras familias", valor: 9.09 },
    ],
    lecturas: {
      riesgo: "Cascos concentra 72.07% del valor: el negocio depende de una sola familia.",
      atencion: "Equipo aporta 18.84%; el mix fuera de Cascos todavía tiene poco peso.",
      oportunidad: "Cascos es la familia con mayor palanca para surtido y exhibición.",
      analisis: "Compara la contribución de cada familia antes de decidir compras por categoría.",
    },
    filas: [
      { nombre: "Cascos", pct: 72.07 },
      { nombre: "Equipo", pct: 18.84 },
      { nombre: "Llantas", pct: 6.78 },
      { nombre: "Accesorios", pct: 1.36 },
    ],
  },
  tipo: {
    iniciales: "TC",
    nombre: "Tipo de casco",
    pregunta: "¿Qué tipo de casco domina el mix?",
    kpiVisual: "barras",
    kpiPct: 55.52,
    kpiEtiqueta: "Integral",
    kpis: ["Integral 55.52%", "Modular 27.59%", "Abatible 11.15%"],
    miniDatos: [
      { etiqueta: "Integral", valor: 55.52 },
      { etiqueta: "Modular", valor: 27.59 },
      { etiqueta: "Abatible", valor: 11.15 },
    ],
    lecturas: {
      riesgo: "Integral reúne 55.52% de los cascos: una variación ahí afectaría gran parte del mix.",
      atencion: "Modular y Abatible requieren una propuesta diferenciada.",
      oportunidad: "Integral y Modular concentran la mayor base para campañas y reposición.",
      analisis: "Lee los tipos dentro de Cascos; no los mezcles con familia, modelo o licencia.",
    },
    filas: [
      { nombre: "Integral", pct: 55.52 },
      { nombre: "Modular", pct: 27.59 },
      { nombre: "Abatible", pct: 11.15 },
      { nombre: "Cross modular", pct: 3.78 },
      { nombre: "Semi integral", pct: 1.03 },
      { nombre: "Doble propósito", pct: 0.88 },
    ],
  },
  modelo: {
    iniciales: "MO",
    nombre: "Modelos",
    pregunta: "¿Qué modelos explican la facturación?",
    kpiVisual: "pareto",
    kpiPct: 11.41,
    kpiEtiqueta: "Boston",
    kpis: ["Boston 11.41%", "Shangai 5.27%", "Frankie 3.94%", "Q4.45M · 25.73% sin atribución"],
    miniDatos: [
      { etiqueta: "Boston", valor: 11.41 },
      { etiqueta: "Shangai", valor: 5.27 },
      { etiqueta: "Frankie", valor: 3.94 },
    ],
    lecturas: {
      riesgo: "Q4.45M no se puede atribuir a un modelo: limita medir dependencia y reposición por modelo.",
      atencion: "Boston, Shangai y Frankie tienen comportamientos distintos y no deben tratarse como un solo mix.",
      oportunidad: "Boston es el modelo declarado con mayor peso: úsalo como punto de partida comercial.",
      analisis: "El Pareto muestra qué modelos declarados merecen seguimiento individual.",
    },
    filas: [
      { nombre: "Boston", pct: 11.41 },
      { nombre: "Shangai", pct: 5.27 },
      { nombre: "Frankie", pct: 3.94 },
    ],
    notaKpi: "Q4.45M · 25.73% sin atribución a modelo",
  },
  licencia: {
    iniciales: "LI",
    nombre: "Licencias",
    pregunta: "¿Qué peso comercial tienen las licencias?",
    kpiVisual: "dona",
    kpiPct: 85.61,
    kpiEtiqueta: "Sin licencia",
    kpis: ["Sin licencia 85.61%", "DC Comics 7.40%", "Looney Tunes 3.05%", "Marvel 2.53%"],
    miniDatos: [
      { etiqueta: "Producto genérico", valor: 85.61 },
      { etiqueta: "Producto con licencia", valor: 14.39 },
    ],
    lecturas: {
      riesgo: "La venta está dominada por producto sin licencia, no por una licencia específica.",
      atencion: "DC Comics, Looney Tunes y Marvel requieren campañas separadas por propiedad.",
      oportunidad: "DC Comics es la licencia con mayor participación declarada para una activación puntual.",
      analisis: "Contrasta venta con licencia frente a producto genérico antes de definir promociones.",
    },
    filas: [
      { nombre: "Sin licencia", pct: 85.61 },
      { nombre: "DC Comics", pct: 7.4 },
      { nombre: "Looney Tunes", pct: 3.05 },
      { nombre: "Marvel", pct: 2.53 },
    ],
  },
  cobertura: {
    iniciales: "CO",
    nombre: "Cobertura",
    pregunta: "¿Qué tan visible es el portafolio para decidir?",
    kpiVisual: "cobertura",
    kpiPct: 99.05,
    kpiEtiqueta: "Valor clasificado",
    kpis: ["99.05% del valor clasificado", "0.95% pendiente"],
    miniDatos: [
      { etiqueta: "Visible", valor: 99.05 },
      { etiqueta: "Pendiente", valor: 0.95 },
    ],
    lecturas: {
      riesgo: "0.95% del valor sigue fuera de la lectura comercial; es pequeño, pero afecta decisiones de precisión.",
      atencion: "Las 41 referencias pendientes deben priorizarse si participan en familias estratégicas.",
      oportunidad: "99.05% del valor ya está visible para comparar familias y tomar decisiones de portafolio.",
      analisis: "La cobertura mide confianza de lectura comercial; no es un mensaje técnico para el cliente.",
    },
    filas: [
      { nombre: "Valor clasificado", pct: 99.05, etiqueta: "99.05%" },
      { nombre: "Pendiente", pct: 0.95, etiqueta: "0.95%" },
    ],
  },
};

function GraficoDetalle({ lectura }: { lectura: LecturaProducto }) {
  const maximo = Math.max(...lectura.filas.map((fila) => fila.pct), 1);

  if (lectura.kpiVisual === "dona" || lectura.kpiVisual === "cobertura") {
    return (
      <div className="product-detail-mix">
        <div
          className={`product-detail-donut ${lectura.kpiVisual === "cobertura" ? "product-detail-donut-coverage" : ""}`}
          style={{ "--detail-value": `${lectura.kpiPct}%` } as CSSProperties}
        >
          <span><b>{lectura.kpiPct.toFixed(2)}%</b><small>{lectura.kpiEtiqueta}</small></span>
        </div>
        <div className="product-detail-legend">
          {lectura.filas.map((fila) => (
            <div key={fila.nombre}><i /><span>{fila.nombre}</span><b>{fila.etiqueta ?? `${fila.pct.toFixed(2)}%`}</b></div>
          ))}
        </div>
      </div>
    );
  }

  if (lectura.kpiVisual === "pareto") {
    return (
      <div>
        <div className="product-detail-pareto" aria-label="Pareto de modelos declarados">
          {lectura.filas.map((fila) => (
            <div key={fila.nombre}><b>{fila.pct.toFixed(2)}%</b><i style={{ height: `${Math.max(18, fila.pct / maximo * 100)}%` }} /><span>{fila.nombre}</span></div>
          ))}
        </div>
        {lectura.notaKpi ? <p className="product-detail-note">{lectura.notaKpi}</p> : null}
      </div>
    );
  }

  return (
    <div className="product-detail-bars" aria-label="Ranking de tipos de casco">
      {lectura.filas.map((fila) => (
        <div key={fila.nombre}>
          <span><b>{fila.nombre}</b><strong>{fila.pct.toFixed(2)}%</strong></span>
          <i><em style={{ width: `${Math.max(2, fila.pct / maximo * 100)}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function DetalleLectura({ lectura }: { lectura: LecturaProducto }) {
  return (
    <section className="product-detail-dashboard" aria-live="polite">
      <div className="product-detail-dashboard-head">
        <div><p>Composición de la dimensión</p><h3>{lectura.nombre}</h3></div>
        <span>{lectura.kpiEtiqueta}<b>{lectura.kpiPct.toFixed(2)}%</b></span>
      </div>
      <GraficoDetalle lectura={lectura} />
    </section>
  );
}

export default function PaginaCategoriasProducto() {
  const { cargando, dataset } = useApp();
  const [activo, setActivo] = useState<AgenteProducto>("familia");

  useEffect(() => {
    document.body.classList.add("producto-lienzo-blanco");
    return () => document.body.classList.remove("producto-lienzo-blanco");
  }, []);

  if (cargando) return <SkeletonPagina />;

  const lectura = LECTURAS[activo];
  const agentes: AgenteLateral<AgenteProducto>[] = (Object.keys(LECTURAS) as AgenteProducto[]).map((id) => ({
    id,
    iniciales: LECTURAS[id].iniciales,
    nombre: LECTURAS[id].nombre,
    senal: LECTURAS[id].kpis[0],
    pregunta: LECTURAS[id].pregunta,
    kpiPct: LECTURAS[id].kpiPct,
    kpiEtiqueta: LECTURAS[id].kpiEtiqueta,
    kpis: LECTURAS[id].kpis,
    miniDatos: LECTURAS[id].miniDatos,
    kpiVisual: LECTURAS[id].kpiVisual,
    lecturas: LECTURAS[id].lecturas,
    color: "#4b80ee",
    suave: "#eaf1ff",
  }));

  return (
    <div className="productos-experiencia">
      <header className="product-page-header">
        <div>
          <p>Ventas · Portafolio</p>
          <h1>Clasificación <span>comercial de productos</span></h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <div id="sec-productos">
        <PanelAgentesReferencia agentes={agentes} activo={activo} onSeleccionar={setActivo}>
          <DetalleLectura lectura={lectura} />
        </PanelAgentesReferencia>
      </div>
    </div>
  );
}
