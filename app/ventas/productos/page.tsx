"use client";

import { useEffect, useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MapaB18Producto } from "@/components/commercial/MapaB18Producto";
import { construirLecturasProductoVentas } from "@/lib/agentes-producto-ventas";
import { useApp } from "@/lib/store";

/**
 * Piloto B18 local: reutiliza únicamente la lectura de clasificación ya
 * disponible en esta ruta. No añade nuevas consultas, PII ni publicación.
 */
export default function PaginaCategoriasProducto() {
  const { cargando, dataset } = useApp();
  useEffect(() => {
    document.body.classList.add("producto-lienzo-blanco");
    return () => document.body.classList.remove("producto-lienzo-blanco");
  }, []);

  const lecturas = useMemo(() => construirLecturasProductoVentas(dataset), [dataset]);
  const corte = useMemo(() => {
    const ultima = (dataset.ventas ?? []).filter((venta) => venta.estado_odoo === "sale").map((venta) => venta.fecha_venta.slice(0, 10)).sort().at(-1);
    return ultima ?? "Sin ventas confirmadas";
  }, [dataset.ventas]);

  if (cargando) return <SkeletonPagina />;

  return <main className="b18-prototype-page">
    <header className="b18-prototype-title"><div><p>Ventas · Portafolio</p><h1>Clasificación <span>comercial de productos</span></h1></div><BarraUsuario dataset={dataset} modulo="ventas" /></header>
    <MapaB18Producto lecturas={lecturas} corte={corte} fuente="ventas + venta_lineas + productos" moneda="No agregable — segmentar por moneda" />
  </main>;
}
