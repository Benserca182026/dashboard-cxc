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

    const pesoDelPedido = clienteFila && clienteFila.valor > 0 ? clamp((totalConfirmado / clienteFila.valor) * 100) : 0;

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
          kpiTexto: `${num(lineasResueltas)} línea${lineasResueltas === 1 ? "" : "s"}`,
          etiqueta: "SKU en el pedido",
          resumen: lineasResueltas > 0
            ? `Encabeza ${filas[0]?.nombre ?? "sin señal"} con ${pctB18(filas[0]?.pct ?? 0)} del pedido.`
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
          grafica: "cobertura",
          donaPct: pesoDelPedido,
          kpiTexto: clienteFila ? pctB18(pesoDelPedido) : "Sin dato",
          etiqueta: "de su historial acumulado",
          resumen: clienteFila
            ? `${clienteNombre} acumula ${fmt(clienteFila.valor)} en ${num(clienteFila.pedidos)} pedidos confirmados.`
            : `${clienteNombre} no tiene historial acumulado disponible.`,
          problema: "Este contexto ordena la conversación comercial; no autoriza crear un pedido nuevo por sí solo.",
          accion: "Preparar la conversación con el historial del cliente antes de negociar el siguiente pedido.",
        },
      ],
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
    corte: lectura.hasta ?? "sin pedidos confirmados",
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
