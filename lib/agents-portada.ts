import type { AnaliticaVentas } from "./commercial-operacion";

export type SeveridadProblema = "critico" | "alto" | "medio";

export interface ProblemaPortada {
  id: string;
  agente: string;
  titulo: string;
  metrica: string;
  evidencia: string;
  accion: string;
  href: string;
  severidad: SeveridadProblema;
  prioridad: number;
}

export interface ResultadoAgentesPortada {
  ventaAuditoria: number;
  diferenciaAuditoria: number;
  ticketPromedio: number;
  problemas: ProblemaPortada[];
}

// Referencia registrada en el expediente de Auditoría para los mismos
// 3,189 pedidos. Se conserva separada del cálculo vivo del Dashboard.
export const VENTA_AUDITORIA_REFERENCIA = 19_292_422.91;

function absPct(valor: number | null): number {
  return Math.abs(valor ?? 0);
}

/**
 * Agentes deterministas de la portada. Cada hallazgo se deriva de una regla
 * visible; no hay texto generado ni decisiones automáticas.
 */
export function ejecutarAgentesPortada(ventas: AnaliticaVentas): ResultadoAgentesPortada {
  const diferenciaAuditoria = Number((ventas.vendidoOdoo - VENTA_AUDITORIA_REFERENCIA).toFixed(2));
  const ticketPromedio = ventas.pedidosConReferencia > 0
    ? Number((ventas.vendidoOdoo / ventas.pedidosConReferencia).toFixed(2))
    : 0;
  const variacion = ventas.variacionUltimoPeriodo ?? 0;
  const principalCliente = ventas.topClientes[0];
  const principalProducto = ventas.topProductos[0];

  const problemas: ProblemaPortada[] = [
    {
      id: "reconciliacion",
      agente: "Agente de reconciliación",
      titulo: "Dos totales para la misma venta",
      metrica: `Δ Q${Math.abs(diferenciaAuditoria).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      evidencia: `Dashboard y Auditoría conservan una diferencia de Q${Math.abs(diferenciaAuditoria).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      accion: "Abrir la comparación de fuentes antes de declarar un total definitivo.",
      href: "/datos",
      severidad: Math.abs(diferenciaAuditoria) > 1 ? "critico" : "medio",
      prioridad: Math.abs(diferenciaAuditoria) > 1 ? 100 : 20,
    },
    {
      id: "variacion",
      agente: "Agente de cambio",
      titulo: variacion < 0 ? "Caída en período comparable" : "Cambio comercial por explicar",
      metrica: `${variacion >= 0 ? "+" : "−"}${absPct(variacion).toFixed(1)}%`,
      evidencia: `${ventas.periodoComparacionActual ?? "Período actual"} frente a ${ventas.periodoComparacionAnterior ?? "período anterior"}, ambos hasta el día ${ventas.diaCorteComparacion ?? "—"}.`,
      accion: "Abrir clientes y productos que más aportan al cambio.",
      href: "/ventas",
      severidad: variacion <= -20 ? "critico" : variacion < 0 ? "alto" : "medio",
      prioridad: variacion < 0 ? 90 + Math.min(9, absPct(variacion) / 10) : 45,
    },
    {
      id: "concentracion",
      agente: "Agente de concentración",
      titulo: "Venta dependiente de pocos clientes",
      metrica: `${(ventas.concentracionTop5 ?? 0).toFixed(1)}% Top 5`,
      evidencia: principalCliente
        ? `${principalCliente.etiqueta} encabeza la concentración con ${principalCliente.pct.toFixed(1)}% del total.`
        : "No hay clientes suficientes para calcular concentración.",
      accion: "Revisar los cinco clientes que sostienen la mayor parte de la venta.",
      href: "/ventas",
      severidad: (ventas.concentracionTop5 ?? 0) >= 35 ? "alto" : "medio",
      prioridad: 78,
    },
    {
      id: "producto",
      agente: "Agente de producto",
      titulo: "Lista y venta neta no son lo mismo",
      metrica: `${absPct(ventas.brechaPct).toFixed(1)}% de brecha`,
      evidencia: principalProducto
        ? `${principalProducto.etiqueta} lidera valor de lista; esa capa no prueba venta neta ni margen.`
        : "No hay líneas de producto suficientes.",
      accion: "Separar descuento, IVA y costo antes de usar la brecha como margen.",
      href: "/ventas",
      severidad: absPct(ventas.brechaPct) >= 20 ? "alto" : "medio",
      prioridad: 72,
    },
    {
      id: "vendedor",
      agente: "Agente de cobertura",
      titulo: "Vendedor no preservado",
      metrica: ventas.vendedorDisponible ? "Disponible" : "Bloqueado",
      evidencia: ventas.vendedorDisponible
        ? "La dimensión vendedor está disponible para este corte."
        : "La fuente contiene vendedor, pero la copia analítica no lo conserva todavía.",
      accion: "No publicar rankings, metas ni comisiones por vendedor hasta importar esa relación.",
      href: "/datos",
      severidad: ventas.vendedorDisponible ? "medio" : "alto",
      prioridad: ventas.vendedorDisponible ? 25 : 68,
    },
  ];

  return {
    ventaAuditoria: VENTA_AUDITORIA_REFERENCIA,
    diferenciaAuditoria,
    ticketPromedio,
    problemas: problemas.sort((a, b) => b.prioridad - a.prioridad).slice(0, 5),
  };
}
