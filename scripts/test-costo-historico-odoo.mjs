#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const resumen = JSON.parse(
  await readFile(path.resolve(process.cwd(), "fixtures", "costo-historico-odoo-resumen.json"), "utf8"),
);

const errores = [];
const asegurar = (condicion, mensaje) => {
  if (!condicion) errores.push(mensaje);
};
const cerca = (a, b, tolerancia = 0.01) => Math.abs(a - b) <= tolerancia;

asegurar(resumen.estado === "parcial-conciliado", "El resumen no debe presentarse como costo real confirmado.");
asegurar(resumen.configuracionOdoo.metodoCostoUnico === "standard", "Odoo dejó de declarar costo standard.");
asegurar(resumen.configuracionOdoo.valoracionUnica === "manual_periodic", "Odoo dejó de declarar valoración manual.");
asegurar(resumen.configuracionOdoo.esCostoRealFifoOAvco === false, "El fixture no puede afirmar FIFO/AVCO.");
asegurar(resumen.controlContableCosto.disponible === false, "Apareció control COGS: revisar el pipeline antes de publicarlo.");
asegurar(resumen.cobertura.movimientosTerminadosSinCapa === 0, "Hay movimientos terminados sin capa de valoración.");
asegurar(cerca(resumen.reconciliacion.diferenciaCantidadEntrega, 0, 0.000001), "Las cantidades sale.order.line ↔ SVL no concilian.");
asegurar(cerca(resumen.reconciliacion.diferenciaValor, 0), "El costo reconstruido no concilia contra SVL.value.");
asegurar(
  cerca(
    resumen.poblacionConciliada.ingresoNetoSinIvaGTQ - resumen.poblacionConciliada.costoHistoricoEstandarGTQ,
    resumen.poblacionConciliada.margenBrutoGTQ,
  ),
  "La resta de ingreso menos costo no coincide con el margen.",
);
asegurar(resumen.poblacionConciliada.coberturaIngresoPct >= 95, "La cobertura de ingreso cayó por debajo de 95%.");
asegurar(resumen.cobertura.lineasConciliadas > 0, "No hay líneas conciliadas.");
asegurar(resumen.cobertura.capasDevolucion > 0, "Las devoluciones desaparecieron del snapshot.");
asegurar(resumen.cobertura.notasCreditoPublicadas > 0, "Las notas de crédito desaparecieron del snapshot.");
asegurar(resumen.universoValoracion.capasSinMovimiento > 0, "Revisar: ya no existen ajustes manuales sin movimiento.");

if (errores.length) {
  console.error("Auditoría de costo histórico: FALLÓ");
  for (const error of errores) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Auditoría de costo histórico: OK");
console.log(`Líneas conciliadas: ${resumen.cobertura.lineasConciliadas}/${resumen.cobertura.lineasActivas}`);
console.log(`Ingreso neto conciliado: Q ${resumen.poblacionConciliada.ingresoNetoSinIvaGTQ.toFixed(2)}`);
console.log(`Costo histórico estándar: Q ${resumen.poblacionConciliada.costoHistoricoEstandarGTQ.toFixed(2)}`);
console.log(`Margen parcial conciliado: ${resumen.poblacionConciliada.margenPct.toFixed(2)}%`);
