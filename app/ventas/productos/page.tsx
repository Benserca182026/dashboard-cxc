"use client";

import { useMemo, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { SkeletonPagina } from "@/components/Basicos";
import { ModuloGuiado } from "@/components/commercial/ModuloGuiado";
import { acumuladosComposicionPorProducto, type AcumuladoProductoComercial } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

type Dimension = "familia" | "modelo" | "color" | "caracteristica" | "licencia";
type AgenteId = "mix" | "atributo" | "concentracion" | "vacio";

const DIMENSIONES: { id: Dimension; nombre: string; ayuda: string; color: string; suave: string }[] = [
  { id: "familia", nombre: "Familia / universo", ayuda: "EDGE, Edge accesorio, Marvel y otras familias declaradas en el nombre", color: "#596bd0", suave: "#edf0ff" },
  { id: "modelo", nombre: "Modelo", ayuda: "valor que sigue a MODELO: en el nombre del producto", color: "#2f9d78", suave: "#e8f8f1" },
  { id: "color", nombre: "Color", ayuda: "valor que sigue a COLOR: en el nombre del producto", color: "#e47743", suave: "#fff0e9" },
  { id: "caracteristica", nombre: "Característica", ayuda: "diseño o característica explícita en la descripción del producto", color: "#a45ccf", suave: "#f7edff" },
  { id: "licencia", nombre: "Licencia", ayuda: "valor que sigue a LICENCIA:; no se infiere si el campo no existe", color: "#c84e56", suave: "#ffedef" },
];

const SECCIONES = [
  { id: "sec-mix-producto", etiqueta: "Mix de producto" },
  { id: "sec-ranking-producto", etiqueta: "Ranking" },
  { id: "sec-regla-producto", etiqueta: "Regla del dato" },
];

function limpiar(valor: string) {
  return valor.replace(/\s+/g, " ").replace(/[·|]/g, " ").trim();
}

function valorDeclarado(nombre: string, etiquetas: string[]) {
  const fuente = nombre.toUpperCase();
  for (const etiqueta of etiquetas) {
    const patron = new RegExp(`${etiqueta}\\s*:\\s*([^|·–—-]+)`, "i");
    const encontrado = fuente.match(patron)?.[1];
    if (encontrado) return limpiar(encontrado);
  }
  return null;
}

function categoriaDe(producto: AcumuladoProductoComercial, dimension: Dimension) {
  const nombre = producto.etiqueta.toUpperCase();
  if (dimension === "familia") {
    if (nombre.includes("ACCESOR")) return "EDGE accesorio";
    if (nombre.includes("MARVEL")) return "Marvel";
    if (nombre.includes("EDGE")) return "EDGE";
    return "Otra familia declarada";
  }
  if (dimension === "modelo") return valorDeclarado(producto.etiqueta, ["MODELO"]) ?? "Sin modelo declarado";
  if (dimension === "color") return valorDeclarado(producto.etiqueta, ["COLOR"]) ?? "Sin color declarado";
  if (dimension === "caracteristica") return valorDeclarado(producto.etiqueta, ["CARACTER[IÍ]STICA", "DISE[ÑN]O", "TIPO"]) ?? "Sin característica declarada";
  return valorDeclarado(producto.etiqueta, ["LICENCIA"]) ?? "Sin licencia declarada";
}

function AgenteProducto({
  iniciales, nombre, senal, color, suave, clase, activo, onClick,
}: { iniciales: string; nombre: string; senal: string; color: string; suave: string; clase: string; activo: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`absolute z-20 grid w-28 justify-items-center gap-1 text-center transition duration-300 hover:scale-105 focus:outline-none ${clase} ${activo ? "scale-110" : ""}`}>
    <span className="grid h-14 w-14 place-items-center rounded-full border-4 text-sm font-black shadow-[0_10px_22px_rgba(42,55,94,.18)]" style={{ borderColor: `${color}33`, background: suave, color }}>{iniciales}</span>
    <span className="text-[10px] font-extrabold leading-tight" style={{ color }}>{nombre}</span>
    <span className="text-[10px] font-bold leading-tight" style={{ color }}>{senal}</span>
  </button>;
}

export default function PaginaCategoriasProducto() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const [dimension, setDimension] = useState<Dimension>("familia");
  const [agenteActivo, setAgenteActivo] = useState<AgenteId | null>(null);
  const productos = useMemo(() => acumuladosComposicionPorProducto(dataset), [dataset]);
  const dimensionActiva = DIMENSIONES.find((item) => item.id === dimension) ?? DIMENSIONES[0];
  const total = productos.reduce((suma, producto) => suma + producto.valor, 0);
  const categorias = useMemo(() => {
    const mapa = new Map<string, { nombre: string; valor: number; unidades: number; productos: number; pedidos: number }>();
    for (const producto of productos) {
      const nombre = categoriaDe(producto, dimension);
      const actual = mapa.get(nombre) ?? { nombre, valor: 0, unidades: 0, productos: 0, pedidos: 0 };
      actual.valor += producto.valor;
      actual.unidades += producto.unidades;
      actual.productos += 1;
      actual.pedidos += producto.pedidos;
      mapa.set(nombre, actual);
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre));
  }, [productos, dimension]);
  const principal = categorias[0];
  const sinDeclarar = categorias.find((categoria) => categoria.nombre.startsWith("Sin "));
  const cobertura = total > 0 ? ((total - (sinDeclarar?.valor ?? 0)) / total) * 100 : 0;
  const productosTop = productos.slice(0, 5);
  const enfocado = agenteActivo !== null;
  const claseModulo = (id: AgenteId) => `product-module relative rounded-[28px] border border-white/90 bg-white/85 p-5 shadow-[0_14px_34px_rgba(44,63,108,.10)] transition duration-300 ${enfocado && agenteActivo !== id ? "blur-[3px] opacity-30" : ""} ${agenteActivo === id ? "z-10 ring-2 ring-[#6d7ee0]/60 shadow-[0_18px_42px_rgba(70,88,161,.2)]" : ""}`;

  if (cargando) return <SkeletonPagina />;

  return <div className="space-y-6">
    <Encabezado titulo="Categorías de producto" secciones={SECCIONES} dataset={dataset} modulo="ventas" />

    <section id="sec-mix-producto" className="scroll-mt-24 rounded-[34px] border border-white/90 bg-[linear-gradient(135deg,#eff5ff_0%,#e4edfb_100%)] p-5 shadow-[0_20px_50px_rgba(44,63,108,.12)] md:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-black uppercase tracking-[.15em] text-[#6d7ee0]">Acumulado histórico</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-[#1d2638]">Mix por categoría de producto</h2><p className="mt-1 max-w-2xl text-sm text-[#707991]">Modelo, color, característica, licencia y universo comercial. La dimensión se toma del texto declarado de cada producto y mantiene visibles los vacíos.</p></div>
        <div className="rounded-full bg-white/80 px-4 py-2 text-right shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7e879a]">Composición histórica</p><p className="text-lg font-black tabular-nums text-[#202a3b]">{fmt(total)}</p><p className="text-[10px] font-semibold text-[#6f7990]">corte {fechaCorte}</p></div>
      </div>

      <div className="relative min-h-[780px] overflow-hidden rounded-[30px] bg-[#eaf1fc] p-5 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-[.13em]" style={{ color: dimensionActiva.color }}>Dimensión activa</p><p className="text-sm font-black text-[#29334a]">{dimensionActiva.nombre}</p></div><select aria-label="Elegir dimensión de producto" value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)} className="rounded-xl border border-[#dce3f0] bg-white px-3 py-2 text-xs font-bold text-[#536078] outline-none focus:border-[#596bd0]">{DIMENSIONES.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className={claseModulo("mix")}>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Mapa de categorías</p><h3 className="mt-1 text-lg font-black text-[#253047]">Dónde se concentra el mix</h3>
            <div className="mt-5 space-y-3">{categorias.slice(0, 5).map((categoria) => <div key={categoria.nombre}><div className="mb-1 flex justify-between gap-3 text-[11px] font-bold text-[#536078]"><span className="truncate">{categoria.nombre}</span><span>{total > 0 ? ((categoria.valor / total) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-3 overflow-hidden rounded-full bg-[#e5eaf4]"><div className="h-full rounded-full" style={{ width: `${total > 0 ? (categoria.valor / total) * 100 : 0}%`, background: dimensionActiva.color }} /></div></div>)}</div>
            {agenteActivo === "mix" && <p className="mt-4 text-[11px] font-bold" style={{ color: dimensionActiva.color }}>{principal ? `${principal.nombre} representa ${((principal.valor / total) * 100).toFixed(1)}% del mix leído.` : "No hay líneas de producto para agrupar."}</p>}
          </article>

          <article className={claseModulo("concentracion")}>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Productos que mueven el mix</p><h3 className="mt-1 text-lg font-black text-[#253047]">Top productos</h3>
            <div className="mt-4 space-y-2">{productosTop.map((producto) => <div key={producto.id} className="rounded-2xl bg-[#f6f8fc] px-3 py-2.5"><div className="flex justify-between gap-3"><p className="truncate text-[10px] font-extrabold text-[#37435b]">{producto.sku} · {producto.etiqueta}</p><p className="shrink-0 text-[10px] font-black text-[#536078]">{total > 0 ? ((producto.valor / total) * 100).toFixed(1) : "0.0"}%</p></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e3e8f1]"><div className="h-full rounded-full bg-[#596bd0]" style={{ width: `${total > 0 ? (producto.valor / total) * 100 : 0}%` }} /></div></div>)}</div>
            {agenteActivo === "concentracion" && <p className="mt-3 text-[11px] font-bold text-[#596bd0]">Este ranking se calcula con líneas a precio de lista; no se etiqueta como venta neta ni margen porque el descuento no viene en la línea.</p>}
          </article>

          <article className={claseModulo("atributo")}>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Anatomía de producto</p><h3 className="mt-1 text-lg font-black text-[#253047]">Qué atributo estás leyendo</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{DIMENSIONES.map((item) => <button key={item.id} type="button" onClick={() => setDimension(item.id)} className={`rounded-2xl border p-3 text-left transition hover:scale-[1.02] ${dimension === item.id ? "ring-2" : ""}`} style={{ borderColor: `${item.color}33`, background: item.suave, boxShadow: dimension === item.id ? `0 0 0 2px ${item.color}66` : undefined }}><p className="text-[10px] font-black uppercase tracking-[.12em]" style={{ color: item.color }}>{item.nombre}</p><p className="mt-1 text-[10px] leading-snug text-[#66738a]">{item.ayuda}</p></button>)}</div>
            {agenteActivo === "atributo" && <p className="mt-3 text-[11px] font-bold text-[#2f9d78]">Cambiar la dimensión no cambia la venta ni el producto: sólo cambia la forma de agrupar el mismo mix.</p>}
          </article>

          <article className={claseModulo("vacio")}>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Cobertura del atributo</p><h3 className="mt-1 text-lg font-black text-[#253047]">Lo que todavía no se puede afirmar</h3>
            <div className="mt-6 flex items-end justify-between gap-4"><p className="text-5xl font-black tracking-[-.06em] text-[#253047]">{cobertura.toFixed(1)}%</p><p className="pb-1 text-right text-[11px] font-bold text-[#72809a]">{sinDeclarar?.productos.toLocaleString("es-GT") ?? 0} productos sin atributo<br />{fmt(sinDeclarar?.valor ?? 0)} sin clasificar</p></div><div className="mt-4 h-4 overflow-hidden rounded-full bg-[#e6eaf3]"><div className="h-full rounded-full bg-[#2f9d78] transition-all duration-500" style={{ width: `${cobertura}%` }} /></div><p className="mt-4 text-[11px] leading-relaxed text-[#6e7990]">Cuando el producto no declara {dimensionActiva.nombre.toLowerCase()}, queda en “sin declarar”. La página no interpreta palabras parecidas como si fueran una categoría oficial.</p>
            {agenteActivo === "vacio" && <p className="mt-3 text-[11px] font-bold text-[#c84e56]">La cobertura debe llegar desde el catálogo o el modelo de producto antes de usar este desglose para decidir compras o campañas.</p>}
          </article>
        </div>

        <AgenteProducto iniciales="MX" nombre="Mezcla de producto" senal={principal ? `${principal.nombre} lidera` : "sin líneas"} color={dimensionActiva.color} suave={dimensionActiva.suave} activo={agenteActivo === "mix"} onClick={() => setAgenteActivo(agenteActivo === "mix" ? null : "mix")} clase="left-[6%] top-[41%]" />
        <AgenteProducto iniciales="TP" nombre="Top producto" senal={`${productos.length} referencias`} color="#596bd0" suave="#edf0ff" activo={agenteActivo === "concentracion"} onClick={() => setAgenteActivo(agenteActivo === "concentracion" ? null : "concentracion")} clase="right-[6%] top-[41%]" />
        <AgenteProducto iniciales="AT" nombre="Atributo activo" senal={dimensionActiva.nombre} color="#2f9d78" suave="#e8f8f1" activo={agenteActivo === "atributo"} onClick={() => setAgenteActivo(agenteActivo === "atributo" ? null : "atributo")} clase="bottom-[4%] left-[22%]" />
        <AgenteProducto iniciales="VD" nombre="Vacío declarado" senal={`${cobertura.toFixed(1)}% cubierto`} color="#c84e56" suave="#ffedef" activo={agenteActivo === "vacio"} onClick={() => setAgenteActivo(agenteActivo === "vacio" ? null : "vacio")} clase="bottom-[4%] right-[22%]" />
      </div>
    </section>

    <section id="sec-ranking-producto" className="scroll-mt-24 rounded-[34px] border border-white/90 bg-[linear-gradient(135deg,#f1f5ff_0%,#e8effb_100%)] p-5 shadow-[0_16px_38px_rgba(44,63,108,.10)] md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#596bd0]">Ruta de trabajo</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-[#253047]">Módulos guiados por agentes</h2><p className="mt-1 text-sm text-[#6b7690]">No hay un modo de agentes separado: cada agente se ocupa de una decisión dentro del recorrido de producto.</p></div><span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-black text-[#657291]">01 → 04</span></div>
      <div className="space-y-4">
        <ModuloGuiado orden="01" agente="Atributo activo" iniciales="AT" senal={dimensionActiva.nombre} color="#2f9d78" suave="#e8f8f1" activo={agenteActivo === "atributo"} atenuado={Boolean(agenteActivo && agenteActivo !== "atributo")} onActivar={() => setAgenteActivo(agenteActivo === "atributo" ? null : "atributo")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{DIMENSIONES.map((item) => <button key={item.id} type="button" onClick={() => setDimension(item.id)} className="rounded-2xl border p-3 text-left transition hover:scale-[1.02]" style={{ borderColor: `${item.color}33`, background: item.suave, boxShadow: dimension === item.id ? `0 0 0 2px ${item.color}66` : undefined }}><p className="text-[10px] font-black uppercase tracking-[.1em]" style={{ color: item.color }}>{item.nombre}</p><p className="mt-1 text-[10px] leading-snug text-[#68758d]">{item.ayuda}</p></button>)}</div>
        </ModuloGuiado>
        <ModuloGuiado orden="02" agente="Mezcla de producto" iniciales="MX" senal={principal ? `${principal.nombre} lidera el mix` : "sin líneas disponibles"} color={dimensionActiva.color} suave={dimensionActiva.suave} activo={agenteActivo === "mix"} atenuado={Boolean(agenteActivo && agenteActivo !== "mix")} onActivar={() => setAgenteActivo(agenteActivo === "mix" ? null : "mix")}>
          <div className="grid gap-3 md:grid-cols-2">{categorias.slice(0, 6).map((categoria) => <div key={categoria.nombre} className="rounded-2xl bg-[#f7f9fd] p-3"><div className="flex justify-between gap-3 text-[11px] font-black text-[#536078]"><span className="truncate">{categoria.nombre}</span><span>{total > 0 ? ((categoria.valor / total) * 100).toFixed(1) : "0.0"}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e4e9f2]"><div className="h-full rounded-full" style={{ width: `${total > 0 ? (categoria.valor / total) * 100 : 0}%`, background: dimensionActiva.color }} /></div><p className="mt-2 text-[10px] font-semibold text-[#718099]">{categoria.productos} productos · {categoria.unidades.toLocaleString("es-GT")} unidades</p></div>)}</div>
        </ModuloGuiado>
        <ModuloGuiado orden="03" agente="Top producto" iniciales="TP" senal={`${productos.length} referencias leídas`} color="#596bd0" suave="#edf0ff" activo={agenteActivo === "concentracion"} atenuado={Boolean(agenteActivo && agenteActivo !== "concentracion")} onActivar={() => setAgenteActivo(agenteActivo === "concentracion" ? null : "concentracion")}>
          <div className="space-y-2">{productosTop.map((producto) => <div key={producto.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-2xl bg-[#f6f8fc] px-3 py-2.5"><div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-[#37435b]">{producto.sku} · {producto.etiqueta}</p><p className="text-[10px] font-semibold text-[#718099]">{producto.unidades.toLocaleString("es-GT")} unidades · {producto.pedidos} pedidos</p></div><p className="self-center text-[11px] font-black text-[#596bd0]">{total > 0 ? ((producto.valor / total) * 100).toFixed(1) : "0.0"}%</p></div>)}</div>
        </ModuloGuiado>
        <ModuloGuiado orden="04" agente="Vacío declarado" iniciales="VD" senal={`${cobertura.toFixed(1)}% cubierto`} color="#c84e56" suave="#ffedef" activo={agenteActivo === "vacio"} atenuado={Boolean(agenteActivo && agenteActivo !== "vacio")} onActivar={() => setAgenteActivo(agenteActivo === "vacio" ? null : "vacio")}>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]"><div><p className="text-xl font-black text-[#263149]">{cobertura.toFixed(1)}% con {dimensionActiva.nombre.toLowerCase()} declarado</p><div className="mt-3 h-4 overflow-hidden rounded-full bg-[#e2e8f2]"><div className="h-full rounded-full bg-[#c84e56]" style={{ width: `${cobertura}%` }} /></div></div><p className="text-right text-[11px] font-bold text-[#69758c]">{sinDeclarar?.productos.toLocaleString("es-GT") ?? 0} productos sin atributo<br />{fmt(sinDeclarar?.valor ?? 0)} sin clasificar</p></div>
        </ModuloGuiado>
      </div>
    </section>

    <section id="sec-regla-producto" className="scroll-mt-24 rounded-[28px] border border-[#dfe6f4] bg-[#f6f8fc] p-5 text-[11px] leading-relaxed text-[#5e6b83]"><p className="font-black uppercase tracking-[.14em] text-[#657291]">Regla de procedencia</p><p className="mt-2">Este tablero lee cada línea como cantidad × precio unitario de lista, porque el export actual no preserva descuento por línea. Es una lectura de composición de producto: no equivale a venta neta cerrada ni a margen. Modelo, color, característica y licencia se reconocen sólo cuando están declarados en el nombre del producto; los vacíos se muestran como vacíos.</p></section>
  </div>;
}
