import { calcularAging } from "@/lib/calculos";
import type { Dataset, Moneda, TipoCambio } from "@/lib/types";

export interface FilaImpactoEjecutivo {
  id: string;
  nombre: string;
  monto: number;
  participacion: number;
  detalle: string;
}

export interface LecturaEjecutiva {
  oportunidades: FilaImpactoEjecutivo[];
  riesgos: FilaImpactoEjecutivo[];
  totalVencido: number;
  totalMoraCritica: number;
  totalMora180: number;
  totalCarteraClasificable: number;
  sinFechaVencimiento: number;
  comparacionRankingDisponible: false;
}

interface AcumuladoCliente {
  id: string;
  nombre: string;
  monto: number;
  facturas: number;
}

function topCinco(
  acumulados: Map<string, AcumuladoCliente>,
  total: number,
  detalle: (fila: AcumuladoCliente) => string
): FilaImpactoEjecutivo[] {
  return [...acumulados.values()]
    .filter((fila) => fila.monto > 0)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)
    .map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      monto: fila.monto,
      participacion: total > 0 ? (fila.monto / total) * 100 : 0,
      detalle: detalle(fila),
    }));
}

function sumarCliente(
  destino: Map<string, AcumuladoCliente>,
  id: string,
  nombre: string,
  monto: number
) {
  const actual = destino.get(id) ?? { id, nombre, monto: 0, facturas: 0 };
  actual.monto += monto;
  actual.facturas += 1;
  destino.set(id, actual);
}

/**
 * Ranking ejecutivo derivado únicamente de saldos abiertos clasificables.
 * "Oportunidad" significa saldo vencido para trabajar; no estima probabilidad
 * de cobro porque el dataset no contiene promesas, capacidad ni propensión.
 */
export function construirLecturaEjecutiva(
  dataset: Dataset,
  fechaCorte: string
): LecturaEjecutiva {
  const aging = calcularAging(dataset, fechaCorte);
  const nombrePorCliente = new Map(
    dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente])
  );
  const vencidoPorCliente = new Map<string, AcumuladoCliente>();
  const criticoPorCliente = new Map<string, AcumuladoCliente>();
  let totalMora180 = 0;

  for (const fila of aging.clasificadas) {
    if (fila.bucket === "actual") continue;
    const id = fila.factura.id_cliente;
    const nombre = nombrePorCliente.get(id) ?? `Cliente ${id}`;
    sumarCliente(vencidoPorCliente, id, nombre, fila.saldo);
    if (fila.dias > 180) totalMora180 += fila.saldo;
    if (fila.bucket === "90+") {
      sumarCliente(criticoPorCliente, id, nombre, fila.saldo);
    }
  }

  const totalVencido = [...vencidoPorCliente.values()].reduce(
    (suma, fila) => suma + fila.monto,
    0
  );
  const totalMoraCritica = [...criticoPorCliente.values()].reduce(
    (suma, fila) => suma + fila.monto,
    0
  );
  const sinFechaVencimiento = aging.excluidas.filter(
    (fila) => fila.motivo === "sin_fecha_vencimiento" && fila.saldo > 0
  ).length;

  return {
    oportunidades: topCinco(
      vencidoPorCliente,
      totalVencido,
      (fila) => `${fila.facturas} factura${fila.facturas === 1 ? "" : "s"} vencida${fila.facturas === 1 ? "" : "s"}`
    ),
    riesgos: topCinco(
      criticoPorCliente,
      totalMoraCritica,
      (fila) => `${fila.facturas} factura${fila.facturas === 1 ? "" : "s"} con más de 90 días`
    ),
    totalVencido,
    totalMoraCritica,
    totalMora180: Math.round(totalMora180 * 100) / 100,
    totalCarteraClasificable: aging.totalClasificado,
    sinFechaVencimiento,
    comparacionRankingDisponible: false,
  };
}

const MONTO_GTQ = /\bQ\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)([KkMm])?\b/g;

/** Convierte sólo la presentación de montos declarados como Q en el snapshot. */
export function convertirTextoMonetario(
  texto: string,
  monedaVista: Moneda,
  tipoCambio: TipoCambio | null
): string {
  if (monedaVista !== "USD" || !tipoCambio) return texto;
  return texto.replace(MONTO_GTQ, (_coincidencia, numero: string, sufijo?: string) => {
    const escala =
      sufijo?.toLowerCase() === "m" ? 1_000_000 : sufijo?.toLowerCase() === "k" ? 1_000 : 1;
    const dolares = (Number(numero.replaceAll(",", "")) * escala) / tipoCambio.quetzalesPorDolar;
    return dolares.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      ...(sufijo
        ? { notation: "compact" as const, maximumFractionDigits: 2 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  });
}
