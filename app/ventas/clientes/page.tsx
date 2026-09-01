"use client";

import { useEffect, useMemo, useState } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { FichaClienteVentas } from "@/components/commercial/FichaClienteVentas";
import { MapaB18Clientes } from "@/components/commercial/MapaB18Clientes";
import { construirMapaClientesB18 } from "@/lib/agentes-clientes-b18";
import { useApp } from "@/lib/store";

/**
 * Clientes con la misma estructura B18 que la clasificación de productos:
 * cuatro agentes alrededor de un reporte visual, y B18 como dashboard
 * integral de la página — no como un quinto indicador.
 *
 * ── QUÉ CAMBIÓ EN ESTA RUTA ─────────────────────────────────────────────
 * Antes vivía acá una ficha de UN cliente, elegido en un desplegable. La
 * pregunta que contesta esta pantalla es otra: cómo está la base completa.
 * La ficha individual sigue existiendo como capacidad de la lectura
 * (`perfilClienteVentas`), pero no como esta página.
 *
 * ── LAS CAPAS NO SE SUMAN ───────────────────────────────────────────────
 * Venta confirmada (`total_odoo_referencia`, IVA 12% incluido) es la única
 * que es facturación. La composición de líneas dice QUÉ compra el cliente y
 * no es dinero facturado. Y la cartera es saldo, no venta: hoy ni siquiera
 * se calcula acá — `saldos_odoo` no forma parte del dataset comercial de
 * Clientes, así que la sección lo declara y enlaza a /aging en vez de
 * estimarlo. Un número inventado es indistinguible de uno medido.
 *
 * Nada está escrito a mano. Series, tramos, concentración y cobertura salen
 * de `construirMapaClientesB18`, que lee los pedidos en estado "sale" y
 * deriva el corte de la última venta confirmada.
 */
export default function PaginaClientesVentas() {
  const { cargando, dataset, fmt } = useApp();
  useEffect(() => {
    document.body.classList.add("b18-lienzo-blanco");
    return () => document.body.classList.remove("b18-lienzo-blanco");
  }, []);

  const mapa = useMemo(() => construirMapaClientesB18(dataset), [dataset]);
  // La ficha individual la arma la PÁGINA, no el mapa: el componente sólo
  // avisa qué cliente se eligió y acá se lee el dataset con la lectura que
  // ya existía. Así B18 sigue sin calcular nada.
  const [ficha, setFicha] = useState<string | null>(null);

  if (cargando) return <SkeletonPagina />;

  return <main className="b18-prototype-page">
    <header className="b18-prototype-title">
      <div>
        <p>Ventas · {mapa.procedencia.capa}</p>
        <h1>Cartera <span>comercial de clientes</span></h1>
      </div>
      <BarraUsuario dataset={dataset} modulo="ventas" />
    </header>
    <MapaB18Clientes mapa={mapa} fmt={fmt} onVerFicha={setFicha} />
    {ficha ? <FichaClienteVentas
      dataset={dataset}
      clienteId={ficha}
      corte={mapa.procedencia.corte}
      fmt={fmt}
      onCerrar={() => setFicha(null)}
    /> : null}
  </main>;
}
