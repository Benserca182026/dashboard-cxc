"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CAPA_COMPOSICION, CAPA_VENTA, MONEDA_CLIENTES } from "@/lib/contrato-clientes-b18";
import { perfilClienteVentas } from "@/lib/lecturas-ventas-reales";
import type { Dataset } from "@/lib/types";
import est from "./FichaClienteVentas.module.css";

/**
 * FICHA INDIVIDUAL DE CLIENTE — para preparar un pedido.
 *
 * B18 contesta "cómo está la base". Esta ficha contesta la otra pregunta
 * del negocio: "qué hago con ESTE cliente cuando lo tengo al teléfono".
 * Se abre con un clic desde cualquier listado; nunca al pasar el mouse.
 *
 * No calcula nada nuevo: reutiliza `perfilClienteVentas`, la misma lectura
 * que ya existía en el proyecto. Lo único que deriva acá son la recencia y
 * la frecuencia, que salen de las fechas del propio perfil.
 *
 * ── LAS DOS CAPAS, SEPARADAS Y ROTULADAS ────────────────────────────────
 * El historial y el ticket son VENTA CONFIRMADA (`total_odoo_referencia`,
 * IVA 12% incluido). Los productos son COMPOSICIÓN DE LÍNEAS
 * (cantidad × precio de lista): sirven para saber QUÉ compra, y no suman
 * la venta. Los dos números no cuadran entre sí y no deben compararse.
 *
 * ── CARTERA ─────────────────────────────────────────────────────────────
 * Esta ficha NO calcula saldo. Cuenta los documentos de cartera abiertos
 * del cliente en el snapshot y, si hay, enlaza a Aging. El importe se lee
 * allá, con su propia fuente y su propio corte.
 */

const dias = (desde: string | null, hasta: string) =>
  desde ? Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) : null;

export function FichaClienteVentas({
  dataset,
  clienteId,
  corte,
  onCerrar,
  fmt,
}: {
  dataset: Dataset;
  clienteId: string;
  corte: string;
  onCerrar: () => void;
  fmt: (valor: number) => string;
}) {
  useEffect(() => {
    const alSalir = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alSalir);
    return () => window.removeEventListener("keydown", alSalir);
  }, [onCerrar]);

  const perfil = perfilClienteVentas(dataset, clienteId);
  if (!perfil) return null;

  const recencia = dias(perfil.ultima, corte);
  const anos = perfil.primera && perfil.ultima
    ? Math.max(1, (Date.parse(`${perfil.ultima}T00:00:00Z`) - Date.parse(`${perfil.primera}T00:00:00Z`)) / 86400000 / 365)
    : null;
  const porAno = anos ? perfil.pedidos / anos : null;

  // Cartera: sólo presencia, nunca importe. Ver cabecera.
  const abiertas = (dataset.facturas ?? []).filter(
    (f) => f.id_cliente === clienteId && f.estado_factura !== "pagada" && f.estado_factura !== "anulada",
  ).length;

  const composicion = perfil.productos.reduce((s, p) => s + p.valor, 0);

  return <div className={est.velo} onClick={onCerrar} role="presentation">
    <section
      className={est.ficha}
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha comercial de ${perfil.etiqueta}`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className={est.cabecera}>
        <div>
          <p>Ficha comercial · para toma de pedido</p>
          <h2>{perfil.etiqueta}</h2>
        </div>
        <button type="button" className={est.cerrar} onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>

      <p className={est.capa}>{CAPA_VENTA} · {MONEDA_CLIENTES}</p>

      <div className={est.metricas}>
        <div><b>{fmt(perfil.valor)}</b><span>venta histórica confirmada</span></div>
        <div><b>{perfil.pedidos.toLocaleString("es-GT")}</b><span>pedidos confirmados</span></div>
        <div><b>{fmt(perfil.ticket)}</b><span>ticket promedio del cliente</span></div>
        <div>
          <b>{recencia === null ? "sin compra" : `${recencia.toLocaleString("es-GT")} d`}</b>
          <span>desde la última compra, al corte</span>
        </div>
        <div>
          <b>{porAno === null ? "—" : porAno.toFixed(1)}</b>
          <span>pedidos por año entre su primera y su última compra</span>
        </div>
        <div><b>{perfil.primera ?? "—"}</b><span>primera compra registrada · no es el alta del cliente</span></div>
      </div>

      <h3 className={est.titulo}>Historial de venta</h3>
      <p className={est.bajada}>Pedidos confirmados, del más reciente al más antiguo. Se listan los últimos 12.</p>
      <div className={est.historial}>
        {perfil.ventas.slice(0, 12).map((venta) => <div key={venta.id_venta}>
          <span>{venta.fecha_venta.slice(0, 10)}</span>
          <i>{venta.id_venta}</i>
          <b>{fmt(venta.total_referencia?.valorParaMostrar() ?? 0)}</b>
        </div>)}
      </div>
      {perfil.ventas.length > 12
        ? <p className={est.truncado}>Se muestran 12 de {perfil.ventas.length.toLocaleString("es-GT")} pedidos.</p>
        : null}

      <h3 className={est.titulo}>Qué compra</h3>
      <p className={est.aviso}>{CAPA_COMPOSICION}. Cantidad × precio de lista: sirve para preparar el pedido, no para sumar facturación. No cuadra con la venta confirmada de arriba y no debe compararse con ella.</p>
      <div className={est.productos}>
        {perfil.productos.length === 0
          ? <p className={est.vacio}>Este cliente no tiene líneas de producto en el snapshot.</p>
          : perfil.productos.map((p) => <div key={p.etiqueta}>
              <span>{p.etiqueta}</span>
              <i>{p.unidades.toLocaleString("es-GT")} u.</i>
              <b>{fmt(p.valor)}</b>
              <u style={{ width: `${composicion ? (p.valor / composicion) * 100 : 0}%` }} aria-hidden="true" />
            </div>)}
      </div>

      <h3 className={est.titulo}>Cartera</h3>
      {abiertas > 0
        ? <div className={est.cartera}>
            <p><b>{abiertas.toLocaleString("es-GT")}</b> {abiertas === 1 ? "documento de cartera abierto" : "documentos de cartera abiertos"} en el snapshot.</p>
            <p className={est.carteraNota}>Esta ficha no calcula saldo. El importe, su antigüedad y su tramo se leen en Aging, con su propia fuente y su propio corte.</p>
            <Link href="/aging" className={est.carteraEnlace}>Abrir Cuentas por cobrar · Aging <span aria-hidden="true">→</span></Link>
          </div>
        : <p className={est.vacio}>Sin documentos de cartera abiertos para este cliente en el snapshot.</p>}

      <dl className={est.procedencia}>
        <div><dt>Fuente</dt><dd>snapshot Supabase · ventas + venta_lineas + productos</dd></div>
        <div><dt>Corte</dt><dd>{corte}</dd></div>
        <div><dt>Moneda</dt><dd>{MONEDA_CLIENTES}</dd></div>
        <div><dt>Límite</dt><dd>La identidad del cliente se deriva del nombre: variantes del mismo negocio cuentan como clientes distintos. No hay vendedor asignado, canal, segmento ni fecha de alta real.</dd></div>
      </dl>
    </section>
  </div>;
}
