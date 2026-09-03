import { detalleVenta, leerVentasReales } from "@/lib/lecturas-ventas-reales";
import { repartir, pctB18, type CategoriaB18, type ContratoB18 } from "@/lib/contrato-b18";
import type { Dataset } from "@/lib/types";

/**
 * DETALLE DE VENTA — un pedido a la vez, sobre el molde B18.
 *
 * Esta página no tiene "categorías temáticas" como Familias o Modelo: tiene UN
 * PEDIDO mirado desde cuatro ángulos fijos. El riel del molde se reutiliza acá
 * para elegir QUÉ PEDIDO se está mirando — cada botón del riel es un pedido
 * confirmado, no un dominio. Con eso se pierde el selector libre de "cualquier
 * pedido" que tenía la versión anterior (con 60 opciones en un <select>): sólo
 * se listan los últimos pedidos confirmados. Es un trade-off aceptable del
 * formato nuevo.
 *
 * Las cuatro tarjetas fijas (Detecta/Explica/Prioriza/Recomienda) son los
 * cuatro ángulos de lectura de ESE pedido, trasladados 1:1 desde los cuatro
 * "agentes" que ya existían en la versión anterior de esta página:
 *   Detecta    → Pedido       (total confirmado en Odoo)
 *   Explica    → Productos    (líneas / SKU del pedido)
 *   Prioriza   → Composición  (Σ cantidad × precio_unitario, a precio de lista)
 *   Recomienda → Historial    (contexto comercial del cliente)
 *
 * REGLA DE HONESTIDAD QUE SE PRESERVA: `venta.total_referencia` (con IVA y
 * descuento) y la composición de líneas (`cantidad × precio_unitario`, sin
 * IVA ni descuento) son DOS MAGNITUDES DISTINTAS. Nunca se suman ni se
 * presentan como si fueran la misma cifra — se muestran en tarjetas y
 * metadatos separados, cada una rotulada con su propia capa.
 *
 * Nada de acá inventa un número: todo sale de `leerVentasReales` y
 * `detalleVenta`, que ya estaban probadas y en uso por la versión anterior.
 */

const clamp = (valor: number) => Math.min(Math.max(Number.isFinite(valor) ? valor : 0, 0), 100);
const num = (valor: number) => valor.toLocaleString("es-GT");
const firmado = (valor: number) => `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}%`;

export function construirDetalleVentaB18(dataset: Dataset, fmt: (monto: number) => string): ContratoB18 {
  const lectura = leerVentasReales(dataset);
  const fuenteTexto = dataset.fuente === "odoo-real" ? "Odoo → Supabase (snapshot)" : "Demo ficticio";
  const pedidos = lectura.ventas.slice(-10).reverse();

  const categorias: CategoriaB18[] = pedidos.map((venta) => {
    const detalle = detalleVenta(dataset, venta.id_venta);
    const lineas = detalle?.lineas ?? [];
    const composicion = detalle?.composicion ?? 0;
    const clienteNombre = detalle?.cliente ?? venta.id_cliente;
    const clienteFila = lectura.clientes.find((fila) => fila.id === venta.id_cliente) ?? null;

    const lineasCrudas = (dataset.ventaLineas ?? []).filter((linea) => linea.id_venta === venta.id_venta).length;
    const lineasResueltas = lineas.length;
    const lineasSinProducto = Math.max(lineasCrudas - lineasResueltas, 0);
    const cobertura = lineasCrudas > 0 ? clamp((lineasResueltas / lineasCrudas) * 100) : 0;

    const totalConfirmado = venta.total_referencia?.valorParaMostrar() ?? 0;

    const filas = repartir(
      lineas.map((item) => ({
        nombre: `${item.producto.sku} · ${item.producto.nombre_producto}`,
        valor: item.valor,
        valorTexto: fmt(item.valor),
      }))
    );

    // "Vs. ticket promedio" se calcula contra los OTROS pedidos del cliente,
    // no contra el promedio de TODOS sus pedidos: `clienteFila.ticket` incluye
    // este mismo pedido en su propio promedio, lo que sesga la comparación
    // hacia 0 (más fuerte cuanto menos historial tiene el cliente — verificado
    // con query real: para un cliente con solo 4 pedidos, el sesgo cambia el
    // resultado de -33.12% a -39.77%). Restar este pedido del acumulado antes
    // de promediar da la comparación honesta: "¿este pedido es distinto de lo
    // que este cliente pide normalmente, sin contar este pedido?"
    const otrosPedidosCliente = clienteFila ? clienteFila.pedidos - 1 : 0;
    const ticketOtrosPedidos = clienteFila && otrosPedidosCliente > 0
      ? (clienteFila.valor - totalConfirmado) / otrosPedidosCliente
      : null;
    const vsTicketOtrosPedidos = ticketOtrosPedidos && ticketOtrosPedidos > 0
      ? ((totalConfirmado - ticketOtrosPedidos) / ticketOtrosPedidos) * 100
      : null;
    // Recencia: días desde el pedido confirmado inmediatamente anterior de
    // este mismo cliente (0 si puso más de un pedido el mismo día). `null`
    // cuando este es el primer pedido confirmado del cliente en el dataset.
    const historialCliente = lectura.ventas.filter((v) => v.id_cliente === venta.id_cliente);
    const idxEnHistorial = historialCliente.findIndex((v) => v.id_venta === venta.id_venta);
    const pedidoAnterior = idxEnHistorial > 0 ? historialCliente[idxEnHistorial - 1] : null;
    const diasDesdePedidoAnterior = pedidoAnterior
      ? Math.round((new Date(venta.fecha_venta).getTime() - new Date(pedidoAnterior.fecha_venta).getTime()) / 86400000)
      : null;

    const problema = lineasSinProducto > 0
      ? `${num(lineasSinProducto)} de ${num(lineasCrudas)} línea(s) de este pedido no resolvieron a un producto del catálogo y quedan fuera de la composición.`
      : lineasCrudas > 0
        ? "Todas las líneas de este pedido resolvieron a un producto del catálogo."
        : "Este pedido no tiene líneas registradas.";

    const sigla = venta.id_venta.slice(-2).toUpperCase();

    const categoria: CategoriaB18 = {
      id: venta.id_venta,
      sigla,
      nombre: `${venta.id_venta} · ${venta.fecha_venta}`,
      senal: `${venta.fecha_venta} · ${clienteNombre}`,
      pregunta: "¿Qué compró este pedido y quién lo hizo?",
      filas,
      cobertura,
      coberturaEtiqueta: "de las líneas del pedido resolvió a un producto del catálogo",
      metricas: [
        { valor: fmt(totalConfirmado), etiqueta: "total confirmado Odoo" },
        { valor: fmt(composicion), etiqueta: "composición a precio de lista" },
        { valor: num(clienteFila?.pedidos ?? 0), etiqueta: "pedidos históricos del cliente" },
      ],
      problema,
      tarjetas: [
        {
          id: "detecta",
          grafica: "dona",
          donaPct: cobertura,
          kpiTexto: fmt(totalConfirmado),
          etiqueta: "total confirmado Odoo",
          resumen: `Pedido ${venta.id_venta} del ${venta.fecha_venta}, cliente ${clienteNombre}.`,
          problema: "El total confirmado del pedido incluye IVA y descuento; no se compone sumando las líneas.",
          accion: "Confirmar este total contra Odoo antes de usarlo en cualquier reporte agregado.",
        },
        {
          id: "explica",
          grafica: "barras",
          // KPI viejo: conteo suelto de líneas ("5 líneas") -- no dice si el
          // pedido está concentrado en un SKU o repartido entre muchos. El
          // % del SKU líder (ya calculado en `filas[0]`, repartir() ordena
          // desc por pct) responde eso de un vistazo: p. ej. WALMART
          // VTA-S03700 tiene 43.51% en un solo SKU (riesgo de quiebre de
          // stock si ese producto falla) mientras CEMACO VTA-S03694, con
          // 28 líneas, tiene apenas 14.99% en su líder (pedido diversificado).
          kpiTexto: lineasResueltas > 0 ? pctB18(filas[0]?.pct ?? 0) : "Sin dato",
          etiqueta: "del pedido en un solo SKU",
          resumen: lineasResueltas > 0
            ? `${filas[0]?.nombre ?? "sin señal"} explica ${pctB18(filas[0]?.pct ?? 0)} del pedido, entre ${num(lineasResueltas)} línea${lineasResueltas === 1 ? "" : "s"} en total.`
            : "Este pedido no tiene líneas con producto identificado.",
          problema: lineasSinProducto > 0
            ? `${num(lineasSinProducto)} línea(s) no resolvieron a un producto del catálogo.`
            : "Todas las líneas resolvieron a un producto del catálogo.",
          accion: "Revisar cada SKU contra el catálogo antes de comprometer reposición o despacho.",
        },
        {
          id: "prioriza",
          grafica: "pareto",
          kpiTexto: fmt(composicion),
          etiqueta: "composición a precio de lista",
          resumen: "Σ cantidad × precio unitario de las líneas, sin IVA ni descuento.",
          problema: "Esta suma no es el total vendido: no trae el descuento ni el impuesto que sí tiene el total confirmado.",
          accion: "Usar esta cifra sólo para leer mezcla de producto, nunca como el monto cobrado al cliente.",
        },
        {
          id: "recomienda",
          // KPI viejo: "% del historial acumulado del cliente" -- para un
          // cliente con 146 pedidos (WALMART) cualquier pedido individual da
          // ~0.8%, sin importar si fue grande o chico para ESE cliente: el
          // número se achica solo con la antigüedad de la cuenta, no dice
          // nada del pedido de hoy. La comparación contra el ticket promedio
          // de sus OTROS pedidos sí es comparable entre un cliente nuevo y
          // uno de siempre, y es la pregunta que un vendedor realmente hace:
          // "¿este pedido es más grande o más chico de lo normal para este
          // cliente?". Sin `donaPct` propio (como Explica/Prioriza): la dona
          // cae a `categoria.cobertura` (B18-1), no a un valor sin relación.
          grafica: "barras",
          kpiTexto: vsTicketOtrosPedidos !== null ? firmado(vsTicketOtrosPedidos) : "Sin dato",
          etiqueta: vsTicketOtrosPedidos !== null ? "vs. su ticket promedio histórico" : "sin pedidos previos para comparar",
          resumen: clienteFila
            ? `${clienteNombre} acumula ${fmt(clienteFila.valor)} en ${num(clienteFila.pedidos)} pedidos confirmados` +
              (ticketOtrosPedidos !== null ? ` (ticket promedio de los otros ${num(otrosPedidosCliente)}: ${fmt(ticketOtrosPedidos)}).` : ".") +
              (diasDesdePedidoAnterior !== null
                ? ` Su pedido anterior fue hace ${num(diasDesdePedidoAnterior)} día${diasDesdePedidoAnterior === 1 ? "" : "s"}.`
                : " Es el primer pedido confirmado de este cliente en el dataset.")
            : `${clienteNombre} no tiene historial acumulado disponible.`,
          problema: vsTicketOtrosPedidos === null
            ? "Este es el único pedido confirmado de este cliente en el dataset: no hay ticket promedio previo con el que compararlo."
            : vsTicketOtrosPedidos >= 0
              ? `Este pedido quedó ${firmado(vsTicketOtrosPedidos)} sobre el ticket promedio de los otros pedidos de este cliente.`
              : `Este pedido quedó ${firmado(vsTicketOtrosPedidos)} bajo el ticket promedio de los otros pedidos de este cliente.`,
          accion: vsTicketOtrosPedidos === null
            ? "No hay pedidos previos de este cliente con qué comparar: tratar este pedido como línea base."
            : vsTicketOtrosPedidos >= 0
              ? "Aprovechar la conversación: el pedido superó el promedio histórico de este cliente."
              : "Indagar por qué el pedido quedó bajo el promedio histórico antes de cerrar el ciclo de venta.",
        },
      ],
      // Pareto: qué SKU explica la mayor parte de la composición del pedido.
      forma: "pareto",
      metadatos: [
        { termino: "Fuente", valor: `${fuenteTexto} · pedido ${venta.id_venta}` },
        { termino: "Capa", valor: "Total confirmado de pedido (IVA y descuento incluidos) vs. composición de líneas a precio de lista — magnitudes distintas, nunca se suman" },
        { termino: "Corte", valor: venta.fecha_venta },
        { termino: "Moneda", valor: venta.moneda_id && venta.moneda_id !== "GTQ" ? `${venta.moneda_id} — distinta de la moneda de registro` : "Quetzal — moneda de registro" },
        { termino: "Cobertura", valor: pctB18(cobertura) },
        { termino: "Límite", valor: "Líneas sin producto encontrado en el catálogo se excluyen de la composición; no se estiman" },
      ],
    };
    return categoria;
  });

  const totalConfirmadoListado = pedidos.reduce((suma, venta) => suma + (venta.total_referencia?.valorParaMostrar() ?? 0), 0);
  // La composición agregada se recalcula desde `detalleVenta` (no desde las
  // filas ya repartidas en porcentaje) para no perder la unidad monetaria.
  const composicionAgregada = pedidos.reduce((suma, venta) => suma + (detalleVenta(dataset, venta.id_venta)?.composicion ?? 0), 0);
  const coberturaPromedio = categorias.length > 0
    ? clamp(categorias.reduce((suma, cat) => suma + cat.cobertura, 0) / categorias.length)
    : 0;

  return {
    eyebrow: "VENTAS · DETALLE DE PEDIDO",
    titulo: "Detalle de venta",
    rotuloRiel: "Pedidos",
    // B18-16: "Corte: 2026-08-19" a secas es ambiguo -- Cuadro de mando/Aging/
    // Prioritarios muestran ahí `FECHA_CORTE_DATOS_REALES` (fecha en que se
    // extrajo el snapshot de Odoo), mientras que acá `lectura.hasta` es la
    // fecha del ÚLTIMO PEDIDO CONFIRMADO real -- un concepto legítimamente
    // distinto, pero indistinguible con el mismo rótulo "Corte:" pelado.
    corte: lectura.hasta ? `última venta confirmada — ${lectura.hasta}` : "sin pedidos confirmados",
    categorias,
    resumen: {
      subtitulo: `Últimos ${categorias.length} pedidos confirmados`,
      kpis: [
        { etiqueta: "Pedidos listados", valor: num(categorias.length), nota: "de los confirmados en Odoo" },
        { etiqueta: "Total confirmado (listado)", valor: fmt(totalConfirmadoListado), nota: "suma de los pedidos listados, con IVA y descuento" },
        { etiqueta: "Composición a precio de lista", valor: fmt(composicionAgregada), nota: "no comparable con el total confirmado" },
        { etiqueta: "Cobertura promedio de líneas", valor: pctB18(coberturaPromedio), nota: "líneas resueltas a producto del catálogo" },
      ],
      tituloMix: "Composición del pedido activo",
      preguntaMix: "¿Qué productos explican este pedido?",
      tituloCobertura: "Calidad de lectura por pedido",
      preguntaCobertura: "¿Cuánto de cada pedido resolvió a un producto del catálogo?",
      notaCobertura: "Cobertura mide líneas resueltas a un producto válido; no mide si el pedido está completo o correcto en Odoo.",
      pie: "El total confirmado del pedido (con IVA y descuento) y la composición de sus líneas a precio de lista son magnitudes distintas: nunca se suman ni se comparan directamente. Sólo se listan los últimos pedidos confirmados, no el histórico completo.",
    },
  };
}
