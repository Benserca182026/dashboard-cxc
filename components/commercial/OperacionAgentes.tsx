import type { Agente, EntradaEvidencia, Evidencia, Ranking } from "@/components/Agentes";
import {
  analiticaForecast,
  analiticaInventario,
  analiticaVentas,
  type FilaComercial,
} from "@/lib/commercial-operacion";
import type { Dataset } from "@/lib/types";
import costoHistoricoOdoo from "@/fixtures/costo-historico-odoo-resumen.json";

function evidencia(
  modelo: string,
  filtro: string,
  corte: string,
  expresion: string,
  entradas: EntradaEvidencia[],
  enlace: string
): Evidencia {
  return { expresion, entradas, procedencia: { modelo, filtro, corte, enlace } };
}

function ranking(filas: FilaComercial[], total: number, unidad: string): Ranking {
  return {
    total,
    unidad,
    filas: filas.map((fila) => ({
      id: fila.id,
      etiqueta: fila.etiqueta,
      valor: fila.valor,
      pct: fila.pct,
    })),
  };
}

function moneda(dataset: Dataset): string {
  return dataset.fuente === "odoo-real" ? "GTQ" : "USD";
}

function unidadVenta(dataset: Dataset): string {
  return dataset.fuente === "odoo-real" ? "moneda de pedido no preservada" : "USD";
}

export const AGENTES_COMERCIALES_VENTAS: Agente[] = [
  {
    id: "oportunidad-ventas",
    glifo: "◎",
    nombre: "Oportunidad",
    pregunta: "¿Qué cliente explica más venta registrada del período?",
    base: "total Odoo por cliente · Top 10",
    mirar: (dataset, corte) => {
      const a = analiticaVentas(dataset);
      const primero = a.topClientes[0];
      if (!primero) {
        return {
          estado: "sin-dato",
          queFalta: "Pedidos con total de referencia Odoo y cliente identificado.",
          consecuencia: "No se puede ordenar la oportunidad comercial por dinero real vendido.",
          comoSeLlena: "Importando sale.order con partner_id, date_order y amount_total/total de referencia.",
        };
      }
      return {
        estado: "hallazgo",
        texto: `${primero.etiqueta} lidera la venta registrada con ${primero.pct.toFixed(1)}% del total. El ranking permite decidir dónde proteger y replicar ingresos.`,
        evidencia: evidencia(
          "ventas.total_referencia + clientes",
          "pedidos confirmados con total Odoo; moneda de cada pedido no preservada por el importador",
          a.hasta ?? corte,
          "Σ total Odoo por cliente ÷ total Odoo",
          [
            { nombre: "venta registrada", valor: a.vendidoOdoo, unidad: unidadVenta(dataset) },
            { nombre: "cliente líder", valor: primero.etiqueta },
            { nombre: "participación", valor: primero.pct, unidad: "%" },
          ],
          "/ventas#sec-ranking"
        ),
        ranking: ranking(a.topClientes, a.vendidoOdoo, unidadVenta(dataset)),
      };
    },
  },
  {
    id: "cambio-ventas",
    glifo: "↕",
    nombre: "Cambio",
    pregunta: "¿La venta MTD crece o cae contra el mismo número de días del mes anterior?",
    base: "(mes actual hasta día de última venta − mes anterior al mismo día) ÷ mes anterior comparable",
    mirar: (dataset, corte) => {
      const a = analiticaVentas(dataset);
      const variacion = a.variacionUltimoPeriodo;
      if (variacion === null) {
        return {
          estado: "sin-dato",
          queFalta: "Al menos dos meses con pedidos que tengan total de referencia Odoo.",
          consecuencia: "No hay una base comparable para decir si la venta está creciendo o cayendo.",
          comoSeLlena: "Ampliando la ventana histórica de sale.order sin rellenar meses inexistentes con cero.",
        };
      }
      const cae = variacion < 0;
      return {
        estado: cae ? "hallazgo" : "sin-hallazgo",
        texto: `${a.periodoComparacionActual ?? "El mes actual"} ${cae ? "cae" : "crece"} ${Math.abs(variacion).toFixed(1)}% frente a ${a.periodoComparacionAnterior ?? "el mes anterior"}, comparando ambos solamente hasta el día ${a.diaCorteComparacion ?? "disponible"}.`,
        evidencia: evidencia(
          "ventas.total_referencia agrupado por fecha_venta",
          `pedidos confirmados; ${a.periodoComparacionActual ?? "mes actual"} y ${a.periodoComparacionAnterior ?? "mes anterior"} hasta el día ${a.diaCorteComparacion ?? "sin corte"}`,
          a.hasta ?? corte,
          "(venta MTD actual − venta MTD anterior comparable) ÷ venta MTD anterior comparable",
          [
            { nombre: "venta MTD actual", valor: a.ventaPeriodoActualComparable, unidad: unidadVenta(dataset) },
            { nombre: "venta MTD anterior", valor: a.ventaPeriodoAnteriorComparable, unidad: unidadVenta(dataset) },
            { nombre: "variación", valor: variacion, unidad: "%" },
          ],
          "/ventas#sec-tendencia"
        ),
      };
    },
  },
  {
    id: "accion-ventas",
    glifo: "→",
    nombre: "Próxima acción",
    pregunta: "¿Dónde conviene concentrar la siguiente revisión comercial?",
    base: "concentración Top 5 por total Odoo; producto de lista como control separado",
    mirar: (dataset, corte) => {
      const a = analiticaVentas(dataset);
      const cliente = a.topClientes[0];
      const producto = a.topProductos[0];
      if (!cliente && !producto) {
        return {
          estado: "sin-dato",
          queFalta: "Pedidos o líneas suficientes para formar rankings de cliente y producto.",
          consecuencia: "No se puede proponer una revisión comercial respaldada por ventas observadas.",
          comoSeLlena: "Cargando pedidos, clientes, líneas y catálogo de productos relacionados por id.",
        };
      }
      return {
        estado: "hallazgo",
        texto: `Revisar primero ${cliente?.etiqueta ?? "el cliente líder"}: el Top 5 concentra ${(a.concentracionTop5 ?? 0).toFixed(1)}% de la venta registrada. ${producto ? `${producto.etiqueta} lidera por precio de lista, como señal separada que todavía no prueba venta neta.` : ""}`,
        evidencia: evidencia(
          "rankings comerciales de ventas",
          "cliente sobre total Odoo; producto sobre cantidad × precio de lista",
          a.hasta ?? corte,
          "Σ Top 5 clientes ÷ total Odoo",
          [
            { nombre: "concentración Top 5", valor: a.concentracionTop5 ?? 0, unidad: "%" },
            { nombre: "cliente líder", valor: cliente?.etiqueta ?? "sin dato" },
            { nombre: "producto líder por lista", valor: producto?.etiqueta ?? "sin dato" },
          ],
          "/ventas#sec-ranking"
        ),
      };
    },
  },
  {
    id: "control-ventas",
    glifo: "✓",
    nombre: "Control",
    pregunta: "¿Qué dato impide leer margen, vendedor y cadena con precisión?",
    base: "cobertura de descuento, vendedor y vínculo venta↔factura",
    mirar: (dataset, corte) => {
      const a = analiticaVentas(dataset);
      const margen = costoHistoricoOdoo.poblacionConciliada;
      const faltantes = ["vendedor preservado en el esquema", "costo FIFO/AVCO o asiento COGS automático"];
      if (!a.vinculoFacturaDisponible) faltantes.push("vínculo venta↔factura");
      return {
        estado: "hallazgo",
        texto: `El snapshot Odoo concilia un margen de ${margen.margenPct.toFixed(2)}% sobre ${margen.coberturaIngresoPct.toFixed(2)}% del ingreso vinculado. Es margen sobre costo estándar histórico, no costo real FIFO/AVCO. Todavía faltan ${faltantes.join(", ")}.`,
        evidencia: evidencia(
          "account.move.line + sale.order.line + stock.move + stock.valuation.layer",
          "sólo líneas con factura/nota publicada y cantidad facturada neta = cantidad entregada neta",
          costoHistoricoOdoo.snapshot.finUtc,
          "−Σ balance − (−Σ SVL.value); devoluciones y notas de crédito conservan signo",
          [
            { nombre: "ingreso neto conciliado", valor: margen.ingresoNetoSinIvaGTQ, unidad: "GTQ" },
            { nombre: "costo estándar histórico", valor: margen.costoHistoricoEstandarGTQ, unidad: "GTQ" },
            { nombre: "margen bruto", valor: margen.margenBrutoGTQ, unidad: "GTQ" },
            { nombre: "margen", valor: margen.margenPct, unidad: "%" },
            { nombre: "líneas conciliadas", valor: costoHistoricoOdoo.cobertura.lineasConciliadas },
            { nombre: "vendedor disponible", valor: "no" },
          ],
          "/ventas#sec-puente"
        ),
      };
    },
  },
];

export const AGENTES_COMERCIALES_INVENTARIO: Agente[] = [
  {
    id: "oportunidad-inventario",
    glifo: "◎",
    nombre: "Movimiento de valor",
    pregunta: "¿Qué productos concentran más salida valorizada?",
    base: "Σ unidades de salida × costo unitario por producto · ABC sobre toda la población valorizable",
    mirar: (dataset, corte) => {
      const a = analiticaInventario(dataset);
      const primero = a.topSalidas[0];
      if (!primero) return { estado: "sin-dato", queFalta: "Salidas con producto y costo unitario.", consecuencia: "No se puede ordenar el movimiento económico del inventario.", comoSeLlena: "Importando movimientos y catálogo relacionados por id_producto." };
      return {
        estado: "hallazgo",
        texto: `${primero.etiqueta} lidera la salida valorizada con ${primero.pct.toFixed(1)}% del total observado.`,
        evidencia: evidencia("movimientosInventario + productos.costo_unitario", `sólo flujos tipo salida; ABC calculado sobre ${a.productosConSalidaValorizada} productos valorizables`, a.hasta ?? corte, "Σ |cantidad salida| × costo unitario", [{ nombre: "valor de salidas", valor: a.valorSalidas, unidad: moneda(dataset) }, { nombre: "participación líder", valor: primero.pct, unidad: "%" }, { nombre: "unidades sin costo", valor: a.unidadesSalidaSinCosto }, { nombre: "movimientos sin costo", valor: a.movimientosSalidaSinCosto }], "/inventario#sec-rotacion"),
        ranking: ranking(a.topSalidas, a.valorSalidas, moneda(dataset)),
      };
    },
  },
  {
    id: "riesgo-inventario",
    glifo: "△",
    nombre: "Riesgo",
    pregunta: "¿Qué productos requieren validar reposición primero?",
    base: "ranking de salidas; existencia sólo si hay saldo inicial completo",
    mirar: (dataset, corte) => {
      const a = analiticaInventario(dataset);
      if (!a.existenciaAfirmable) {
        return {
          estado: "sin-dato",
          queFalta: `Saldo inicial consistente para la ventana que termina ${a.hasta ?? corte}: ${a.seriesTruncadas} series arrancan con una salida.`,
          consecuencia: "No se puede afirmar quiebre ni recomendar compra; sólo priorizar una validación según salidas observadas.",
          comoSeLlena: "Cargando stock de apertura a la misma fecha del primer movimiento y mínimos reales por producto.",
        };
      }
      return {
        estado: (a.productosBajoMinimo ?? 0) > 0 ? "hallazgo" : "sin-hallazgo",
        texto: `${a.productosBajoMinimo ?? 0} producto(s) están bajo el mínimo declarado; revisar primero los de mayor salida valorizada.`,
        evidencia: evidencia("saldo inicial + movimientos + stock_minimo", "sólo series completas y mínimos positivos", a.hasta ?? corte, "existencia ≤ mínimo", [{ nombre: "productos bajo mínimo", valor: a.productosBajoMinimo ?? 0 }], "/inventario#sec-acciones"),
      };
    },
  },
  {
    id: "accion-inventario",
    glifo: "→",
    nombre: "Próxima acción",
    pregunta: "¿Qué entradas sin salida conviene revisar por baja rotación?",
    base: "productos con entradas > 0 y salidas = 0 en la ventana",
    mirar: (dataset, corte) => {
      const a = analiticaInventario(dataset);
      const primero = a.entradasSinSalida[0];
      if (!primero) return { estado: "sin-hallazgo", texto: "No hay productos con entradas y cero salidas dentro de la ventana observada.", evidencia: evidencia("movimientosInventario", "entradas observadas y ninguna salida en la misma ventana", a.hasta ?? corte, "entradas > 0 ∧ salidas = 0", [{ nombre: "candidatos", valor: 0 }], "/inventario#sec-acciones") };
      return {
        estado: "hallazgo",
        texto: `Revisar rotación de ${primero.etiqueta}: registra entradas sin salida en la ventana. Es candidato a análisis, no una orden automática de liquidar.`,
        evidencia: evidencia("movimientosInventario + productos", "entradas sin salida dentro de la ventana; no afirma stock disponible", a.hasta ?? corte, "entradas > 0 ∧ salidas = 0", [{ nombre: "candidatos", valor: a.candidatosSinSalida }, { nombre: "valor completo de candidatos", valor: a.valorEntradasSinSalida, unidad: moneda(dataset) }, { nombre: "valor de entradas del líder", valor: primero.valor, unidad: moneda(dataset) }], "/inventario#sec-acciones"),
        ranking: ranking(a.entradasSinSalida, a.valorEntradasSinSalida, moneda(dataset)),
      };
    },
  },
  {
    id: "control-inventario",
    glifo: "✓",
    nombre: "Control",
    pregunta: "¿Qué limita las decisiones comprar, liquidar o reubicar?",
    base: "cobertura de saldo inicial, mínimos, lotes y ubicaciones",
    mirar: (dataset, corte) => {
      const a = analiticaInventario(dataset);
      return {
        estado: !a.existenciaAfirmable || !a.minimoAfirmable ? "hallazgo" : "sin-hallazgo",
        texto: `Existencia ${a.existenciaAfirmable ? "afirmable" : "no afirmable"}; mínimos ${a.minimoAfirmable ? "disponibles" : "no disponibles"}. ${a.movimientosConUbicacion > 0 ? `Se preservan ubicaciones de origen/destino en ${a.movimientosConUbicacion} movimientos, pero el importador omitió transferencias internas y no permite afirmar ubicación actual.` : "No hay ubicaciones utilizables en el dataset cargado."}`,
        evidencia: evidencia("productos + movimientosInventario", "la ausencia de saldo inicial, mínimo, lote o transferencia interna no se reemplaza con variación neta", a.hasta ?? corte, "controles de cobertura", [{ nombre: "series truncadas", valor: a.seriesTruncadas }, { nombre: "mínimo afirmable", valor: a.minimoAfirmable ? "sí" : "no" }, { nombre: "salidas sin venta", valor: `${a.salidasSinVenta}/${a.movimientosSalida}` }, { nombre: "movimientos con ubicación", valor: a.movimientosConUbicacion }], "/inventario#sec-control"),
      };
    },
  },
];

export const AGENTES_COMERCIALES_FORECAST: Agente[] = [
  {
    id: "oportunidad-forecast",
    glifo: "◎",
    nombre: "Contribución",
    pregunta: "¿Qué clientes sostienen más cobro del escenario base?",
    base: "saldo elegible que cae dentro de 13 semanas, agrupado por cliente",
    mirar: (dataset, corte) => {
      const a = analiticaForecast(dataset, corte);
      const primero = a.topContribuyentes[0];
      if (!primero) return { estado: "sin-dato", queFalta: "Facturas abiertas con vencimiento y cliente dentro del horizonte base.", consecuencia: "No se puede identificar quién sostiene el escenario.", comoSeLlena: "Completando vencimientos y relaciones factura-cliente." };
      return {
        estado: "hallazgo",
        texto: `${primero.etiqueta} aporta ${primero.pct.toFixed(1)}% del escenario base a 13 semanas.`,
        evidencia: evidencia("facturas abiertas + pagos + notas + clientes", "saldo pendiente con vencimiento que cae en el horizonte base simulado", corte, "Σ saldo base por cliente ÷ base semana 13", [{ nombre: "base semana 13", valor: a.base13, unidad: moneda(dataset) }, { nombre: "participación líder", valor: primero.pct, unidad: "%" }], "/forecast#sec-contribuyentes"),
        ranking: ranking(a.topContribuyentes, a.base13, moneda(dataset)),
      };
    },
  },
  {
    id: "brecha-forecast-comercial",
    glifo: "△",
    nombre: "Brecha",
    pregunta: "¿Cuánto saldo abierto queda fuera del escenario base de 13 semanas?",
    base: "saldo abierto − cobro base semana 13",
    mirar: (dataset, corte) => {
      const a = analiticaForecast(dataset, corte);
      return {
        estado: a.brechaHorizonte > 0 ? "hallazgo" : "sin-hallazgo",
        texto: `${a.brechaHorizonte > 0 ? "Queda" : "No queda"} ${a.brechaHorizonte.toLocaleString("es-GT", { maximumFractionDigits: 2 })} fuera del escenario base; incluye vencimientos fuera de horizonte y datos no elegibles.`,
        evidencia: evidencia("facturas − pagos aplicados − notas aplicadas", "saldo abierto al corte contra escenario base simulado de 13 semanas", corte, "saldo abierto − base semana 13", [{ nombre: "saldo abierto", valor: a.saldoAbierto, unidad: moneda(dataset) }, { nombre: "base semana 13", valor: a.base13, unidad: moneda(dataset) }, { nombre: "brecha", valor: a.brechaHorizonte, unidad: moneda(dataset) }], "/forecast#sec-puente"),
      };
    },
  },
  {
    id: "accion-forecast",
    glifo: "→",
    nombre: "Reactivación",
    pregunta: "¿Qué cliente del año anterior conviene reactivar primero?",
    base: "facturó el año anterior y no en el año del corte · ranking por valor histórico",
    mirar: (dataset, corte) => {
      const a = analiticaForecast(dataset, corte);
      const primero = a.reactivacion[0];
      if (!primero) return { estado: "sin-dato", queFalta: "Facturación comparable del año anterior y del año del corte.", consecuencia: "No se puede priorizar reactivación por valor histórico.", comoSeLlena: "Conservando al menos dos años de facturas no anuladas relacionadas con clientes." };
      return {
        estado: "hallazgo",
        texto: `Revisar reactivación de ${primero.etiqueta}: es el cliente perdido con mayor facturación del año anterior${primero.ultimaVenta ? ` y su última factura fue ${primero.ultimaVenta}` : ""}.`,
        evidencia: evidencia("facturas.monto_original + clientes", "facturó el año anterior y no tiene facturas no anuladas en el año del corte; no afirma probabilidad de retorno", corte, "ranking por facturación del año anterior", [{ nombre: "candidatos", valor: a.reactivacionTotal }, { nombre: "valor histórico conjunto", valor: a.reactivacionValorHistorico, unidad: moneda(dataset) }, { nombre: "valor histórico líder", valor: primero.valor, unidad: moneda(dataset) }], "/forecast#sec-reactivacion"),
        ranking: ranking(a.reactivacion, a.reactivacionValorHistorico, moneda(dataset)),
      };
    },
  },
  {
    id: "control-forecast",
    glifo: "✓",
    nombre: "Confianza",
    pregunta: "¿Hay meta y probabilidad validadas para llamar pronóstico a la curva?",
    base: "cobertura de meta, histórico y modelo probabilístico",
    mirar: (dataset, corte) => {
      const a = analiticaForecast(dataset, corte);
      return {
        estado: "hallazgo",
        texto: "No hay meta comercial ni histórico de cobro para calibrar probabilidades. Las tres curvas siguen siendo escenarios mecánicos, no un compromiso de caja.",
        evidencia: evidencia("esquema Dataset + supuestos del forecast", "no se asignan probabilidades inventadas a optimista/base/pesimista", corte, "controles de cobertura", [{ nombre: "meta disponible", valor: a.metaDisponible ? "sí" : "no" }, { nombre: "probabilidad validada", valor: a.probabilidadValidada ? "sí" : "no" }, { nombre: "saldo sin vencimiento", valor: a.saldoSinVencimiento, unidad: moneda(dataset) }], "/forecast#sec-control"),
      };
    },
  },
];
