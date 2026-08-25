import type { Dataset } from "@/lib/types";

export interface ErrorCalidad {
  id: string;
  nombre: string;
  cantidad: number;
  afecta: string[];
  aclaracion: string;
}

export interface ConciliacionDato {
  id: string;
  nombre: string;
  valor: string;
  estado: "confirmado" | "parcial" | "sin-dato";
  detalle: string;
}

export interface AnalisisCalidadDataset {
  totalFacturas: number;
  facturasSinProblemaDetectado: number;
  pctSinProblemaDetectado: number | null;
  errores: ErrorCalidad[];
  conciliaciones: ConciliacionDato[];
  ultimaFechaObservable: string | null;
  modulosAfectados: { modulo: string; causas: string[] }[];
}

function fechaValida(fecha: string | null | undefined): boolean {
  return Boolean(fecha && !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)));
}

/**
 * Controles estructurales sobre el Dataset cargado. No equivalen a una
 * auditoría contable ni a una prueba de exactitud contra Odoo.
 */
export function analizarCalidadDataset(dataset: Dataset): AnalisisCalidadDataset {
  const idsCliente = new Set(dataset.clientes.map((cliente) => cliente.id_cliente));
  const idsConFactura = new Set<string>();
  const facturasConProblema = new Set<string>();

  let sinVencimiento = 0;
  let emisionInvalida = 0;
  let montoNoPositivo = 0;
  let clienteInexistente = 0;
  let duplicadas = 0;
  const llavesFactura = new Set<string>();

  for (const factura of dataset.facturas) {
    idsConFactura.add(factura.id_cliente);
    if (!factura.fecha_vencimiento) {
      sinVencimiento += 1;
      facturasConProblema.add(factura.id_factura);
    }
    if (!fechaValida(factura.fecha_emision) || factura.fecha_emision === "1970-01-01") {
      emisionInvalida += 1;
      facturasConProblema.add(factura.id_factura);
    }
    if (!(factura.monto_original > 0)) {
      montoNoPositivo += 1;
      facturasConProblema.add(factura.id_factura);
    }
    if (!idsCliente.has(factura.id_cliente)) {
      clienteInexistente += 1;
      facturasConProblema.add(factura.id_factura);
    }
    const numeroNormalizado = factura.numero_factura.trim().toLocaleLowerCase("es-GT");
    if (numeroNormalizado) {
      const llave = `${factura.id_cliente}\u0000${numeroNormalizado}`;
      if (llavesFactura.has(llave)) {
        duplicadas += 1;
        facturasConProblema.add(factura.id_factura);
      } else {
        llavesFactura.add(llave);
      }
    }
  }

  const clientesSinFactura = dataset.clientes.filter(
    (cliente) => !idsConFactura.has(cliente.id_cliente)
  ).length;

  const errores: ErrorCalidad[] = [
    {
      id: "vencimiento",
      nombre: "Facturas sin vencimiento",
      cantidad: sinVencimiento,
      afecta: ["Aging", "Prioritarios", "Forecast de cobro"],
      aclaracion: "Quedan fuera de la clasificación por antigüedad; no se les inventa una fecha.",
    },
    {
      id: "emision",
      nombre: "Fecha de emisión inválida",
      cantidad: emisionInvalida,
      afecta: ["Ventas por período", "Forecast"],
      aclaracion: "Impide asignar el hecho a un período confiable.",
    },
    {
      id: "duplicado",
      nombre: "Número repetido por cliente",
      cantidad: duplicadas,
      afecta: ["Cartera", "Aging", "Forecast"],
      aclaracion: "Es una señal de duplicidad; no confirma por sí sola una doble contabilización.",
    },
    {
      id: "monto",
      nombre: "Monto no positivo",
      cantidad: montoNoPositivo,
      afecta: ["Cartera", "Ventas"],
      aclaracion: "Requiere clasificar nota, reverso o error antes de agregarlo.",
    },
    {
      id: "cliente",
      nombre: "Factura sin cliente de catálogo",
      cantidad: clienteInexistente,
      afecta: ["Todos los rankings por cliente"],
      aclaracion: "El documento no puede atribuirse a una entidad del catálogo cargado.",
    },
    {
      id: "catalogo",
      nombre: "Clientes sin factura",
      cantidad: clientesSinFactura,
      afecta: ["Cobertura de catálogo"],
      aclaracion: "Puede ser legítimo; se reporta como cobertura, no como error contable.",
    },
  ].sort((a, b) => b.cantidad - a.cantidad);

  const fechas = dataset.facturas
    .map((factura) => factura.fecha_emision)
    .filter((fecha) => fechaValida(fecha) && fecha !== "1970-01-01")
    .sort();
  const ultimaFechaObservable = fechas.at(-1) ?? null;
  const totalFacturas = dataset.facturas.length;
  const facturasSinProblemaDetectado = Math.max(0, totalFacturas - facturasConProblema.size);

  const conciliaciones: ConciliacionDato[] = [
    {
      id: "factura-cliente",
      nombre: "Factura ↔ cliente",
      valor: `${totalFacturas - clienteInexistente} de ${totalFacturas}`,
      estado: clienteInexistente === 0 ? "confirmado" : "parcial",
      detalle: "Comprueba que cada id_cliente de factura exista en el catálogo cargado.",
    },
    dataset.ventas && dataset.ventas.length > 0
      ? {
          id: "venta-factura",
          nombre: "Factura ↔ venta",
          valor: `${dataset.facturas.filter((factura) => Boolean(factura.id_venta)).length} de ${totalFacturas}`,
          estado: dataset.facturas.every((factura) => Boolean(factura.id_venta)) ? "confirmado" : "parcial",
          detalle: "Comprueba disponibilidad del vínculo; no reconcilia monto vendido contra facturado.",
        }
      : {
          id: "venta-factura",
          nombre: "Factura ↔ venta",
          valor: "Sin dato",
          estado: "sin-dato",
          detalle: "La fuente cargada no contiene ventas para comprobar el vínculo.",
        },
    {
      id: "contabilidad",
      nombre: "Saldo ↔ mayor contable",
      valor: "Sin dato",
      estado: "sin-dato",
      detalle: "El Dataset no contiene el mayor contable ni un control externo de cierre.",
    },
  ];

  const causasPorModulo = new Map<string, string[]>();
  for (const error of errores.filter((fila) => fila.cantidad > 0)) {
    for (const modulo of error.afecta) {
      const causas = causasPorModulo.get(modulo) ?? [];
      causas.push(`${error.nombre} (${error.cantidad})`);
      causasPorModulo.set(modulo, causas);
    }
  }

  if (dataset.fuente === "odoo-real" && dataset.disputas.length === 0) {
    causasPorModulo.set("Agentes de disputa", ["La fuente de disputas no existe en el origen actual"]);
  }

  return {
    totalFacturas,
    facturasSinProblemaDetectado,
    pctSinProblemaDetectado:
      totalFacturas > 0 ? (facturasSinProblemaDetectado / totalFacturas) * 100 : null,
    errores,
    conciliaciones,
    ultimaFechaObservable,
    modulosAfectados: [...causasPorModulo.entries()].map(([modulo, causas]) => ({ modulo, causas })),
  };
}
