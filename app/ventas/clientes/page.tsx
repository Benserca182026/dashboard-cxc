"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelReporteAgentes } from "@/components/commercial/PanelReporteAgentes";
import type { AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import type { TonoMascota } from "@/components/commercial/MascotaB18";
import { leerVentasReales, perfilClienteVentas } from "@/lib/lecturas-ventas-reales";
import { useApp } from "@/lib/store";

type AgenteCliente = "valor" | "recurrencia" | "ticket" | "mix";

export default function PaginaClientesVentas() {
  const { dataset, cargando, fmt } = useApp();
  const lectura = useMemo(() => leerVentasReales(dataset), [dataset]);
  const [clienteId, setClienteId] = useState<string | undefined>();
  const [activo, setActivo] = useState<AgenteCliente>("valor");
  const [tono, setTono] = useState<TonoMascota>("analisis");
  if (cargando) return <SkeletonPagina />;
  const perfil = perfilClienteVentas(dataset, clienteId ?? lectura.clientes[0]?.id);
  if (!perfil) return <div className="p-8 text-sm text-[#667793]">No hay pedidos confirmados para construir una ficha comercial.</div>;
  const participacion = lectura.total ? (perfil.valor / lectura.total) * 100 : 0;
  const productoPrincipal = perfil.productos[0];
  const composicionCliente = perfil.productos.reduce((suma, producto) => suma + producto.valor, 0);
  const mixPct = productoPrincipal && composicionCliente ? (productoPrincipal.valor / composicionCliente) * 100 : 0;
  const agentes: AgenteLateral<AgenteCliente>[] = [
    { id: "valor", iniciales: "VA", nombre: "Valor", senal: `${fmt(perfil.valor)} acumulado`, pregunta: "¿Qué peso comercial tiene esta cuenta?", kpiPct: participacion, kpiEtiqueta: "participación", kpiVisual: "pareto", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "recurrencia", iniciales: "RE", nombre: "Recurrencia", senal: `${perfil.pedidos} pedidos`, pregunta: "¿Con qué frecuencia vuelve a comprar?", kpiPct: Math.min(100, perfil.pedidos / Math.max(1, lectura.clientes[0]?.pedidos ?? 1) * 100), kpiEtiqueta: "vs. máximo", kpiVisual: "barras", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "ticket", iniciales: "TI", nombre: "Ticket", senal: `${fmt(perfil.ticket)} por pedido`, pregunta: "¿Cuál es el valor típico de su pedido?", kpiPct: Math.min(100, perfil.ticket / Math.max(1, lectura.clientes[0]?.ticket ?? 1) * 100), kpiEtiqueta: "vs. mayor ticket", kpiVisual: "barras", color: "#4b80ee", suave: "#eaf1ff" },
    { id: "mix", iniciales: "MI", nombre: "Mix", senal: productoPrincipal?.etiqueta ?? "Sin líneas", pregunta: "¿Qué SKU guían la propuesta comercial?", kpiPct: mixPct, kpiEtiqueta: "producto líder", kpiVisual: "dona", color: "#4b80ee", suave: "#eaf1ff" },
  ];
  const nombreTono = tono === "riesgo" ? "Riesgo comercial" : tono === "atencion" ? "Atención comercial" : tono === "oportunidad" ? "Oportunidad comercial" : "Análisis comercial";
  const centro = activo === "valor" ? <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">{nombreTono} · Ficha de cliente</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{perfil.etiqueta}</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">Esta cuenta suma {fmt(perfil.valor)} en {perfil.pedidos} pedidos confirmados y representa {participacion.toFixed(2)}% de la venta disponible.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#f5f8ff] p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7d91b8]">Primera compra</p><b className="mt-2 block text-base text-[#2c3e5d]">{perfil.primera}</b></div><div className="rounded-2xl bg-[#f5f8ff] p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7d91b8]">Última compra</p><b className="mt-2 block text-base text-[#2c3e5d]">{perfil.ultima}</b></div></div></> : activeContent(activo, perfil, fmt, productoPrincipal, mixPct);
  return <div className="space-y-3"><header className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-start gap-4 pt-3"><span /><h1 className="whitespace-nowrap text-center text-[clamp(1.75rem,3.35vw,3.15rem)] font-black leading-none tracking-[-.065em] text-[#111827]">Ficha <span className="bg-[linear-gradient(90deg,#467deb,#8cc8ff)] bg-clip-text text-transparent">comercial de cliente</span></h1><div className="justify-self-end"><BarraUsuario dataset={dataset} modulo="ventas" /></div></header><div className="mx-auto max-w-5xl"><label className="mb-2 block text-[9px] font-black uppercase tracking-[.14em] text-[#8191ad]">Cliente en foco</label><select value={perfil.id} onChange={(event) => setClienteId(event.target.value)} className="w-full max-w-md rounded-xl border border-[#e5edf9] bg-white px-3 py-2 text-sm font-bold text-[#395173] shadow-sm">{lectura.clientes.slice(0, 40).map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.etiqueta}</option>)}</select></div><PanelReporteAgentes agentes={agentes} activo={activo} tono={tono} onSeleccionar={setActivo} onTonoCambiar={setTono} titulo="Ficha de toma de pedido" corte={perfil.ultima ?? "sin compra"}>{centro}</PanelReporteAgentes></div>;
}

function activeContent(activo: Exclude<AgenteCliente, "valor">, perfil: NonNullable<ReturnType<typeof perfilClienteVentas>>, fmt: (valor: number) => string, productoPrincipal: { etiqueta: string; valor: number; unidades: number } | undefined, mixPct: number) {
  if (activo === "recurrencia") return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Recurrencia</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{perfil.pedidos} pedidos confirmados.</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">La frecuencia se observa desde la primera hasta la última compra disponible. Sirve para preparar seguimiento comercial, no para prometer una recompra futura.</p><div className="mt-6 space-y-2">{perfil.ventas.slice(0, 6).map((venta) => <div key={venta.id_venta} className="flex justify-between rounded-xl bg-[#f5f8ff] px-4 py-3 text-[11px] font-bold text-[#536783]"><span>{venta.fecha_venta}</span><span>{fmt(venta.total_referencia?.valorParaMostrar() ?? 0)}</span></div>)}</div></>;
  if (activo === "ticket") return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Ticket</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">Ticket promedio: {fmt(perfil.ticket)}.</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">Se calcula con el total confirmado por Odoo dividido entre pedidos de este cliente. No se mezcla con precios de lista de líneas.</p><Link href="/ventas/detalle" className="mt-6 inline-flex rounded-full bg-[#eaf1ff] px-4 py-2 text-[10px] font-black text-[#4176df]">Abrir detalle de pedidos →</Link></>;
  return <><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7197ec]">Mix de compra</p><h3 className="mt-2 text-2xl font-black tracking-[-.055em] text-[#14203a]">{productoPrincipal?.etiqueta ?? "Sin producto identificado"}</h3><p className="mt-3 text-sm leading-relaxed text-[#667793]">El producto líder representa {mixPct.toFixed(2)}% de la composición de líneas de este cliente. La propuesta de pedido puede partir de su historial, pero requiere confirmación humana.</p><div className="mt-6 space-y-2">{perfil.productos.map((producto) => <div key={producto.etiqueta} className="flex justify-between gap-4 rounded-xl bg-[#f5f8ff] px-4 py-3 text-[10px] font-bold text-[#536783]"><span className="truncate">{producto.etiqueta}</span><span className="shrink-0">{fmt(producto.valor)}</span></div>)}</div></>;
}
