"use client";

import { useMemo, useState } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelReporteAgentes } from "@/components/commercial/PanelReporteAgentes";
import type { AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import type { TonoMascota } from "@/components/commercial/MascotaB18";
import { detalleVenta, leerVentasReales } from "@/lib/lecturas-ventas-reales";
import { useApp } from "@/lib/store";

type AgenteDetalle = "pedido" | "lineas" | "composicion" | "historial";

export default function PaginaDetalleVentas() {
  const { dataset, cargando, fmt } = useApp();
  const lectura = useMemo(() => leerVentasReales(dataset), [dataset]);
  const [idVenta, setIdVenta] = useState<string | undefined>();
  const [activo, setActivo] = useState<AgenteDetalle>("pedido");
  const [tono, setTono] = useState<TonoMascota>("analisis");
  if (cargando) return <SkeletonPagina />;
  const detalle = detalleVenta(dataset, idVenta);
  if (!detalle) return <div className="p-8 text-sm text-[#667793]">No hay pedidos confirmados disponibles.</div>;
  const agentes: AgenteLateral<AgenteDetalle>[] = [
    { id: "pedido", iniciales: "PE", nombre: "Pedido", senal: detalle.venta.fecha_venta, pregunta: "¿Cuál es el total confirmado del pedido?", kpiPct: 100, kpiEtiqueta: "confirmado", kpiVisual: "barras", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "lineas", iniciales: "PR", nombre: "Productos", senal: `${detalle.lineas.length} líneas`, pregunta: "¿Qué SKU componen este pedido?", kpiPct: detalle.lineas.length ? 100 : 0, kpiEtiqueta: "líneas", kpiVisual: "pareto", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "composicion", iniciales: "CO", nombre: "Composición", senal: fmt(detalle.composicion), pregunta: "¿Qué valor muestran las líneas a precio de lista?", kpiPct: 100, kpiEtiqueta: "lectura", kpiVisual: "dona", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "historial", iniciales: "HI", nombre: "Historial", senal: detalle.cliente, pregunta: "¿Qué contexto comercial tiene el cliente?", kpiPct: Math.min(100, lectura.clientes.find((cliente) => cliente.id === detalle.venta.id_cliente)?.pedidos ?? 0), kpiEtiqueta: "pedidos", kpiVisual: "barras", color: "#4b80ee", suave: "#eaf1ff" },
  ];
  const centro = activo === "pedido" ? <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Pedido confirmado Odoo</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{detalle.cliente}</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">Pedido {detalle.venta.id_venta} del {detalle.venta.fecha_venta}. Su total confirmado se conserva separado de la composición de sus líneas.</p><div className="mt-7 rounded-2xl bg-[#f5f8ff] p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7d91b8]">Total confirmado Odoo</p><b className="mt-2 block text-2xl text-[#243553]">{fmt(detalle.venta.total_referencia?.valorParaMostrar() ?? 0)}</b></div></> : activo === "lineas" ? <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Productos del pedido</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{detalle.lineas.length} líneas disponibles.</h3><div className="mt-6 space-y-2">{detalle.lineas.slice(0, 8).map((item) => <div key={item.linea.id_linea} className="flex justify-between gap-4 rounded-xl bg-[#f5f8ff] px-4 py-3 text-[10px] font-bold text-[#536783]"><span className="truncate">{item.producto.sku} · {item.producto.nombre_producto}</span><span className="shrink-0">{item.linea.cantidad} u.</span></div>)}</div></> : activeDetail(activo, detalle, fmt, lectura);
  return <div className="space-y-3"><header className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-start gap-4 pt-3"><span /><h1 className="whitespace-nowrap text-center text-[clamp(1.75rem,3.35vw,3.15rem)] font-black leading-none tracking-[-.065em] text-[#111827]">Detalle <span className="bg-[linear-gradient(90deg,#467deb,#8cc8ff)] bg-clip-text text-transparent">de venta</span></h1><div className="justify-self-end"><BarraUsuario dataset={dataset} modulo="ventas" /></div></header><div className="mx-auto max-w-5xl"><label className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-[#8191ad]">Pedido confirmado</label><select value={detalle.venta.id_venta} onChange={(event) => setIdVenta(event.target.value)} className="w-full max-w-md rounded-xl border border-[#e5edf9] bg-white px-3 py-2 text-sm font-bold text-[#395173] shadow-sm">{lectura.ventas.slice(-60).reverse().map((venta) => <option key={venta.id_venta} value={venta.id_venta}>{venta.id_venta} · {venta.fecha_venta}</option>)}</select></div><PanelReporteAgentes agentes={agentes} activo={activo} tono={tono} onSeleccionar={setActivo} onTonoCambiar={setTono} titulo="Drill-down de venta" corte={detalle.venta.fecha_venta}>{centro}</PanelReporteAgentes></div>;
}

function activeDetail(activo: Exclude<AgenteDetalle, "pedido" | "lineas">, detalle: NonNullable<ReturnType<typeof detalleVenta>>, fmt: (valor: number) => string, lectura: ReturnType<typeof leerVentasReales>) {
  if (activo === "composicion") return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Composición de líneas</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{fmt(detalle.composicion)} a precio de lista.</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">Esta suma clasifica los SKU del pedido. No se presenta como el total neto del pedido porque las líneas disponibles no contienen el detalle de descuento e impuesto.</p></>;
  const cliente = lectura.clientes.find((fila) => fila.id === detalle.venta.id_cliente);
  return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Historial del cliente</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{cliente?.etiqueta ?? detalle.cliente}</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">La cuenta acumula {cliente ? fmt(cliente.valor) : "sin dato"} en {cliente?.pedidos ?? 0} pedidos confirmados. Este contexto sirve para preparar la conversación comercial, no para crear automáticamente un pedido.</p></>;
}
