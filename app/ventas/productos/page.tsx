"use client";

import { useEffect, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelAgentesReferencia } from "@/components/commercial/PanelAgentesReferencia";
import type { AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import { useApp } from "@/lib/store";

type AgenteProducto = "familia" | "tipo" | "modelo" | "licencia" | "cobertura";

type FilaLectura = { nombre: string; productos?: number; valor: number; pct: number };
type LecturaProducto = {
  iniciales: string;
  nombre: string;
  senal: string;
  titulo: string;
  explicacion: string;
  hallazgo: string;
  filas: FilaLectura[];
};

const SECCIONES = [{ id: "sec-productos", etiqueta: "Agentes de producto" }];

// Clasificación disponible en el corte analítico actual. No deriva de la UI:
// los agentes sólo muestran y explican esta salida ya calculada.
const LECTURAS: Record<AgenteProducto, LecturaProducto> = {
  familia: {
    iniciales: "FA", nombre: "Familias", senal: "4 niveles disponibles",
    titulo: "¿Qué familia mueve el negocio?",
    explicacion: "La lectura separa la familia principal del producto; no mezcla modelo ni licencia.",
    hallazgo: "Cascos concentra 72.07% del valor clasificado.",
    filas: [
      { nombre: "Cascos", productos: 584, valor: 12461816, pct: 72.07 },
      { nombre: "Equipo", productos: 51, valor: 3257233, pct: 18.84 },
      { nombre: "Llantas", productos: 30, valor: 1173250, pct: 6.78 },
      { nombre: "Accesorios", productos: 24, valor: 235964, pct: 1.36 },
      { nombre: "Sin clasificar", productos: 41, valor: 164069, pct: 0.95 },
    ],
  },
  tipo: {
    iniciales: "TC", nombre: "Tipo de casco", senal: "6 tipos observados",
    titulo: "¿Qué tipo de casco sostiene la familia?",
    explicacion: "Este agente baja un nivel dentro de Cascos y conserva el producto no identificable como un límite visible.",
    hallazgo: "Integral y Modular reúnen la mayor parte de los cascos con tipo declarado.",
    filas: [
      { nombre: "Integral", productos: 341, valor: 0, pct: 55.52 },
      { nombre: "Modular", productos: 116, valor: 0, pct: 27.59 },
      { nombre: "Abatible", productos: 64, valor: 0, pct: 11.15 },
      { nombre: "Cross modular", productos: 18, valor: 0, pct: 3.78 },
      { nombre: "Semi integral", productos: 26, valor: 0, pct: 1.03 },
      { nombre: "Doble propósito", productos: 7, valor: 0, pct: 0.88 },
    ],
  },
  modelo: {
    iniciales: "MO", nombre: "Modelos", senal: "BOSTON lidera el mix",
    titulo: "¿Qué modelo explica el mix?",
    explicacion: "El modelo se lee cuando está declarado en la ficha. “Sin modelo” no se rellena ni se interpreta como un modelo.",
    hallazgo: "Q4.45M permanece sin modelo declarado: es una brecha de catálogo, no un modelo comercial.",
    filas: [
      { nombre: "Boston", productos: 24, valor: 1973341, pct: 11.41 },
      { nombre: "Shangai", productos: 30, valor: 911832, pct: 5.27 },
      { nombre: "Frankie", productos: 52, valor: 681469, pct: 3.94 },
      { nombre: "Sin modelo", valor: 4449970, pct: 25.73 },
    ],
  },
  licencia: {
    iniciales: "LI", nombre: "Licencias", senal: "85.61% sin licencia",
    titulo: "¿Qué licencias aparecen en la venta?",
    explicacion: "La licencia es una capa distinta de familia y modelo. Sólo se presenta como declarada cuando la clasificación la identifica.",
    hallazgo: "DC Comics es la licencia con mayor participación; la mayor parte del catálogo permanece sin licencia.",
    filas: [
      { nombre: "Sin licencia", valor: 14804422, pct: 85.61 },
      { nombre: "DC Comics", valor: 1278885, pct: 7.4 },
      { nombre: "Looney Tunes", valor: 527200, pct: 3.05 },
      { nombre: "Marvel", valor: 436656, pct: 2.53 },
    ],
  },
  cobertura: {
    iniciales: "CO", nombre: "Cobertura", senal: "689 de 730 clasificados",
    titulo: "¿Qué falta para cerrar la clasificación?",
    explicacion: "La cobertura no es una categoría de producto: mide cuántas referencias quedan fuera de una familia confirmada.",
    hallazgo: "41 productos, equivalentes a 0.95% del valor, siguen sin familia declarada.",
    filas: [
      { nombre: "Clasificados", productos: 689, valor: 17128263, pct: 99.05 },
      { nombre: "Sin clasificar", productos: 41, valor: 164069, pct: 0.95 },
    ],
  },
};

function BarrasDeLectura({ lectura, fmt }: { lectura: LecturaProducto; fmt: (valor: number) => string }) {
  const tieneValor = lectura.filas.some((fila) => fila.valor > 0);
  return <section aria-live="polite">
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6e98f3]">Agente de producto</p>
    <h2 className="mt-2 text-[clamp(1.7rem,3vw,2.55rem)] font-black tracking-[-.06em] text-[#121c32]">{lectura.titulo}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6a7893]">{lectura.explicacion}</p>
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
      <div className="space-y-4">
        {lectura.filas.map((fila, indice) => <div key={fila.nombre}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] font-bold text-[#34435f]">
            <span>{fila.nombre}{fila.productos ? <span className="ml-2 text-[#9aa9c4]">{fila.productos} productos</span> : null}</span>
            <span className="text-[#4b7fe8]">{fila.pct.toFixed(2)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#eef3ff]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4b80ee,#87c6ff)] transition-all duration-700" style={{ width: `${Math.max(fila.pct, 1.5)}%`, opacity: 1 - indice * 0.08 }} /></div>
          {tieneValor && fila.valor > 0 ? <p className="mt-1 text-[10px] font-semibold text-[#8997b1]">{fmt(fila.valor)}</p> : null}
        </div>)}
      </div>
      <aside className="rounded-2xl border border-[#e7eefc] bg-[#f8fbff] p-5 shadow-[0_12px_28px_rgba(75,115,190,.08)]">
        <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7d91b8]">Hallazgo</p>
        <p className="mt-3 text-sm font-black leading-relaxed text-[#283a5d]">{lectura.hallazgo}</p>
        <p className="mt-5 border-t border-[#e1e9fb] pt-4 text-[10px] font-semibold leading-relaxed text-[#74839e]">La gráfica cambia con el agente activo y conserva el límite de cada clasificación.</p>
      </aside>
    </div>
  </section>;
}

export default function PaginaCategoriasProducto() {
  const { cargando, fmt, dataset } = useApp();
  const [activo, setActivo] = useState<AgenteProducto>("familia");
  useEffect(() => {
    document.body.classList.add("producto-lienzo-blanco");
    return () => document.body.classList.remove("producto-lienzo-blanco");
  }, []);
  if (cargando) return <SkeletonPagina />;

  const lectura = LECTURAS[activo];
  const agentes: AgenteLateral<AgenteProducto>[] = (Object.keys(LECTURAS) as AgenteProducto[]).map((id) => ({
    id, iniciales: LECTURAS[id].iniciales, nombre: LECTURAS[id].nombre, senal: LECTURAS[id].senal, color: "#4b80ee", suave: "#eaf1ff",
  }));

  return <div className="space-y-5"><Encabezado titulo="Categorías de producto" secciones={SECCIONES} dataset={dataset} modulo="ventas" /><div id="sec-productos" className="scroll-mt-24"><PanelAgentesReferencia agentes={agentes} activo={activo} onSeleccionar={setActivo}><BarrasDeLectura lectura={lectura} fmt={fmt} /></PanelAgentesReferencia></div></div>;
}
