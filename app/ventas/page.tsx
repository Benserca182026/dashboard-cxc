"use client";

import { SkeletonPagina } from "@/components/Basicos";
import { Encabezado } from "@/components/Encabezado";
import { FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes } from "@/components/Argumento";
import { DecisionPanelV2 } from "@/components/DecisionPanelV2";
import { AGENTES_COMERCIALES_VENTAS } from "@/components/commercial/OperacionAgentes";
import { PanelAgentesVisuales } from "@/components/commercial/PanelAgentesVisuales";
import {
  OperacionControl,
  OperacionKpi,
  OperacionPuente,
  OperacionRanking,
  OperacionTendencia,
} from "@/components/commercial/OperacionVisuales";
import { analiticaVentas } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";
import costoHistoricoOdoo from "@/fixtures/costo-historico-odoo-resumen.json";

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-pulso", etiqueta: "Pulso comercial" },
  { id: "sec-ranking", etiqueta: "Top clientes y productos" },
  { id: "sec-tendencia", etiqueta: "Tendencia" },
  { id: "sec-puente", etiqueta: "Precio a resultado" },
  { id: "sec-control", etiqueta: "Control" },
];

function formatearMontoSinMoneda(valor: number): string {
  return valor.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaginaVentas() {
  const { dataset, cargando, fechaCorte, fmt, tipoCambio } = useApp();
  const analitica = analiticaVentas(dataset);
  const costoHistorico = costoHistoricoOdoo.poblacionConciliada;
  const fmtVenta = analitica.monedaPedidoDisponible ? fmt : formatearMontoSinMoneda;
  const notaMoneda = analitica.monedaPedidoDisponible
    ? `${analitica.pedidosPorMoneda.GTQ.toLocaleString("es-GT")} GTQ + ${analitica.pedidosPorMoneda.USD.toLocaleString("es-GT")} USD · normalizados sólo para la vista${tipoCambio ? ` con Q${tipoCambio.quetzalesPorDolar.toFixed(5)} por US$1` : ""}`
    : "moneda por pedido no preservada";
  const etiquetaComparacion = analitica.diaCorteComparacion
    ? `MTD comparable al día ${analitica.diaCorteComparacion}`
    : "MTD comparable";

  if (cargando) return <SkeletonPagina />;

  const agentes = (
    <FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_COMERCIALES_VENTAS} />
  );

  return (
    <div className="space-y-6">
      <Encabezado titulo="Ventas" secciones={SECCIONES} dataset={dataset} modulo="ventas" />
      <DecisionPanelV2 modulo="ventas" />
      <PanelAgentesVisuales dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_COMERCIALES_VENTAS} fmt={fmt} />

      <section id="sec-pulso" className="scroll-mt-24">
        <LienzoConAgentes titulo="Pulso comercial del período" agentes={agentes}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6876d8]">Lectura ejecutiva</p>
              <h2 className="mt-1 text-xl font-bold text-tinta">Qué se vendió, dónde se concentra y cómo cambió</h2>
            </div>
            <p className="text-[11px] text-tintaSuave">
              {analitica.desde && analitica.hasta
                ? `Ventana ${analitica.desde} → ${analitica.hasta} · corte general ${fechaCorte}`
                : "Período sin fechas comparables"}
            </p>
          </div>

          {!analitica.disponible ? (
            <div className="mt-5 rounded-2xl border border-dashed border-borde bg-white/60 p-6 text-sm text-tintaSuave">
              Este dataset no trae pedidos y líneas suficientes. No se muestran ceros que parezcan ventas.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <OperacionKpi etiqueta="Venta registrada" valor={fmtVenta(analitica.vendidoOdoo)} nota={`${analitica.pedidosConReferencia} pedidos · total Odoo con descuento aplicado · ${notaMoneda}`} tono="positivo" />
              <OperacionKpi etiqueta="Concentración Top 5" valor={analitica.concentracionTop5 === null ? "Sin dato" : `${analitica.concentracionTop5.toFixed(1)}%`} nota="Participación de los cinco clientes principales sobre la venta registrada" tono={(analitica.concentracionTop5 ?? 0) >= 60 ? "alerta" : "normal"} />
              <OperacionKpi etiqueta="Variación MTD comparable" valor={analitica.variacionUltimoPeriodo === null ? "Sin comparación" : `${analitica.variacionUltimoPeriodo >= 0 ? "+" : ""}${analitica.variacionUltimoPeriodo.toFixed(1)}%`} nota={`${analitica.periodoComparacionActual ?? "mes actual"} vs ${analitica.periodoComparacionAnterior ?? "mes anterior"}, ambos hasta el día ${analitica.diaCorteComparacion ?? "disponible"}`} tono={analitica.variacionUltimoPeriodo !== null && analitica.variacionUltimoPeriodo >= 0 ? "positivo" : "alerta"} />
              <OperacionKpi etiqueta="Brecha lista vs total" valor={analitica.brechaPct === null ? "Sin dato" : `${Math.abs(analitica.brechaPct).toFixed(2)}%`} nota="Mezcla descuento e IVA; no se interpreta como descuento real" tono="alerta" />
              <OperacionKpi etiqueta="Pedidos sin total Odoo" valor={analitica.pedidosSinReferencia.toLocaleString("es-GT")} nota={`${analitica.pedidos} pedidos confirmados evaluados`} tono={analitica.pedidosSinReferencia > 0 ? "alerta" : "normal"} />
            </div>
          )}
        </LienzoConAgentes>
      </section>

      <section id="sec-ranking" className="scroll-mt-24">
        <LienzoConAgentes titulo="Dónde está el dinero" agentes={agentes}>
          <div className="grid gap-4 lg:grid-cols-2">
            <OperacionRanking titulo="Clientes por venta registrada" subtitulo={`Total Odoo por pedido · moneda reconciliada en ${analitica.pedidosConReferencia.toLocaleString("es-GT")} de ${analitica.pedidos.toLocaleString("es-GT")} pedidos`} filas={analitica.topClientes} formatear={fmtVenta} vacio="No hay pedidos con total Odoo para ordenar clientes." />
            <OperacionRanking titulo="Productos por valor a precio de lista" subtitulo="Cantidad × precio unitario en la moneda recuperada del pedido · señal separada; no equivale a venta neta ni margen" filas={analitica.topProductos} formatear={fmtVenta} vacio="No hay líneas relacionadas con productos para construir el ranking." />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-tintaSuave">
            No se muestra Top vendedores: el XLSX trae “Comercial”, pero el importador actual no lo preserva en el modelo. El espacio se mantiene bloqueado, no se fabrica un ranking.
          </p>
        </LienzoConAgentes>
      </section>

      <section id="sec-tendencia" className="scroll-mt-24">
        <LienzoConAgentes titulo="Qué cambió" agentes={agentes}>
          <OperacionTendencia
            puntos={analitica.tendencia}
            formatear={fmtVenta}
            variacion={analitica.variacionUltimoPeriodo}
            etiquetaComparacion={etiquetaComparacion}
            notaCorte={`última venta ${analitica.hasta ?? "sin fecha"}`}
          />
        </LienzoConAgentes>
      </section>

      <section id="sec-puente" className="scroll-mt-24">
        <LienzoConAgentes titulo="Del precio de lista al resultado comercial" agentes={agentes}>
          <OperacionPuente
            titulo="Margen histórico conciliado en Odoo"
            subtitulo={`Snapshot ${costoHistoricoOdoo.snapshot.finUtc.slice(0, 16).replace("T", " ")} UTC · ${costoHistoricoOdoo.cobertura.lineasConciliadas.toLocaleString("es-GT")} líneas con cantidad facturada neta = cantidad entregada neta.`}
            pasos={[
              { etiqueta: "Ingreso neto sin IVA", valor: fmt(costoHistorico.ingresoNetoSinIvaGTQ), nota: "−Σ balance de facturas publicadas y notas de crédito vinculadas" },
              { etiqueta: "Costo histórico estándar", valor: fmt(costoHistorico.costoHistoricoEstandarGTQ), nota: "−Σ stock.valuation.layer.value por movimiento de entrega/devolución", tono: "alerta" },
              { etiqueta: "Margen bruto", valor: fmt(costoHistorico.margenBrutoGTQ), nota: "ingreso conciliado − valoración histórica estándar", tono: "positivo" },
              { etiqueta: "Margen sobre población", valor: `${costoHistorico.margenPct.toFixed(2)}%`, nota: `cobertura ${costoHistorico.coberturaIngresoPct.toFixed(2)}% del ingreso vinculado`, tono: "positivo" },
            ]}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OperacionKpi etiqueta="Cobertura conciliada" valor={`${costoHistoricoOdoo.cobertura.lineasConciliadas.toLocaleString("es-GT")} / ${costoHistoricoOdoo.cobertura.lineasActivas.toLocaleString("es-GT")}`} nota={`${costoHistoricoOdoo.cobertura.estadosLinea["entregada-no-facturada"]} líneas entregadas no facturadas y ${costoHistoricoOdoo.cobertura.estadosLinea["facturada-no-entregada"]} facturadas no entregadas quedan fuera`} />
            <OperacionKpi etiqueta="Calidad contable del costo" valor="Parcial conciliado" nota="Odoo usa costo estándar y valoración manual; no es FIFO/AVCO ni existe asiento COGS automático por capa" tono="alerta" />
          </div>
        </LienzoConAgentes>
      </section>

      <section id="sec-control" className="scroll-mt-24">
        <LienzoConAgentes titulo="Controles secundarios" agentes={agentes}>
          <OperacionControl
            titulo="Lo que falta antes de afirmar margen y desempeño por vendedor"
            items={[
              `El ingreso neto ya sale de ${costoHistoricoOdoo.cobertura.facturasPublicadas.toLocaleString("es-GT")} facturas y ${costoHistoricoOdoo.cobertura.notasCreditoPublicadas.toLocaleString("es-GT")} notas de crédito publicadas, usando account.move.line.balance en GTQ.`,
              `La cadena por ID está demostrada: ${costoHistoricoOdoo.cobertura.movimientosTerminados.toLocaleString("es-GT")} movimientos terminados y la misma cantidad de capas; diferencia de cantidad y valor = 0.`,
              "El costo sigue siendo estándar histórico: las cuatro categorías están configuradas como standard + manual_periodic. No debe llamarse costo real FIFO/AVCO ni margen contable definitivo.",
              `${costoHistoricoOdoo.universoValoracion.capasSinMovimiento} ajustes manuales de valor, por ${fmt(costoHistoricoOdoo.universoValoracion.ajustesManualesSinMovimientoValorGTQ)}, no tienen stock_move_id y no se reparten entre pedidos.`,
              "El XLSX original trae la columna Comercial, pero el importador actual no la guarda; por eso el Top vendedores sigue bloqueado.",
            ]}
          />
        </LienzoConAgentes>
      </section>
    </div>
  );
}
