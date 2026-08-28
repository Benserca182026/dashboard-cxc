import type { AnaliticaVentas } from "./commercial-operacion";

export type SeveridadAgente = "critico" | "atencion" | "observando" | "estable";
export type ZonaAgente = "ventas" | "clientes" | "productos" | "cartera" | "centro";

export interface AgenteComercial {
  id: string;
  nombre: string;
  abreviatura: string;
  zona: ZonaAgente;
  estado: SeveridadAgente;
  senal: string;
  evidencia: string;
  accion: string;
  href: string;
  prioridad: number;
}

export interface ContextoCarteraPortada {
  vencida: number;
  moraCritica: number;
  porcentajeVencido: number;
}

function numero(n: number) {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(n);
}

/** Agentes visibles: leen comportamiento comercial, nunca calidad interna de datos. */
export function ejecutarAgentesPortada(ventas: AnaliticaVentas, cartera: ContextoCarteraPortada): AgenteComercial[] {
  const variacion = ventas.variacionUltimoPeriodo;
  const cliente = ventas.topClientes[0];
  const producto = ventas.topProductos[0];
  const ticket = ventas.pedidosConReferencia > 0 ? ventas.vendidoOdoo / ventas.pedidosConReferencia : 0;
  const concentracion = ventas.concentracionTop5 ?? 0;
  const brechaLista = Math.abs(ventas.brechaPct ?? 0);

  const agentes: AgenteComercial[] = [
    {
      id: "pulso", nombre: "Pulso de ventas", abreviatura: "PV", zona: "ventas",
      estado: variacion !== null && variacion < -12 ? "critico" : variacion !== null && variacion < 0 ? "atencion" : "estable",
      senal: variacion === null ? "sin comparación" : `${variacion >= 0 ? "+" : ""}${variacion.toFixed(1)}%`,
      evidencia: variacion === null ? "Todavía no hay un período comparable completo." : `El período actual se mueve ${variacion >= 0 ? "por encima" : "por debajo"} del anterior al mismo día de corte.`,
      accion: "Abrir la evolución mensual y localizar el punto de quiebre.", href: "/ventas", prioridad: variacion !== null && variacion < 0 ? 98 : 35,
    },
    {
      id: "ticket", nombre: "Ticket comercial", abreviatura: "TC", zona: "ventas", estado: ticket > 0 ? "observando" : "estable",
      senal: ticket > 0 ? `Q ${numero(ticket)}` : "sin señal",
      evidencia: ticket > 0 ? `El valor medio por pedido confirmado es Q ${numero(ticket)}.` : "No hay pedidos con total confirmado para estimar ticket.",
      accion: "Contrastar cambios de ticket con clientes y productos.", href: "/ventas", prioridad: 44,
    },
    {
      id: "clientes", nombre: "Concentración de clientes", abreviatura: "CL", zona: "clientes",
      estado: concentracion >= 45 ? "critico" : concentracion >= 30 ? "atencion" : "observando", senal: `${concentracion.toFixed(1)}% Top 5`,
      evidencia: cliente ? `${cliente.etiqueta} lidera la venta; los cinco primeros clientes concentran ${concentracion.toFixed(1)}%.` : "No hay clientes suficientes para un ranking.",
      accion: "Revisar dependencia y oportunidades en el resto de la cartera comercial.", href: "/ventas", prioridad: concentracion >= 30 ? 88 : 42,
    },
    {
      id: "cliente-principal", nombre: "Cliente principal", abreviatura: "CP", zona: "clientes",
      estado: cliente && cliente.pct >= 20 ? "atencion" : "observando", senal: cliente ? `${cliente.pct.toFixed(1)}%` : "sin señal",
      evidencia: cliente ? `${cliente.etiqueta} aporta ${cliente.pct.toFixed(1)}% de la venta registrada.` : "No hay señal principal disponible.",
      accion: "Abrir ficha del cliente y revisar frecuencia, mix y tendencia.", href: "/ventas", prioridad: cliente?.pct && cliente.pct >= 20 ? 72 : 30,
    },
    {
      id: "producto", nombre: "Producto líder", abreviatura: "PR", zona: "productos",
      estado: producto && producto.pct >= 18 ? "atencion" : "observando", senal: producto ? `${producto.pct.toFixed(1)}%` : "sin señal",
      evidencia: producto ? `${producto.etiqueta} concentra ${producto.pct.toFixed(1)}% del valor de lista observado.` : "No hay productos suficientes para el ranking.",
      accion: "Ver mezcla de productos y dependencia de la categoría dominante.", href: "/ventas", prioridad: producto?.pct && producto.pct >= 18 ? 70 : 36,
    },
    {
      id: "mix", nombre: "Mezcla comercial", abreviatura: "MX", zona: "productos", estado: brechaLista >= 20 ? "atencion" : "observando", senal: `${brechaLista.toFixed(1)}%`,
      evidencia: `La diferencia entre valor de lista y total registrado es ${brechaLista.toFixed(1)}%; se usa como señal de mezcla, no como margen.`,
      accion: "Examinar categorías que mueven el valor por pedido.", href: "/ventas", prioridad: brechaLista >= 20 ? 64 : 32,
    },
    {
      id: "cartera", nombre: "Cartera en riesgo", abreviatura: "CR", zona: "cartera",
      estado: cartera.porcentajeVencido >= 35 ? "critico" : cartera.porcentajeVencido >= 15 ? "atencion" : "observando", senal: `${cartera.porcentajeVencido.toFixed(1)}%`,
      evidencia: `Q ${numero(cartera.vencida)} permanece vencido dentro de la cartera clasificable.`,
      accion: "Abrir aging y priorizar los clientes con mayor saldo vencido.", href: "/aging", prioridad: cartera.porcentajeVencido >= 15 ? 90 : 38,
    },
    {
      id: "mora", nombre: "Mora crítica", abreviatura: "90+", zona: "cartera", estado: cartera.moraCritica > 0 ? "atencion" : "estable", senal: cartera.moraCritica > 0 ? `Q ${numero(cartera.moraCritica)}` : "sin saldo",
      evidencia: cartera.moraCritica > 0 ? `Q ${numero(cartera.moraCritica)} está en 90+ días y requiere gestión priorizada.` : "No hay saldo crítico en 90+ días para este corte.",
      accion: "Separar acuerdos, disputas y cuentas que necesitan escalamiento.", href: "/aging", prioridad: cartera.moraCritica > 0 ? 84 : 20,
    },
    {
      id: "coordinador", nombre: "Coordinador comercial", abreviatura: "CO", zona: "ventas", estado: "observando", senal: `${ventas.pedidosConReferencia.toLocaleString("es-GT")} pedidos`,
      evidencia: "Conecta ventas, clientes, productos y cartera para priorizar la señal comercial más importante.",
      accion: "Seleccionar un agente para iluminar su módulo y abrir la investigación.", href: "/ventas", prioridad: 100,
    },
  ];

  return agentes.sort((a, b) => b.prioridad - a.prioridad);
}
