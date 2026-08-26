"use client";

import { SkeletonPagina } from "@/components/Basicos";
import { Encabezado } from "@/components/Encabezado";
import { FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes } from "@/components/Argumento";
import { DecisionPanelV2 } from "@/components/DecisionPanelV2";
import { AGENTES_COMERCIALES_INVENTARIO } from "@/components/commercial/OperacionAgentes";
import { PanelAgentesVisuales } from "@/components/commercial/PanelAgentesVisuales";
import {
  OperacionControl,
  OperacionKpi,
  OperacionRanking,
} from "@/components/commercial/OperacionVisuales";
import { analiticaInventario } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-pulso", etiqueta: "Pulso" },
  { id: "sec-rotacion", etiqueta: "Valor y rotación" },
  { id: "sec-acciones", etiqueta: "Acciones" },
  { id: "sec-control", etiqueta: "Control" },
];

export default function PaginaInventario() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const analitica = analiticaInventario(dataset);

  if (cargando) return <SkeletonPagina />;

  const agentes = (
    <FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_COMERCIALES_INVENTARIO} />
  );

  return (
    <div className="space-y-6">
      <Encabezado titulo="Inventario" secciones={SECCIONES} dataset={dataset} modulo="inventario" />
      <DecisionPanelV2 modulo="inventario" modoAuditable />
      <PanelAgentesVisuales dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_COMERCIALES_INVENTARIO} fmt={fmt} />

      <section className="rounded-[20px] border border-white/80 bg-white/60 px-4 py-3 shadow-flotante">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6876d8]">Cortes que conviven sin mezclarse</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-tintaSuave">
          Existencia y valoración verificadas: exports Odoo del 2026-08-19. Flujo operativo: {analitica.desde ?? "sin inicio"} → {analitica.hasta ?? "sin fin"} desde {dataset.fuente}. El contenedor V2 es del 25 de agosto, pero no convierte los controles anteriores en datos de ese día.
        </p>
      </section>

      <section id="sec-pulso" className="scroll-mt-24">
        <LienzoConAgentes titulo="Pulso comercial del inventario" agentes={agentes}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6876d8]">Flujo verificable</p>
              <h2 className="mt-1 text-xl font-bold text-tinta">Qué productos mueven valor y dónde actuar primero</h2>
            </div>
            <p className="text-[11px] text-tintaSuave">
              {analitica.desde && analitica.hasta ? `${analitica.desde} → ${analitica.hasta} · ${analitica.movimientos.toLocaleString("es-GT")} movimientos` : "Sin ventana de movimientos"}
            </p>
          </div>

          {!analitica.disponible ? (
            <div className="mt-5 rounded-2xl border border-dashed border-borde bg-white/60 p-6 text-sm text-tintaSuave">
              Este dataset no trae catálogo y movimientos suficientes para analizar inventario.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OperacionKpi etiqueta="Valor de salidas" valor={fmt(analitica.valorSalidas)} nota={`Unidades de salida × costo unitario · ${analitica.unidadesSalidaSinCosto} unidades (${analitica.movimientosSalidaSinCosto} movimientos) quedan en ${fmt(0)} por costo faltante`} tono="positivo" />
              <OperacionKpi etiqueta="Unidades de salida" valor={Math.round(analitica.unidadesSalida).toLocaleString("es-GT")} nota={`${analitica.productosConMovimiento} productos con movimiento`} />
              <OperacionKpi etiqueta="Existencia valorizada" valor={analitica.valorExistencia === null ? "No afirmable" : fmt(analitica.valorExistencia)} nota={analitica.existenciaAfirmable ? "Serie completa según movimientos disponibles" : `${analitica.seriesTruncadas} series arrancan con salida; falta saldo inicial`} tono={analitica.existenciaAfirmable ? "normal" : "alerta"} />
              <OperacionKpi etiqueta="Bajo mínimo" valor={analitica.productosBajoMinimo === null ? "No calculable" : analitica.productosBajoMinimo.toLocaleString("es-GT")} nota={analitica.minimoAfirmable ? "Comparación contra mínimos declarados" : "No hay política de mínimos poblada"} tono={analitica.productosBajoMinimo === null ? "alerta" : "normal"} />
            </div>
          )}
        </LienzoConAgentes>
      </section>

      <section id="sec-rotacion" className="scroll-mt-24">
        <LienzoConAgentes titulo="Productos que mueven más valor" agentes={agentes}>
          <div className="grid gap-4 lg:grid-cols-2">
            <OperacionRanking
              titulo="Top salidas valorizadas"
              subtitulo={`ABC completo: ${analitica.distribucionAbc.A} A · ${analitica.distribucionAbc.B} B · ${analitica.distribucionAbc.C} C sobre ${analitica.productosConSalidaValorizada} productos; se muestran los líderes`}
              filas={analitica.topSalidas.map((fila) => ({ ...fila, detalle: `Clase ${fila.claseAbc ?? "C"} · ${fila.detalle ?? ""}` }))}
              formatear={fmt}
              vacio="No hay salidas valorizables en la ventana observada."
            />
            {analitica.existenciaAfirmable ? (
              <OperacionRanking titulo="Top valor almacenado" subtitulo="Sólo se muestra porque la serie disponible permite afirmar existencia" filas={analitica.topExistencia} formatear={fmt} vacio="No hay existencias positivas valorizables." />
            ) : (
              <OperacionControl
                titulo="Top valor almacenado bloqueado por datos"
                items={[
                  `La ventana tiene ${analitica.seriesTruncadas} series cuyo primer movimiento es una salida.`,
                  "La variación neta de una ventana no equivale a la existencia actual.",
                  "Se conserva el Top de salidas porque es un flujo real; no se fabrica el valor almacenado.",
                ]}
              />
            )}
          </div>
        </LienzoConAgentes>
      </section>

      <section id="sec-acciones" className="scroll-mt-24">
        <LienzoConAgentes titulo="Acciones comerciales sugeridas" agentes={agentes}>
          <div className="grid gap-4 lg:grid-cols-2">
            <OperacionRanking
              titulo="Revisar baja rotación"
              subtitulo={`${analitica.candidatosSinSalida} candidatos · denominador completo ${fmt(analitica.valorEntradasSinSalida)} · se muestran los líderes`}
              filas={analitica.entradasSinSalida}
              formatear={fmt}
              vacio="No hay productos con entradas y cero salidas en la ventana."
            />
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-[24px] border border-white/90 bg-white/70 p-5 shadow-flotante">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6876d8]">Validar reposición</p>
                <p className="mt-2 text-sm font-bold text-tinta">Empezar por {analitica.topSalidas[0]?.etiqueta ?? "el producto de mayor salida"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-tintaSuave">La salida prioriza la revisión; comprar requiere existencia y mínimo confiables.</p>
              </article>
              <article className="rounded-[24px] border border-white/90 bg-white/70 p-5 shadow-flotante">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6876d8]">Revisar liquidación</p>
                <p className="mt-2 text-sm font-bold text-tinta">{analitica.candidatosSinSalida} candidatos · {fmt(analitica.valorEntradasSinSalida)}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-tintaSuave">Antes de liquidar se necesita existencia, antigüedad por lote y demanda histórica suficiente.</p>
              </article>
              <article className="rounded-[24px] border border-white/90 bg-white/70 p-5 shadow-flotante">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6876d8]">Reubicar</p>
                <p className="mt-2 text-sm font-bold text-tinta">Trazabilidad parcial de ubicaciones</p>
                <p className="mt-2 text-[11px] leading-relaxed text-tintaSuave">{analitica.movimientosConUbicacion.toLocaleString("es-GT")} movimientos conservan origen/destino y {analitica.ubicacionesObservadas.length} ubicaciones distintas. Las transferencias internas fueron omitidas al importar, por lo que no se inventa una reubicación actual.</p>
              </article>
            </div>
          </div>
        </LienzoConAgentes>
      </section>

      <section id="sec-control" className="scroll-mt-24">
        <LienzoConAgentes titulo="Controles secundarios" agentes={agentes}>
          <OperacionControl
            titulo="Cobertura necesaria para decisiones automáticas"
            items={[
              analitica.existenciaAfirmable ? "La existencia es afirmable con la serie disponible." : "Falta saldo inicial fechado en el mismo instante que la ventana de movimientos.",
              analitica.minimoAfirmable ? "Hay mínimos positivos en el catálogo." : "El punto de reorden no está poblado de forma utilizable.",
              `${analitica.salidasSinVenta.toLocaleString("es-GT")} de ${analitica.movimientosSalida.toLocaleString("es-GT")} salidas no declaran una venta de origen; el vínculo se perdió en el importador.`,
              `${analitica.productosConCostoCero} productos tienen costo cero y ${analitica.unidadesSalidaSinCosto} unidades de salida en ${analitica.movimientosSalidaSinCosto} movimientos quedan sin valorar; el total es un mínimo conocido.`,
              `${analitica.movimientosConUbicacion.toLocaleString("es-GT")} movimientos conservan origen/destino, pero se omitieron transferencias internas; no hay lotes ni fechas de ingreso por unidad para calcular antigüedad o ubicación actual.`,
            ]}
          />
        </LienzoConAgentes>
      </section>
    </div>
  );
}
