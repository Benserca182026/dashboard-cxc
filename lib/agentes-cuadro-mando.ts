import { calcularAging } from "@/lib/calculos";
import { construirLecturaEjecutiva } from "@/lib/commercial-ejecutivo";
import { leerSerieVentas } from "@/lib/lecturas-ventas-reales";
import { repartir, pctB18, type CategoriaB18, type ContratoB18 } from "@/lib/contrato-b18";
import { BUCKETS, type Dataset } from "@/lib/types";

/**
 * CUADRO DE MANDO — cuatro dominios sobre el molde B18.
 *
 * Todo lo que se muestra acá sale de una función de cálculo que ya existía y
 * ya estaba probada: calcularAging, construirLecturaEjecutiva y
 * leerSerieVentas. Este archivo NO calcula nada nuevo: traduce esas lecturas
 * al contrato del molde.
 *
 * COBERTURA no significa lo mismo en los cuatro dominios, y por eso cada uno
 * declara su propia `coberturaEtiqueta`. Un solo número llamado "cobertura"
 * para cosas distintas es exactamente el defecto que hace desconfiar de un
 * tablero.
 *
 * LO QUE NO SE MEZCLA: cartera está en saldos de factura y ventas está en
 * total confirmado de pedido. Son dos magnitudes distintas y viven en dominios
 * separados del riel — nunca se suman ni se comparan entre sí.
 */

const ETIQUETA_BUCKET: Record<string, string> = {
  actual: "Al día",
  "1-30": "1 a 30 días",
  "31-60": "31 a 60 días",
  "61-90": "61 a 90 días",
  "90+": "Más de 90 días",
};

const num = (valor: number) => valor.toLocaleString("es-GT");
const seguro = (valor: number) => (Number.isFinite(valor) ? valor : 0);
const clamp = (valor: number) => Math.min(Math.max(seguro(valor), 0), 100);
const firmado = (valor: number) => `${valor >= 0 ? "+" : ""}${valor.toFixed(2)}%`;

export function construirCuadroDeMando(
  dataset: Dataset,
  fechaCorte: string,
  fmt: (monto: number) => string
): ContratoB18 {
  const aging = calcularAging(dataset, fechaCorte);
  const ejecutiva = construirLecturaEjecutiva(dataset, fechaCorte);
  const serie = leerSerieVentas(dataset);

  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;
  const fuenteTexto = dataset.fuente === "odoo-real" ? "Odoo → Supabase (snapshot)" : "Demo ficticio";

  // ── Cálculos compartidos entre dominios ─────────────────────────────────
  // Mismo `dataset` que ya recibe la función: sin cargar nada nuevo, solo
  // cruces adicionales sobre `aging.clasificadas` y `dataset.ventas`.
  const pctVencido = ejecutiva.totalCarteraClasificable > 0
    ? clamp((ejecutiva.totalVencido / ejecutiva.totalCarteraClasificable) * 100) : 0;
  const clientesConVencidoSet = new Set(
    aging.clasificadas.filter((fila) => fila.bucket !== "actual").map((fila) => fila.factura.id_cliente)
  );
  const saldoPorClienteVencido = new Map<string, number>();
  for (const fila of aging.clasificadas) {
    if (fila.bucket === "actual") continue;
    saldoPorClienteVencido.set(
      fila.factura.id_cliente,
      (saldoPorClienteVencido.get(fila.factura.id_cliente) ?? 0) + fila.saldo
    );
  }
  // Cruce Factura x Venta: última compra confirmada por cliente, sobre el
  // corte de VENTAS (no el corte de cartera — son fechas distintas).
  const ventasConfirmadas = (dataset.ventas ?? []).filter((venta) => venta.estado_odoo === "sale");
  const ultimaCompraPorCliente = new Map<string, string>();
  for (const venta of ventasConfirmadas) {
    const anterior = ultimaCompraPorCliente.get(venta.id_cliente);
    if (!anterior || venta.fecha_venta > anterior) ultimaCompraPorCliente.set(venta.id_cliente, venta.fecha_venta);
  }
  const corteVentasParaCruce = serie.corte ?? fechaCorte;
  const hace60DiasVentas = new Date(new Date(corteVentasParaCruce).getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const hace30DiasVentas = new Date(new Date(corteVentasParaCruce).getTime() - 30 * 86400000).toISOString().slice(0, 10);

  // ── CA · Cartera ─────────────────────────────────────────────────────────
  // Cobertura = cuánto de la deuda abierta tiene fecha de vencimiento y por lo
  // tanto puede clasificarse. Lo que no la tiene NO se le inventa una fecha.
  const filasCartera = repartir(
    BUCKETS.map((bucket) => ({
      nombre: ETIQUETA_BUCKET[bucket] ?? bucket,
      valor: aging.totalesPorBucket[bucket],
      valorTexto: fmt(aging.totalesPorBucket[bucket]),
    }))
  );
  const bucketLider = filasCartera[0];
  const coberturaCartera = carteraTotal > 0 ? clamp((aging.totalClasificado / carteraTotal) * 100) : 0;
  const facturasVencidas = aging.clasificadas.filter((fila) => fila.bucket !== "actual").length;
  // Bucket líder por MONTO — mismo criterio que ya usa Detecta, pero
  // conservando la clave cruda del bucket (no la etiqueta traducida) para
  // poder cruzarlo contra `aging.clasificadas` en Explica y Recomienda.
  const bucketLiderKey = [...BUCKETS].sort(
    (a, b) => aging.totalesPorBucket[b] - aging.totalesPorBucket[a]
  )[0];
  const clientesDistintosBucketLider = new Set(
    aging.clasificadas.filter((fila) => fila.bucket === bucketLiderKey).map((fila) => fila.factura.id_cliente)
  ).size;
  const ticketPromedioPorBucket = new Map<string, { suma: number; cantidad: number }>();
  for (const fila of aging.clasificadas) {
    const previo = ticketPromedioPorBucket.get(fila.bucket) ?? { suma: 0, cantidad: 0 };
    previo.suma += fila.saldo;
    previo.cantidad += 1;
    ticketPromedioPorBucket.set(fila.bucket, previo);
  }
  const ticketPromedio = (bucket: string) => {
    const datos = ticketPromedioPorBucket.get(bucket);
    return datos && datos.cantidad > 0 ? datos.suma / datos.cantidad : 0;
  };
  const ticketPromedioBucketLider = ticketPromedio(bucketLiderKey);
  const ticketPromedio1a30 = ticketPromedio("1-30");
  const pctFacturasVencidas = aging.clasificadas.length > 0
    ? clamp((facturasVencidas / aging.clasificadas.length) * 100) : 0;

  const cartera: CategoriaB18 = {
    id: "cartera",
    sigla: "CA",
    nombre: "Cartera",
    senal: `${bucketLider?.nombre ?? "Sin señal"} · ${pctB18(bucketLider?.pct ?? 0)} de la cartera clasificada`,
    pregunta: "¿Dónde está parada la deuda abierta?",
    filas: filasCartera,
    cobertura: coberturaCartera,
    coberturaEtiqueta: "de la deuda abierta es clasificable por antigüedad",
    metricas: [
      { valor: fmt(aging.totalClasificado), etiqueta: "cartera clasificada" },
      { valor: fmt(aging.saldoNoClasificable), etiqueta: "sin fecha de vencimiento" },
      { valor: num(aging.clasificadas.length), etiqueta: "facturas clasificadas" },
    ],
    problema: aging.saldoNoClasificable > 0
      ? `${fmt(aging.saldoNoClasificable)} de deuda real no entra a ningún tramo porque la factura no trae fecha de vencimiento.`
      : "Toda la deuda abierta tiene fecha de vencimiento y entra a un tramo.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(bucketLider?.pct ?? 0),
        kpiTexto: pctB18(bucketLider?.pct ?? 0), etiqueta: bucketLider?.nombre ?? "Sin señal",
        resumen: `${bucketLider?.valorTexto ?? "sin dato"} concentrados en este tramo.`,
        problema: `${bucketLider?.nombre ?? "Un tramo"} concentra ${pctB18(bucketLider?.pct ?? 0)} de la cartera clasificada.`,
        accion: "Confirmar el tramo líder contra el detalle factura por factura antes de repartir esfuerzo.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: fmt(ticketPromedioBucketLider), etiqueta: "ticket promedio en el tramo líder",
        resumen: `En ${bucketLider?.nombre ?? "el tramo líder"} el ticket promedio es ${fmt(ticketPromedioBucketLider)}, más bajo que ${fmt(ticketPromedio1a30)} en 1 a 30 días: la antigüedad no engorda la factura.`,
        problema: `El tramo líder no es el de facturas más grandes: su ticket promedio (${fmt(ticketPromedioBucketLider)}) es menor que el de 1 a 30 días (${fmt(ticketPromedio1a30)}). Las facturas viejas son más chicas, no más grandes.`,
        accion: "Gestionar cada factura por su monto individual; no asumir que lo más viejo pesa más.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: pctB18(pctFacturasVencidas), etiqueta: "de las facturas está vencida",
        resumen: `${num(facturasVencidas)} de ${num(aging.clasificadas.length)} facturas clasificadas ya vencieron; en dinero el vencido pesa ${pctB18(pctVencido)} de la cartera, un ratio más bajo que en facturas.`,
        problema: `${pctB18(pctFacturasVencidas)} de las facturas está vencida, frente a ${pctB18(pctVencido)} del monto vencido: hay proporcionalmente más facturas atrasadas que dinero atrasado — las facturas vencidas son en promedio más chicas.`,
        accion: "Ordenar la gestión por monto y edad, no por cantidad de facturas.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaCartera,
        kpiTexto: pctB18(coberturaCartera), etiqueta: "cartera clasificable",
        resumen: `${num(ejecutiva.sinFechaVencimiento)} facturas quedaron fuera por falta de fecha. Dato de contexto: el tramo líder (${bucketLider?.nombre ?? "sin dato"}) reúne ${num(clientesDistintosBucketLider)} clientes distintos.`,
        problema: coberturaCartera < 100
          ? `${pctB18(100 - coberturaCartera)} de la deuda no puede clasificarse por antigüedad.`
          : "La cartera está completamente clasificada al corte.",
        accion: "Completar la fecha de vencimiento en el origen; el tablero no la inventa.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · facturas, pagos y notas de crédito` },
      { termino: "Capa", valor: "Saldo abierto de factura, no venta" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaCartera) },
      { termino: "Límite", valor: "Sin fecha de vencimiento no hay tramo: se reporta, no se inventa" },
    ],
  };

  // ── CO · Cobranza ────────────────────────────────────────────────────────
  // Los cuatro tramos NO se solapan: al día, vencido temprano, 90-180 y 180+.
  // Un 90+ que también cuente como 180+ inflaría el reparto y mentiría.
  const mora90a180 = Math.max(ejecutiva.totalMoraCritica - ejecutiva.totalMora180, 0);
  const vencidoTemprano = Math.max(ejecutiva.totalVencido - ejecutiva.totalMoraCritica, 0);
  const alDia = aging.totalesPorBucket.actual;
  const filasCobranza = repartir([
    { nombre: "Al día", valor: alDia, valorTexto: fmt(alDia) },
    { nombre: "Vencido 1 a 90", valor: vencidoTemprano, valorTexto: fmt(vencidoTemprano) },
    { nombre: "Mora 90 a 180", valor: mora90a180, valorTexto: fmt(mora90a180) },
    { nombre: "Mora +180", valor: ejecutiva.totalMora180, valorTexto: fmt(ejecutiva.totalMora180) },
  ]);
  const pctCritica = ejecutiva.totalVencido > 0
    ? clamp((ejecutiva.totalMoraCritica / ejecutiva.totalVencido) * 100) : 0;
  const coberturaCobranza = ejecutiva.totalVencido > 0
    ? clamp((vencidoTemprano / ejecutiva.totalVencido) * 100) : 0;
  const clientesEnMoraCritica = new Set(
    aging.clasificadas.filter((fila) => fila.bucket === "90+").map((fila) => fila.factura.id_cliente)
  );
  const pctClientesEnMoraCritica = clientesConVencidoSet.size > 0
    ? clamp((clientesEnMoraCritica.size / clientesConVencidoSet.size) * 100) : 0;
  const clientesEn90a180 = new Set(
    aging.clasificadas.filter((fila) => fila.bucket === "90+" && fila.dias <= 180).map((fila) => fila.factura.id_cliente)
  ).size;
  // "Vencido que sigue comprando": cruce contra dataset.ventas (estado "sale")
  // sobre el corte de VENTAS — mide actividad reciente, no cartera muerta.
  let clientesVencidosActivos = 0;
  let saldoVencidosActivos = 0;
  for (const id of clientesConVencidoSet) {
    const ultimaCompra = ultimaCompraPorCliente.get(id);
    if (ultimaCompra && ultimaCompra >= hace60DiasVentas) {
      clientesVencidosActivos++;
      saldoVencidosActivos += saldoPorClienteVencido.get(id) ?? 0;
    }
  }
  const pctClientesVencidosActivos = clientesConVencidoSet.size > 0
    ? clamp((clientesVencidosActivos / clientesConVencidoSet.size) * 100) : 0;
  const pctSaldoVencidosActivos = ejecutiva.totalVencido > 0
    ? clamp((saldoVencidosActivos / ejecutiva.totalVencido) * 100) : 0;

  const cobranza: CategoriaB18 = {
    id: "cobranza",
    sigla: "CO",
    nombre: "Cobranza",
    senal: `${pctB18(pctVencido)} de la cartera clasificada está vencida`,
    pregunta: "¿Cuánto de lo vencido todavía se puede trabajar?",
    filas: filasCobranza,
    cobertura: coberturaCobranza,
    coberturaEtiqueta: "del vencido aún no cruzó a mora crítica",
    metricas: [
      { valor: fmt(ejecutiva.totalVencido), etiqueta: "vencido total" },
      { valor: fmt(ejecutiva.totalMoraCritica), etiqueta: "mora crítica 90+" },
      { valor: fmt(ejecutiva.totalMora180), etiqueta: "mora mayor a 180" },
    ],
    problema: `${pctB18(pctCritica)} del vencido ya pasó los 90 días; ${fmt(ejecutiva.totalMora180)} superan los 180. De ese vencido, ${pctB18(pctClientesVencidosActivos)} de los clientes (${fmt(saldoVencidosActivos)}) sigue comprando activamente — no es cartera muerta.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: pctVencido,
        kpiTexto: pctB18(pctVencido), etiqueta: "cartera vencida",
        resumen: `${fmt(ejecutiva.totalVencido)} vencidos sobre ${fmt(ejecutiva.totalCarteraClasificable)} clasificados. En facturas, ${pctB18(pctFacturasVencidas)} de las facturas está vencida.`,
        problema: `${pctB18(pctVencido)} de la cartera clasificada pasó su fecha de pago.`,
        accion: "Asignar responsable y próxima fecha de contacto al vencido, empezando por monto.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18(pctCritica), etiqueta: "del vencido es 90+",
        resumen: `El reparto separa al día, vencido temprano y las dos moras. Por clientes: ${num(clientesEnMoraCritica.size)} de ${num(clientesConVencidoSet.size)} clientes vencidos (${pctB18(pctClientesEnMoraCritica)}) ya tienen una factura en 90+.`,
        problema: `${pctB18(pctCritica)} del vencido está en mora crítica: el tiempo ya jugó en contra.`,
        accion: "Distinguir mora temprana de mora crítica: no se gestionan con el mismo guion.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(clientesEn90a180), etiqueta: "clientes en la ventana 90-180 días",
        resumen: `Representan ${fmt(mora90a180)} en la ventana que todavía responde a gestión.`,
        problema: `${num(clientesEn90a180)} clientes concentran ${fmt(mora90a180)} en la ventana 90-180 días, antes de volverse 180+.`,
        accion: "Trabajar el tramo 90-180 por cliente antes de que cruce; el 180+ ya requiere otra decisión.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: pctClientesVencidosActivos,
        kpiTexto: pctB18(pctClientesVencidosActivos), etiqueta: "clientes vencidos que siguen comprando",
        resumen: `${fmt(saldoVencidosActivos)} de saldo vencido (${pctB18(pctSaldoVencidosActivos)} del vencido total) pertenece a ${num(clientesVencidosActivos)} clientes que compraron en los últimos 60 días respecto al corte de ventas.`,
        problema: "Esto no es cartera muerta: es cliente activo que sigue comprando con saldo vencido sin resolver.",
        accion: "Condicionar el próximo despacho a un acuerdo de pago sobre el saldo vencido de estos clientes.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · aging sobre saldo abierto` },
      { termino: "Capa", valor: "Saldo vencido, no ingreso esperado" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaCobranza) },
      { termino: "Límite", valor: "Sin promesas de pago no hay probabilidad de cobro" },
    ],
  };

  // ── CL · Clientes ────────────────────────────────────────────────────────
  const filasClientes = ejecutiva.oportunidades.map((fila) => ({
    nombre: fila.nombre,
    pct: clamp(fila.participacion),
    valorTexto: fmt(fila.monto),
  }));
  const mayorDeudor = filasClientes[0];
  const concentracionTop5 = clamp(filasClientes.reduce((suma, fila) => suma + fila.pct, 0));
  const clientesConVencido = clientesConVencidoSet.size;
  // Ranking alternativo por CANTIDAD de facturas (no monto) — las barras
  // compartidas del molde siguen siendo por monto; este ranking vive solo en
  // los campos de texto propios de la tarjeta Explica.
  const facturasPorClienteVencido = new Map<string, number>();
  for (const fila of aging.clasificadas) {
    if (fila.bucket === "actual") continue;
    facturasPorClienteVencido.set(
      fila.factura.id_cliente,
      (facturasPorClienteVencido.get(fila.factura.id_cliente) ?? 0) + 1
    );
  }
  const nombrePorIdCliente = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const topPorFacturas = [...facturasPorClienteVencido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const liderPorFacturas = topPorFacturas[0];
  const pctClientesConVencido = dataset.clientes.length > 0
    ? clamp((clientesConVencido / dataset.clientes.length) * 100) : 0;
  const top10Vencido = [...saldoPorClienteVencido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sumaTop10Vencido = top10Vencido.reduce((suma, [, monto]) => suma + monto, 0);
  const concentracionTop10 = ejecutiva.totalVencido > 0
    ? clamp((sumaTop10Vencido / ejecutiva.totalVencido) * 100) : 0;

  const clientes: CategoriaB18 = {
    id: "clientes",
    sigla: "CL",
    nombre: "Clientes",
    senal: `Top 5 concentra ${pctB18(concentracionTop5)} del vencido`,
    pregunta: "¿Quién concentra la deuda vencida?",
    filas: filasClientes,
    cobertura: concentracionTop5,
    coberturaEtiqueta: "del vencido explicado por el Top 5",
    metricas: [
      { valor: num(clientesConVencido), etiqueta: "clientes con vencido" },
      { valor: pctB18(concentracionTop5), etiqueta: "concentración Top 5" },
      { valor: mayorDeudor?.valorTexto ?? "—", etiqueta: "mayor saldo vencido" },
    ],
    problema: `${pctB18(concentracionTop5)} del vencido se explica con sólo ${filasClientes.length} cuentas de ${num(clientesConVencido)}.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(mayorDeudor?.pct ?? 0),
        kpiTexto: pctB18(mayorDeudor?.pct ?? 0), etiqueta: "mayor deudor",
        resumen: `${mayorDeudor?.valorTexto ?? "sin dato"} en una sola cuenta.`,
        problema: `Una cuenta sola concentra ${pctB18(mayorDeudor?.pct ?? 0)} del vencido.`,
        accion: "Tratar la cuenta líder con dueño nombrado, no dentro del lote general.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: num(liderPorFacturas?.[1] ?? 0), etiqueta: "facturas vencidas del líder, no monto",
        resumen: `Por cantidad de facturas, no por saldo: ${topPorFacturas.slice(0, 3).map(([id, n]) => `${nombrePorIdCliente.get(id) ?? id} (${n})`).join(", ")}.`,
        problema: `El ranking por monto esconde carga operativa: ${nombrePorIdCliente.get(liderPorFacturas?.[0] ?? "") ?? "el cliente líder"} tiene ${num(liderPorFacturas?.[1] ?? 0)} facturas vencidas abiertas, aunque no encabece el ranking por saldo.`,
        accion: "Revisar el volumen de facturas por cliente, no solo el saldo, antes de asignar gestión.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: pctB18(pctClientesConVencido), etiqueta: "de la base de clientes tiene algo vencido",
        resumen: `${num(clientesConVencido)} de ${num(dataset.clientes.length)} clientes tienen algo vencido.`,
        problema: `${pctB18(pctClientesConVencido)} de la base de clientes tiene algo vencido; no todas las cuentas pesan igual.`,
        accion: "Trabajar el Pareto antes de repartir esfuerzo sobre toda la cartera.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: concentracionTop5,
        kpiTexto: pctB18(concentracionTop5), etiqueta: "explicado por Top 5",
        resumen: `La concentración indica dónde mirar; no dice que la cuenta sea mala. En Top 10 sube a ${pctB18(concentracionTop10)} del vencido.`,
        problema: "Concentración no es sinónimo de riesgo: puede ser el cliente más grande.",
        accion: "Asignar dueño, fecha y resultado esperado a cada cuenta del Top 5.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · saldo vencido por cliente` },
      { termino: "Capa", valor: "Saldo abierto vencido, no venta del cliente" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(concentracionTop5) },
      { termino: "Límite", valor: "El ranking no estima propensión ni capacidad de pago" },
    ],
  };

  // ── VE · Ventas ──────────────────────────────────────────────────────────
  // Cobertura = parte de los pedidos del período que está registrada en GTQ.
  // Si hay pedidos en otra moneda, la suma NO es un total en quetzales, y eso
  // se dice pegado a la cifra en vez de dejarlo implícito.
  const anios = serie.anios.slice(-4);
  const filasVentas = repartir(
    anios.map((anio) => ({
      nombre: anio.parcial ? `${anio.anio} (parcial)` : anio.anio,
      valor: anio.valor,
      valorTexto: fmt(anio.valor),
    }))
  );
  const anioActual = serie.anios.at(-1) ?? null;
  const pedidosOtraMoneda = anioActual?.pedidosOtraMoneda ?? 0;
  const coberturaVentas = anioActual && anioActual.pedidos > 0
    ? clamp(((anioActual.pedidos - pedidosOtraMoneda) / anioActual.pedidos) * 100) : 0;
  const ytd = serie.ytd;
  const variacion = ytd?.variacionValor ?? null;
  const variacionClientes = ytd?.variacionClientes ?? null;
  const corteVentas = serie.corte ?? "sin ventas confirmadas";
  // Zona de alerta temprana: compró entre 30 y 60 días antes del corte de
  // ventas — ni tan reciente como para estar bien, ni tan viejo como para ya
  // estar en `ytd.actual.porRecuperar` (30+ días).
  let clientesZonaAlertaTemprana = 0;
  for (const [, ultimaCompra] of ultimaCompraPorCliente) {
    if (ultimaCompra < hace30DiasVentas && ultimaCompra >= hace60DiasVentas) clientesZonaAlertaTemprana++;
  }
  const pctZonaAlertaTemprana = ytd && ytd.actual.clientes > 0
    ? clamp((clientesZonaAlertaTemprana / ytd.actual.clientes) * 100) : 0;

  const ventas: CategoriaB18 = {
    id: "ventas",
    sigla: "VE",
    nombre: "Ventas",
    senal: variacion === null
      ? "Sin período comparable equivalente"
      : `${firmado(variacion)} comparable contra la misma ventana`,
    pregunta: "¿La venta confirmada crece contra su propia ventana?",
    filas: filasVentas,
    cobertura: coberturaVentas,
    coberturaEtiqueta: "de los pedidos del año está en quetzales",
    metricas: [
      { valor: ytd ? fmt(ytd.actual.valor) : "—", etiqueta: "venta al corte" },
      { valor: ytd ? num(ytd.actual.pedidos) : "—", etiqueta: "pedidos confirmados" },
      { valor: ytd ? fmt(ytd.actual.ticket) : "—", etiqueta: "ticket promedio" },
    ],
    problema: pedidosOtraMoneda > 0
      ? `${num(pedidosOtraMoneda)} pedido(s) del año están en ${(anioActual?.monedasOtras ?? []).join(", ")} sin convertir: la suma del año no es un total en quetzales.`
      : ytd
        ? `${num(ytd.actual.porRecuperar)} de ${num(ytd.actual.clientes)} compradores del período (${pctB18(clamp((ytd.actual.porRecuperar / ytd.actual.clientes) * 100))}) no compran hace 30 días o más — riesgo de fuga de clientes activo.`
        : "Todos los pedidos del año están registrados en quetzales.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(variacion ?? 0),
        kpiTexto: variacion === null ? "Sin base" : firmado(variacion), etiqueta: "venta comparable",
        resumen: ytd ? `${ytd.dias} días comparados a cada lado.` : "Sin ventana comparable.",
        problema: variacion === null
          ? "No hay una ventana equivalente del año anterior para comparar."
          : `La venta comparable se mueve ${firmado(variacion)} contra los mismos días del año previo.`,
        accion: "Comparar períodos equivalentes; un mes cortado no es un mes cerrado.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: variacionClientes === null ? "Sin base" : firmado(variacionClientes), etiqueta: "compradores vs. comparable",
        resumen: ytd
          ? `${num(ytd.actual.clientes)} compradores en la ventana actual; ${num(ytd.actual.recurrentes)} son recurrentes (${pctB18(clamp((ytd.actual.recurrentes / ytd.actual.clientes) * 100))}) y ${num(ytd.actual.conHistorial)} ya compraban antes del período (${pctB18(clamp((ytd.actual.conHistorial / ytd.actual.clientes) * 100))}).`
          : "Sin comparable.",
        problema: "El crecimiento puede venir de más clientes, más frecuencia o mayor ticket: no son la misma palanca.",
        accion: "Separar clientes, frecuencia y ticket antes de atribuir el crecimiento.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: ytd ? num(ytd.actual.porRecuperar) : "—", etiqueta: "clientes por recuperar (30+ días sin comprar)",
        resumen: ytd
          ? `${pctB18(clamp((ytd.actual.porRecuperar / ytd.actual.clientes) * 100))} de los ${num(ytd.actual.clientes)} compradores del período no vuelve hace 30 días o más.`
          : "Sin período.",
        problema: ytd
          ? `${num(ytd.actual.porRecuperar)} clientes (${pctB18(clamp((ytd.actual.porRecuperar / ytd.actual.clientes) * 100))}) llevan 30 días o más sin comprar: están saliendo de la ventana activa.`
          : "Sin período comparable.",
        accion: "Priorizar contacto comercial en estos clientes antes de perderlos por completo.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: pctZonaAlertaTemprana,
        kpiTexto: num(clientesZonaAlertaTemprana), etiqueta: "clientes en zona de alerta temprana",
        resumen: ytd
          ? `${pctB18(pctZonaAlertaTemprana)} de los ${num(ytd.actual.clientes)} compradores compró hace 30 a 60 días: todavía no entran a "por recuperar", pero ya se están alejando.`
          : "Sin período comparable.",
        problema: `${num(clientesZonaAlertaTemprana)} clientes están en la salida temprana; si no vuelven pronto pasan al grupo de ${ytd ? num(ytd.actual.porRecuperar) : "—"} clientes por recuperar.`,
        accion: "Contactar a estos clientes antes de que crucen a la ventana de 30 días o más sin comprar.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · pedidos confirmados de Odoo` },
      { termino: "Capa", valor: "Total confirmado de pedido, no composición de líneas" },
      { termino: "Corte", valor: corteVentas },
      { termino: "Moneda", valor: pedidosOtraMoneda > 0 ? "MEZCLADA — segmentar antes de sumar" : "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaVentas) },
      { termino: "Límite", valor: "El corte de ventas es el último pedido, no la fecha de corte contable" },
    ],
  };

  return {
    eyebrow: "DIRECCIÓN · LECTURA INTEGRAL",
    titulo: "Cuadro de mando",
    rotuloRiel: "Dominios",
    corte: fechaCorte,
    categorias: [cartera, cobranza, clientes, ventas],
    resumen: {
      subtitulo: "Cartera, cobranza, clientes y ventas",
      kpis: [
        { etiqueta: "Cartera abierta", valor: fmt(carteraTotal), nota: `${pctB18(coberturaCartera)} clasificable` },
        { etiqueta: "Vencido", valor: fmt(ejecutiva.totalVencido), nota: `${pctB18(pctVencido)} de lo clasificado` },
        { etiqueta: "Mora crítica 90+", valor: fmt(ejecutiva.totalMoraCritica), nota: `${pctB18(pctCritica)} del vencido` },
        {
          etiqueta: "Venta al corte",
          valor: ytd ? fmt(ytd.actual.valor) : "—",
          nota: variacion === null ? "sin comparable" : `${firmado(variacion)} comparable`,
        },
      ],
      tituloMix: "Antigüedad de la cartera",
      preguntaMix: "¿Dónde está parada la deuda?",
      tituloCobertura: "Calidad de la lectura",
      preguntaCobertura: "¿Cuánto respalda cada dominio?",
      notaCobertura:
        "Cobertura significa algo distinto en cada dominio: cada uno declara la suya en su pie de procedencia. No se comparan entre sí.",
      pie:
        "Cartera se mide en saldo abierto de factura; ventas en total confirmado de pedido. Son magnitudes distintas y no se suman. Ninguna fórmula de esta pantalla está aprobada por Finanzas.",
    },
  };
}
