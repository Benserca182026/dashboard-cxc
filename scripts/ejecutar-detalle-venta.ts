// Ejecuta la query real (no una version resumida) contra el dataset real de
// Odoo/Supabase para la pagina /ventas/detalle, y vuelca CADA valor
// intermedio -- no solo el KPI final que se ve en pantalla. Mismo patron que
// scripts/ejecutar-cuadro-mando.ts y scripts/ejecutar-aging.ts. Se corre con:
//   npx tsx --env-file=.env.local scripts/ejecutar-detalle-venta.ts
import { cargarDatasetReal } from "../lib/datosReales";
import { leerVentasReales, detalleVenta } from "../lib/lecturas-ventas-reales";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(4)}%`;

async function main() {
  const dataset = await cargarDatasetReal();

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente}`);
  console.log(`ventas totales: ${(dataset.ventas ?? []).length} · ventaLineas: ${(dataset.ventaLineas ?? []).length} · productos: ${(dataset.productos ?? []).length} · clientes: ${dataset.clientes.length}`);
  console.log("=".repeat(78));

  const lectura = leerVentasReales(dataset);
  console.log(`\n### leerVentasReales() -- CADA PASO ###\n`);
  console.log(`lectura.ventas.length (confirmadas, estado_odoo=sale) = ${lectura.ventas.length}`);
  console.log(`lectura.desde = ${lectura.desde} · lectura.hasta = ${lectura.hasta}`);
  console.log(`lectura.clientes.length (clientes con >=1 pedido confirmado) = ${lectura.clientes.length}`);

  const pedidos = lectura.ventas.slice(-10).reverse();
  console.log(`\nUltimos 10 pedidos confirmados (los que lista la pagina), del mas reciente al mas viejo:`);
  pedidos.forEach((v) => console.log(`  ${v.id_venta} · ${v.fecha_venta} · cliente=${v.id_cliente} · total_referencia=${fmt(v.total_referencia?.valorParaMostrar() ?? 0)} · moneda=${v.moneda_id ?? "GTQ"}`));

  for (const venta of pedidos) {
    console.log("\n" + "-".repeat(78));
    console.log(`PEDIDO ${venta.id_venta} · ${venta.fecha_venta}`);
    console.log("-".repeat(78));

    const detalle = detalleVenta(dataset, venta.id_venta);
    const lineas = detalle?.lineas ?? [];
    const composicion = detalle?.composicion ?? 0;
    const clienteNombre = detalle?.cliente ?? venta.id_cliente;
    const totalConfirmado = venta.total_referencia?.valorParaMostrar() ?? 0;

    console.log(`cliente: ${clienteNombre} (${venta.id_cliente})`);
    console.log(`totalConfirmado (Detecta) = ${fmt(totalConfirmado)}`);
    console.log(`composicion a precio de lista (Prioriza) = ${fmt(composicion)}`);
    console.log(`diferencia (composicion - totalConfirmado) = ${fmt(composicion - totalConfirmado)}`);

    console.log(`\nlineas resueltas a producto (Explica), ${lineas.length} lineas:`);
    const ordenadas = [...lineas].sort((a, b) => b.valor - a.valor);
    for (const item of ordenadas) {
      const pctLinea = composicion > 0 ? (item.valor / composicion) * 100 : 0;
      console.log(`  ${item.producto.sku} · ${item.producto.nombre_producto} · cant=${item.linea.cantidad} · valor=${fmt(item.valor)} · ${pct(pctLinea)} de la composicion`);
    }
    const lineasCrudas = (dataset.ventaLineas ?? []).filter((l) => l.id_venta === venta.id_venta).length;
    console.log(`lineasCrudas (sin filtrar por producto encontrado) = ${lineasCrudas} · lineasResueltas = ${lineas.length} · sinProducto = ${Math.max(lineasCrudas - lineas.length, 0)}`);
    const liderLinea = ordenadas[0];
    if (liderLinea) {
      const pctLider = composicion > 0 ? (liderLinea.valor / composicion) * 100 : 0;
      console.log(`SKU LIDER de este pedido: ${liderLinea.producto.sku} · ${liderLinea.producto.nombre_producto} · ${fmt(liderLinea.valor)} · ${pct(pctLider)} de la composicion del pedido`);
    }

    const clienteFila = lectura.clientes.find((f) => f.id === venta.id_cliente) ?? null;
    console.log(`\nhistorial del cliente (Recomienda):`);
    if (clienteFila) {
      const pesoDelPedido = clienteFila.valor > 0 ? (totalConfirmado / clienteFila.valor) * 100 : 0;
      const vsTicketInclSelf = clienteFila.ticket > 0 ? ((totalConfirmado - clienteFila.ticket) / clienteFila.ticket) * 100 : null;
      const otrosPedidos = clienteFila.pedidos - 1;
      const ticketOtros = otrosPedidos > 0 ? (clienteFila.valor - totalConfirmado) / otrosPedidos : null;
      const vsTicketOtros = ticketOtros && ticketOtros > 0 ? ((totalConfirmado - ticketOtros) / ticketOtros) * 100 : null;
      console.log(`  clienteFila.valor (acumulado historico, INCLUYE este pedido) = ${fmt(clienteFila.valor)}`);
      console.log(`  clienteFila.pedidos (cantidad historica, INCLUYE este pedido) = ${clienteFila.pedidos}`);
      console.log(`  clienteFila.ticket (promedio historico, INCLUYE este pedido -- sesgado) = ${fmt(clienteFila.ticket)}`);
      console.log(`  clienteFila.primera = ${clienteFila.primera} · clienteFila.ultima = ${clienteFila.ultima}`);
      console.log(`  pesoDelPedido (KPI VIEJO) = totalConfirmado/clienteFila.valor*100 = ${pct(pesoDelPedido)}`);
      console.log(`  vs. ticket promedio INCLUYENDO este pedido (sesgado) = ${vsTicketInclSelf === null ? "sin ticket previo" : (vsTicketInclSelf >= 0 ? "+" : "") + vsTicketInclSelf.toFixed(2) + "%"}`);
      console.log(`  ticket promedio de los OTROS ${otrosPedidos} pedido(s) (excluye este) = ${ticketOtros === null ? "sin otros pedidos" : fmt(ticketOtros)}`);
      console.log(`  vs. ticket promedio de OTROS pedidos (KPI NUEVO propuesto) = ${vsTicketOtros === null ? "sin base de comparacion (unico pedido del cliente)" : (vsTicketOtros >= 0 ? "+" : "") + vsTicketOtros.toFixed(2) + "%"}`);

      // Recencia: dias desde el pedido anterior de este mismo cliente.
      const historialCliente = lectura.ventas.filter((v) => v.id_cliente === venta.id_cliente).sort((a, b) => a.fecha_venta.localeCompare(b.fecha_venta));
      const idx = historialCliente.findIndex((v) => v.id_venta === venta.id_venta);
      const anterior = idx > 0 ? historialCliente[idx - 1] : null;
      if (anterior) {
        const dias = Math.round((new Date(venta.fecha_venta).getTime() - new Date(anterior.fecha_venta).getTime()) / 86400000);
        console.log(`  pedido anterior del cliente: ${anterior.id_venta} (${anterior.fecha_venta}) -> ${dias} dias antes de este`);
      } else {
        console.log(`  este es el PRIMER pedido confirmado del cliente en el dataset`);
      }
    } else {
      console.log(`  sin fila de historial (no debería pasar para un pedido confirmado)`);
    }
  }

  // ── Chequeo: velocidad de cobro por id_factura, y si hay mas de un corte ──
  console.log("\n" + "=".repeat(78));
  console.log("CHEQUEOS DE ALCANCE (para no proponer cruces invalidos)");
  console.log("=".repeat(78));
  const facturasConIdVenta = dataset.facturas.filter((f: any) => f.id_venta).length;
  console.log(`facturas con id_venta poblado (vinculo factura<->pedido) = ${facturasConIdVenta} de ${dataset.facturas.length}`);
  const pagosConIdFactura = dataset.pagos.filter((p: any) => p.id_factura).length;
  console.log(`pagos con id_factura poblado = ${pagosConIdFactura} de ${dataset.pagos.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
