"use client";

import { useMemo, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelAgentesLateral, type AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import { acumuladosComposicionPorProducto, type AcumuladoProductoComercial } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

type Dimension = "familia" | "modelo" | "color" | "caracteristica" | "licencia";
type AgenteProducto = "atributo" | "mezcla" | "top" | "cobertura";
const SECCIONES = [{ id: "sec-productos", etiqueta: "Espacio de agentes" }];
const DIMENSIONES: { id: Dimension; nombre: string; color: string; suave: string; ayuda: string }[] = [
  { id: "familia", nombre: "Familia / universo", color: "#596bd0", suave: "#edf0ff", ayuda: "EDGE, accesorios, Marvel y otras familias declaradas." },
  { id: "modelo", nombre: "Modelo", color: "#2f9d78", suave: "#e8f8f1", ayuda: "Valor escrito después de MODELO:." },
  { id: "color", nombre: "Color", color: "#e47743", suave: "#fff0e9", ayuda: "Valor escrito después de COLOR:." },
  { id: "caracteristica", nombre: "Característica", color: "#a45ccf", suave: "#f7edff", ayuda: "Diseño o rasgo explícito en el nombre." },
  { id: "licencia", nombre: "Licencia", color: "#c84e56", suave: "#ffedef", ayuda: "Valor escrito después de LICENCIA:." },
];

function declarado(nombre: string, etiquetas: string[]) {
  for (const etiqueta of etiquetas) { const valor = nombre.toUpperCase().match(new RegExp(`${etiqueta}\\s*:\\s*([^|·–—-]+)`, "i"))?.[1]; if (valor) return valor.trim().replace(/\s+/g, " "); }
  return null;
}
function categoria(producto: AcumuladoProductoComercial, dimension: Dimension) {
  const nombre = producto.etiqueta.toUpperCase();
  if (dimension === "familia") return nombre.includes("ACCESOR") ? "EDGE accesorio" : nombre.includes("MARVEL") ? "Marvel" : nombre.includes("EDGE") ? "EDGE" : "Otra familia declarada";
  if (dimension === "modelo") return declarado(producto.etiqueta, ["MODELO"]) ?? "Sin modelo declarado";
  if (dimension === "color") return declarado(producto.etiqueta, ["COLOR"]) ?? "Sin color declarado";
  if (dimension === "caracteristica") return declarado(producto.etiqueta, ["CARACTER[IÍ]STICA", "DISE[ÑN]O", "TIPO"]) ?? "Sin característica declarada";
  return declarado(producto.etiqueta, ["LICENCIA"]) ?? "Sin licencia declarada";
}

export default function PaginaCategoriasProducto() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const [dimension, setDimension] = useState<Dimension>("familia");
  const [activo, setActivo] = useState<AgenteProducto>("atributo");
  const productos = useMemo(() => acumuladosComposicionPorProducto(dataset), [dataset]);
  const activa = DIMENSIONES.find((x) => x.id === dimension) ?? DIMENSIONES[0];
  const total = productos.reduce((s, x) => s + x.valor, 0);
  const categorias = useMemo(() => { const mapa = new Map<string, { nombre: string; valor: number; productos: number; unidades: number }>(); for (const producto of productos) { const nombre = categoria(producto, dimension); const actual = mapa.get(nombre) ?? { nombre, valor: 0, productos: 0, unidades: 0 }; actual.valor += producto.valor; actual.productos++; actual.unidades += producto.unidades; mapa.set(nombre, actual); } return [...mapa.values()].sort((a, b) => b.valor - a.valor); }, [productos, dimension]);
  const principal = categorias[0]; const vacio = categorias.find((x) => x.nombre.startsWith("Sin ")); const cobertura = total ? ((total - (vacio?.valor ?? 0)) / total) * 100 : 0;
  if (cargando) return <SkeletonPagina />;
  const agentes: AgenteLateral<AgenteProducto>[] = [
    { id: "atributo", iniciales: "AT", nombre: "Atributo activo", senal: activa.nombre, color: activa.color, suave: activa.suave },
    { id: "mezcla", iniciales: "MX", nombre: "Mezcla de producto", senal: principal?.nombre ?? "sin líneas", color: "#a45ccf", suave: "#f7edff" },
    { id: "top", iniciales: "TP", nombre: "Top producto", senal: `${productos.length} referencias`, color: "#596bd0", suave: "#edf0ff" },
    { id: "cobertura", iniciales: "VD", nombre: "Vacío declarado", senal: `${cobertura.toFixed(1)}% cubierto`, color: "#c84e56", suave: "#ffedef" },
  ];
  const agente = agentes.find((x) => x.id === activo) ?? agentes[0];
  const lateral = <><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#71809a]">Resultado del agente</p><div className="mt-4 rounded-2xl p-4" style={{ background: agente.suave }}><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[12px] font-black" style={{ color: agente.color }}>{agente.iniciales}</span><p className="mt-4 text-sm font-black text-[#2f3a52]">{agente.nombre}</p><p className="mt-1 text-[11px] font-bold" style={{ color: agente.color }}>{agente.senal}</p></div><div className="mt-4 rounded-2xl bg-[#f6f8fc] p-3"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#77839a]">Handoff</p><p className="mt-1 text-[11px] leading-relaxed text-[#59667e]">La lectura usa líneas a precio de lista. No se presenta como venta neta ni margen porque el descuento no está en la línea.</p></div></>;
  const centro = activo === "atributo" ? <><p className="text-[10px] font-black uppercase tracking-[.14em]" style={{ color: activa.color }}>Dimensión de lectura</p><h3 className="mt-1 text-2xl font-black text-[#263149]">¿Cómo quieres mirar el producto?</h3><div className="mt-7 grid gap-3 sm:grid-cols-2">{DIMENSIONES.map((item) => <button type="button" key={item.id} onClick={() => setDimension(item.id)} className="rounded-2xl border p-4 text-left transition hover:scale-[1.01]" style={{ borderColor: `${item.color}33`, background: dimension === item.id ? item.suave : "#f8f9fd", boxShadow: dimension === item.id ? `0 0 0 2px ${item.color}55` : undefined }}><p className="text-sm font-black" style={{ color: item.color }}>{item.nombre}</p><p className="mt-1 text-[11px] leading-relaxed text-[#66738b]">{item.ayuda}</p></button>)}</div></> : activo === "mezcla" ? <><p className="text-[10px] font-black uppercase tracking-[.14em]" style={{ color: activa.color }}>Mix de {activa.nombre.toLowerCase()}</p><h3 className="mt-1 text-2xl font-black text-[#263149]">Participación principal</h3><div className="mt-8 space-y-5">{categorias.slice(0, 5).map((item) => <div key={item.nombre}><div className="mb-2 flex justify-between gap-3 text-sm font-black text-[#536078]"><span className="truncate">{item.nombre}</span><span>{total ? ((item.valor / total) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-4 overflow-hidden rounded-full bg-[#e7ebf4]"><div className="h-full rounded-full" style={{ width: `${total ? (item.valor / total) * 100 : 0}%`, background: activa.color }} /></div></div>)}</div></> : activo === "top" ? <><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#596bd0]">Referencias principales</p><h3 className="mt-1 text-2xl font-black text-[#263149]">Productos que mueven el mix</h3><div className="mt-6 space-y-2">{productos.slice(0, 5).map((producto) => <div key={producto.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-2xl bg-[#f7f9fd] p-3"><div className="min-w-0"><p className="truncate text-[11px] font-black text-[#35415a]">{producto.sku} · {producto.etiqueta}</p><p className="text-[10px] font-semibold text-[#738099]">{producto.unidades.toLocaleString("es-GT")} unidades · {producto.pedidos} pedidos</p></div><p className="self-center text-[11px] font-black text-[#596bd0]">{total ? ((producto.valor / total) * 100).toFixed(1) : "0.0"}%</p></div>)}</div></> : <div className="grid h-full place-items-center"><div className="max-w-md text-center"><div className="mx-auto grid h-44 w-44 place-items-center rounded-full border-[18px] border-[#f7e4e7]" style={{ borderTopColor: "#c84e56", transform: "rotate(45deg)" }}><div style={{ transform: "rotate(-45deg)" }}><p className="text-4xl font-black tracking-[-.06em] text-[#263149]">{cobertura.toFixed(1)}%</p><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#72809b]">cubierto</p></div></div><p className="mt-7 text-lg font-black text-[#29354d]">Atributo declarado en el catálogo</p><p className="mt-2 text-sm text-[#6f7b92]">{vacio?.productos ?? 0} productos aún no declaran {activa.nombre.toLowerCase()}.</p></div></div>;
  return <div className="space-y-5"><Encabezado titulo="Categorías de producto" secciones={SECCIONES} dataset={dataset} modulo="ventas" /><div id="sec-productos" className="scroll-mt-24"><PanelAgentesLateral titulo="Acumulado histórico por categoría de producto" contexto={`${fmt(total)} · corte ${fechaCorte}`} agentes={agentes} activo={activo} onSeleccionar={setActivo} lateral={lateral}>{centro}</PanelAgentesLateral></div></div>;
}
