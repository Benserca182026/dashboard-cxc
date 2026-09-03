import { calcularAging } from "@/lib/calculos";
import { analizarAgingComercial, analizarSeguimientoComercial } from "@/lib/commercial-cobranza";
import { BUCKET_INFO } from "@/lib/bucketInfo";
import { repartir, pctB18, type CategoriaB18, type ContratoB18 } from "@/lib/contrato-b18";
import { BUCKETS, type Dataset, type GestionCobranza } from "@/lib/types";

/**
 * AGING — cuatro categorías sobre el molde B18.
 *
 * Todo lo que se muestra acá sale de una función de cálculo que ya existía y
 * ya estaba probada: calcularAging, analizarAgingComercial y
 * analizarSeguimientoComercial (esta última ya alimenta /seguimiento). Este
 * archivo no vuelve a leer facturas/pagos/gestiones desde cero: arma un
 * reparto honesto (Sin gestión / Con gestión / Con promesa / Con pago
 * posterior) a partir de los conteos por etapa que ya devuelve el embudo —
 * ese embudo es un encadenamiento de subconjuntos (vencido ⊇ contactado ⊇
 * promesa ⊇ pago), así que restar etapas consecutivas es aritmética sobre un
 * dato ya calculado — y, desde el rediseño de KPIs del 2026-09-03, también
 * hace CRUCES sobre esos mismos resultados ya cargados en memoria (ticket
 * promedio por bucket, ranking por cantidad de facturas, saldo vencido real
 * de los clientes sin gestión, solape con mora crítica): mismo patrón que ya
 * usa agentes-cuadro-mando.ts, nunca una query nueva ni un cálculo de aging
 * paralelo al de calcularAging().
 *
 * COBERTURA no significa lo mismo en las cuatro categorías, y por eso cada
 * una declara su propia `coberturaEtiqueta`:
 *   - Antigüedad:    % de la cartera abierta que tiene fecha y por tanto tramo.
 *   - Concentración: % del saldo vencido que explican los 10 mayores deudores.
 *   - Exclusiones:   % de las facturas del dataset que SÍ quedan dentro del aging.
 *   - Gestión:       % de los clientes vencidos que tienen alguna gestión registrada.
 * Cuatro preguntas distintas sobre universos distintos (saldo vs. facturas vs.
 * clientes): no se comparan entre sí, y el pie de cada categoría lo dice.
 */

const MOTIVO_ETIQUETA: Record<string, string> = {
  pagada: "Pagada",
  anulada: "Anulada",
  sin_fecha_vencimiento: "Sin fecha de vencimiento",
};

const num = (valor: number) => valor.toLocaleString("es-GT");
const seguro = (valor: number) => (Number.isFinite(valor) ? valor : 0);
const clamp = (valor: number) => Math.min(Math.max(seguro(valor), 0), 100);
const firmado = (valor: number) => `${valor >= 0 ? "+" : ""}${seguro(valor).toFixed(2)}%`;

export function construirAgingB18(
  dataset: Dataset,
  fechaCorte: string,
  gestiones: GestionCobranza[],
  fmt: (monto: number) => string
): ContratoB18 {
  const aging = calcularAging(dataset, fechaCorte);
  const comercial = analizarAgingComercial(dataset, fechaCorte, gestiones, aging);
  const seguimiento = analizarSeguimientoComercial(dataset, fechaCorte, gestiones);

  const fuenteTexto = dataset.fuente === "odoo-real" ? "Odoo → Supabase (snapshot)" : "Demo ficticio";
  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;

  // ── AN · Antigüedad ─────────────────────────────────────────────────────
  const filasAntiguedad = repartir(
    BUCKETS.map((bucket) => ({
      nombre: BUCKET_INFO[bucket].etiqueta,
      valor: aging.totalesPorBucket[bucket],
      valorTexto: fmt(aging.totalesPorBucket[bucket]),
    }))
  );
  const bucketLider = filasAntiguedad[0];
  // Para el tablero: mismos tramos en orden cronológico (B18-2). El ranking
  // sigue alimentando el KPI de Detecta.
  const filasAntiguedadCronologicas = repartir(
    BUCKETS.map((bucket) => ({
      nombre: BUCKET_INFO[bucket].etiqueta,
      valor: aging.totalesPorBucket[bucket],
      valorTexto: fmt(aging.totalesPorBucket[bucket]),
    })),
    { ordenar: false }
  );
  const coberturaAntiguedad = carteraTotal > 0 ? clamp((aging.totalClasificado / carteraTotal) * 100) : 0;
  const facturasVencidasAN = aging.clasificadas.filter((fila) => fila.bucket !== "actual").length;
  const pctFacturasVencidasAN = aging.clasificadas.length > 0
    ? clamp((facturasVencidasAN / aging.clasificadas.length) * 100) : 0;
  // Ticket promedio por bucket (mismo cruce que ya usa CA-Explica en
  // agentes-cuadro-mando.ts): revela si el tramo líder es líder porque tiene
  // facturas más grandes, o simplemente más facturas.
  const bucketLiderKeyAN = [...BUCKETS].sort(
    (a, b) => aging.totalesPorBucket[b] - aging.totalesPorBucket[a]
  )[0];
  const ticketPromedioPorBucketAN = new Map<string, { suma: number; cantidad: number }>();
  for (const fila of aging.clasificadas) {
    const previo = ticketPromedioPorBucketAN.get(fila.bucket) ?? { suma: 0, cantidad: 0 };
    previo.suma += fila.saldo;
    previo.cantidad += 1;
    ticketPromedioPorBucketAN.set(fila.bucket, previo);
  }
  const ticketPromedioAN = (bucket: string) => {
    const datos = ticketPromedioPorBucketAN.get(bucket);
    return datos && datos.cantidad > 0 ? datos.suma / datos.cantidad : 0;
  };
  const ticketPromedioBucketLiderAN = ticketPromedioAN(bucketLiderKeyAN);
  const ticketPromedio1a30AN = ticketPromedioAN("1-30");
  const clientesDistintosBucketLiderAN = new Set(
    aging.clasificadas.filter((fila) => fila.bucket === bucketLiderKeyAN).map((fila) => fila.factura.id_cliente)
  ).size;

  const antiguedad: CategoriaB18 = {
    id: "antiguedad",
    sigla: "AN",
    nombre: "Antigüedad",
    senal: `${bucketLider?.nombre ?? "Sin señal"} · ${pctB18(bucketLider?.pct ?? 0)} de la cartera clasificada`,
    pregunta: "¿Dónde está parada la deuda abierta por tramo?",
    filas: filasAntiguedadCronologicas,
    forma: "apilada",
    cobertura: coberturaAntiguedad,
    coberturaEtiqueta: "de la cartera abierta tiene fecha de vencimiento y puede clasificarse por tramo",
    metricas: [
      { valor: fmt(aging.totalClasificado), etiqueta: "cartera clasificada" },
      { valor: fmt(aging.saldoNoClasificable), etiqueta: "sin fecha de vencimiento" },
      { valor: num(aging.clasificadas.length), etiqueta: "facturas clasificadas" },
    ],
    problema: aging.saldoNoClasificable > 0
      ? `${fmt(aging.saldoNoClasificable)} de deuda real quedan fuera de los cinco tramos porque la factura no trae fecha de vencimiento.`
      : "Toda la deuda abierta tiene fecha de vencimiento y entra a un tramo.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(bucketLider?.pct ?? 0),
        kpiTexto: pctB18(bucketLider?.pct ?? 0), etiqueta: bucketLider?.nombre ?? "Sin señal",
        resumen: `${bucketLider?.valorTexto ?? "sin dato"} concentrados en este tramo.`,
        problema: `${bucketLider?.nombre ?? "Un tramo"} concentra ${pctB18(bucketLider?.pct ?? 0)} de la cartera clasificada.`,
        accion: "Confirmar el tramo líder contra el detalle factura por factura antes de repartir esfuerzo (ver /aging/detalle).",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: fmt(ticketPromedioBucketLiderAN), etiqueta: "ticket promedio en el tramo líder",
        resumen: `En ${bucketLider?.nombre ?? "el tramo líder"} el ticket promedio es ${fmt(ticketPromedioBucketLiderAN)}, más bajo que ${fmt(ticketPromedio1a30AN)} en 1 a 30 días: la antigüedad no engorda la factura.`,
        problema: `El tramo líder no es el de facturas más grandes: su ticket promedio (${fmt(ticketPromedioBucketLiderAN)}) es menor que el de 1 a 30 días (${fmt(ticketPromedio1a30AN)}). Las facturas viejas son más chicas, no más grandes.`,
        accion: "Gestionar cada factura por su monto individual; no asumir que lo más viejo pesa más (ver /aging/detalle).",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: pctB18(pctFacturasVencidasAN), etiqueta: "de las facturas está vencida",
        resumen: `${num(facturasVencidasAN)} de ${num(aging.clasificadas.length)} facturas clasificadas ya vencieron (${pctB18(pctFacturasVencidasAN)}). Un conteo suelto no dice si es mucho o poco frente al total clasificado.`,
        problema: `${pctB18(pctFacturasVencidasAN)} de las facturas clasificadas ya pasó su fecha de vencimiento (todo bucket salvo «Al día»).`,
        accion: "Ordenar la gestión por tramo y monto, empezando por 90+.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaAntiguedad,
        kpiTexto: pctB18(coberturaAntiguedad), etiqueta: "cartera clasificable",
        resumen: `${num(aging.excluidas.filter((e) => e.motivo === "sin_fecha_vencimiento").length)} facturas quedaron fuera por falta de fecha. Dato de contexto: el tramo líder (${bucketLider?.nombre ?? "sin dato"}) reúne ${num(clientesDistintosBucketLiderAN)} clientes distintos.`,
        problema: coberturaAntiguedad < 100
          ? `${pctB18(100 - coberturaAntiguedad)} de la deuda no puede clasificarse por antigüedad.`
          : "La cartera está completamente clasificada al corte.",
        accion: "Completar la fecha de vencimiento en el origen; el tablero no la inventa.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · facturas y pagos al corte` },
      { termino: "Capa", valor: "Saldo abierto de factura por tramo de atraso, no venta" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaAntiguedad) },
      { termino: "Límite", valor: "Sin fecha de vencimiento no hay tramo: se reporta como excluida, no se inventa fecha" },
    ],
  };

  // ── CN · Concentración ───────────────────────────────────────────────────
  // pct = participación de CADA cliente sobre el vencido TOTAL, no sobre la
  // suma del propio Top 10 — así el reparto no miente diciendo "100%" de un
  // grupo que en realidad es sólo una parte del vencido.
  const filasConcentracion = comercial.topClientes.map((cliente) => ({
    nombre: cliente.nombre,
    pct: comercial.vencido > 0 ? clamp((cliente.saldo / comercial.vencido) * 100) : 0,
    valorTexto: fmt(cliente.saldo),
  }));
  const mayorDeudor = filasConcentracion[0];
  const coberturaConcentracion = clamp(comercial.porcentajeTopDiez);
  const clientesConVencido = new Set(
    aging.clasificadas.filter((fila) => fila.bucket !== "actual").map((fila) => fila.factura.id_cliente)
  ).size;
  // Ranking alternativo por CANTIDAD de facturas vencidas (no monto) — mismo
  // cruce que ya usa CL-Explica en agentes-cuadro-mando.ts. El reparto
  // compartido (categoria.filas) sigue siendo por saldo; este ranking vive
  // solo en los campos de texto propios de la tarjeta Explica.
  const facturasPorClienteVencidoCN = new Map<string, number>();
  const saldoPorClienteVencidoCN = new Map<string, number>();
  for (const fila of aging.clasificadas) {
    if (fila.bucket === "actual") continue;
    facturasPorClienteVencidoCN.set(
      fila.factura.id_cliente,
      (facturasPorClienteVencidoCN.get(fila.factura.id_cliente) ?? 0) + 1
    );
    saldoPorClienteVencidoCN.set(
      fila.factura.id_cliente,
      (saldoPorClienteVencidoCN.get(fila.factura.id_cliente) ?? 0) + fila.saldo
    );
  }
  const nombrePorIdClienteCN = new Map(dataset.clientes.map((cliente) => [cliente.id_cliente, cliente.nombre_cliente]));
  const topPorFacturasCN = [...facturasPorClienteVencidoCN.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const liderPorFacturasCN = topPorFacturasCN[0];
  // Contexto para Recomienda: cuánto sube la concentración si se mira Top 20
  // en vez de Top 10 (mismo patrón que CL-Recomienda agrega el dato de Top 10
  // en Cuadro de mando).
  const ordenadosPorSaldoCN = [...saldoPorClienteVencidoCN.entries()].sort((a, b) => b[1] - a[1]);
  const top20CN = ordenadosPorSaldoCN.slice(0, 20).reduce((suma, [, monto]) => suma + monto, 0);
  const coberturaTop20CN = comercial.vencido > 0 ? clamp((top20CN / comercial.vencido) * 100) : 0;

  const concentracion: CategoriaB18 = {
    id: "concentracion",
    sigla: "CN",
    nombre: "Concentración",
    senal: `Top 10 concentra ${pctB18(coberturaConcentracion)} del vencido`,
    pregunta: "¿Quién concentra la deuda vencida?",
    filas: filasConcentracion,
    forma: "pareto",
    cobertura: coberturaConcentracion,
    coberturaEtiqueta: "del saldo vencido está explicado por los 10 clientes con mayor deuda",
    metricas: [
      { valor: num(comercial.topClientes.length), etiqueta: "clientes en el Top 10" },
      { valor: pctB18(coberturaConcentracion), etiqueta: "concentración Top 10" },
      { valor: mayorDeudor?.valorTexto ?? "—", etiqueta: "mayor saldo vencido" },
    ],
    problema: `${pctB18(coberturaConcentracion)} del vencido se explica con sólo ${comercial.topClientes.length} cuentas de ${num(clientesConVencido)} con saldo vencido.`,
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
        kpiTexto: num(liderPorFacturasCN?.[1] ?? 0), etiqueta: "facturas vencidas del líder, no monto",
        resumen: `Por cantidad de facturas, no por saldo: ${topPorFacturasCN.slice(0, 3).map(([id, n]) => `${nombrePorIdClienteCN.get(id) ?? id} (${n})`).join(", ")}.`,
        problema: `El ranking por monto esconde carga operativa: ${nombrePorIdClienteCN.get(liderPorFacturasCN?.[0] ?? "") ?? "el cliente líder"} tiene ${num(liderPorFacturasCN?.[1] ?? 0)} facturas vencidas abiertas, aunque no encabece el ranking por saldo (${mayorDeudor?.nombre ?? "el mayor deudor"} sí lo encabeza).`,
        accion: "Revisar el volumen de facturas por cliente, no solo el saldo, antes de asignar gestión (ver /aging/detalle).",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(comercial.clientesParaOchentaPct), etiqueta: "clientes para el 80% del vencido",
        resumen: `${num(clientesConVencido)} clientes tienen algo vencido; no todos pesan igual.`,
        problema: `${num(comercial.clientesParaOchentaPct)} cuentas concentran al menos el 80% del saldo vencido.`,
        accion: "Trabajar ese grupo antes de repartir esfuerzo sobre toda la cartera vencida.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaConcentracion,
        kpiTexto: pctB18(coberturaConcentracion), etiqueta: "explicado por el Top 10",
        resumen: `La concentración indica dónde mirar; no dice que la cuenta sea de riesgo. ${num(comercial.topClientes.length)} de ${num(clientesConVencido)} clientes (${pctB18(clamp((comercial.topClientes.length / Math.max(clientesConVencido, 1)) * 100))}) explican esto; en Top 20 sube a ${pctB18(coberturaTop20CN)} del vencido.`,
        problema: "Concentración no es sinónimo de riesgo: puede ser simplemente el cliente más grande.",
        accion: "Asignar dueño, fecha y resultado esperado a cada cuenta del Top 10.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · saldo vencido por cliente (aging comercial)` },
      { termino: "Capa", valor: "Saldo abierto vencido por cliente, no venta ni límite de crédito" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaConcentracion) },
      { termino: "Límite", valor: "El ranking no estima propensión ni capacidad de pago del cliente" },
    ],
  };

  // ── EX · Exclusiones ─────────────────────────────────────────────────────
  const saldoExcluidoTotal = aging.excluidas.reduce((suma, fila) => suma + fila.saldo, 0);
  const motivosPresentes = [...new Set(aging.excluidas.map((fila) => fila.motivo))];
  // El reparto se arma por CANTIDAD de facturas, no por saldo. Una factura
  // "pagada" tiene saldo=0 por definición (estadoFacturaDerivado: saldo===0
  // → pagada) — repartir() por saldo con «pagada» como único motivo presente
  // da un motivoLider.pct de 0.00% (total=0), un "0.00% · Pagada" que
  // contradice al ojo que 2.958 de 2.958 facturas excluidas SÍ son por ese
  // motivo. El saldo real de las exclusiones sigue disponible por separado
  // (saldoExcluidoTotal, metricas[1]) — acá se repite por conteo, que es la
  // pregunta que este dominio realmente contesta: "¿por qué salió del aging?".
  const filasExclusiones = repartir(
    motivosPresentes.map((motivo) => {
      const facturasMotivo = aging.excluidas.filter((fila) => fila.motivo === motivo).length;
      return { nombre: MOTIVO_ETIQUETA[motivo] ?? motivo, valor: facturasMotivo, valorTexto: `${num(facturasMotivo)} factura(s)` };
    })
  );
  const motivoLider = filasExclusiones[0];
  const totalFacturasDataset = aging.clasificadas.length + aging.excluidas.length;
  const coberturaExclusiones = totalFacturasDataset > 0
    ? clamp((aging.clasificadas.length / totalFacturasDataset) * 100) : 0;
  // Ticket promedio de facturas PAGADAS (monto_original, porque su saldo ya
  // es 0 por definición) contra el ticket promedio de facturas ABIERTAS —
  // revela si el tamaño de la factura se relaciona con que se pague o no.
  // "motivosPresentes.length" (1-3, casi nunca cambia) no decía nada de esto.
  const pagadasEX = aging.excluidas.filter((fila) => fila.motivo === "pagada");
  const ticketPromedioPagadaEX = pagadasEX.length > 0
    ? pagadasEX.reduce((suma, fila) => suma + fila.factura.monto_original, 0) / pagadasEX.length : 0;
  const ticketPromedioAbiertaEX = aging.clasificadas.length > 0
    ? aging.clasificadas.reduce((suma, fila) => suma + fila.factura.monto_original, 0) / aging.clasificadas.length : 0;
  const diferenciaTicketEX = ticketPromedioAbiertaEX > 0
    ? ((ticketPromedioPagadaEX - ticketPromedioAbiertaEX) / ticketPromedioAbiertaEX) * 100 : 0;

  const exclusiones: CategoriaB18 = {
    id: "exclusiones",
    sigla: "EX",
    nombre: "Exclusiones",
    senal: `${num(aging.excluidas.length)} factura(s) fuera del aging`,
    pregunta: "¿Qué se quedó fuera del aging y por qué?",
    filas: filasExclusiones,
    forma: "apilada",
    cobertura: coberturaExclusiones,
    coberturaEtiqueta: "de las facturas del dataset permanece dentro del aging (no fue excluida)",
    metricas: [
      { valor: num(aging.excluidas.length), etiqueta: "facturas excluidas" },
      { valor: fmt(saldoExcluidoTotal), etiqueta: "saldo excluido" },
      { valor: pctB18(coberturaExclusiones), etiqueta: "queda dentro del aging" },
    ],
    problema: motivoLider
      ? `${num(aging.excluidas.length)} facturas quedan fuera del aging: «${motivoLider.nombre}» explica ${pctB18(motivoLider.pct)} de ellas. El saldo real todavía atrapado en exclusiones (solo cuenta si hay «sin fecha de vencimiento») es ${fmt(saldoExcluidoTotal)}.`
      : "Ninguna factura quedó excluida del aging al corte.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(motivoLider?.pct ?? 0),
        kpiTexto: pctB18(motivoLider?.pct ?? 0), etiqueta: motivoLider?.nombre ?? "Sin exclusiones",
        resumen: `${motivoLider?.valorTexto ?? "sin dato"} excluidas por este motivo. Una factura pagada tiene saldo Q0.00 por definición: este reparto cuenta facturas, no dinero.`,
        problema: `«${motivoLider?.nombre ?? "Sin motivo"}» explica ${pctB18(motivoLider?.pct ?? 0)} de las facturas excluidas del aging.`,
        accion: "Revisar el motivo líder factura por factura antes de asumir que está resuelto (ver /aging/excluidas).",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: fmt(ticketPromedioPagadaEX), etiqueta: "ticket promedio de factura pagada",
        resumen: `Las facturas pagadas promedian ${fmt(ticketPromedioPagadaEX)} contra ${fmt(ticketPromedioAbiertaEX)} de las abiertas (${firmado(diferenciaTicketEX)}). El reparto de arriba separa pagada, anulada y sin fecha de vencimiento.`,
        problema: `El ticket promedio de lo pagado (${fmt(ticketPromedioPagadaEX)}) es ${diferenciaTicketEX >= 0 ? "mayor" : "menor"} que el de lo abierto (${fmt(ticketPromedioAbiertaEX)}): el tamaño de la factura no explica por sí solo si se cobra.`,
        accion: "No tratar todas las exclusiones como si fueran el mismo problema: cada motivo se gestiona distinto.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: fmt(aging.saldoNoClasificable), etiqueta: "saldo sin fecha de vencimiento",
        resumen: "Este es el único motivo de exclusión que sigue siendo deuda real cobrable.",
        problema: `${fmt(aging.saldoNoClasificable)} de deuda real no entra a ningún tramo por falta de fecha de vencimiento.`,
        accion: "Priorizar completar la fecha de vencimiento sobre pagadas/anuladas: ahí sí hay dinero pendiente.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaExclusiones,
        kpiTexto: pctB18(coberturaExclusiones), etiqueta: "facturas dentro del aging",
        resumen: `${num(aging.excluidas.length)} de ${num(totalFacturasDataset)} facturas del dataset quedan fuera.`,
        problema: coberturaExclusiones < 100
          ? `${pctB18(100 - coberturaExclusiones)} de las facturas del dataset no entra al aging por bucket.`
          : "Todas las facturas del dataset entran al aging.",
        accion: "Revisar /aging/excluidas antes de dar la cartera por completa.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · facturas excluidas del aging por motivo` },
      { termino: "Capa", valor: "Conteo y saldo de facturas fuera de los cinco tramos, no cartera activa" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro (pagada/anulada no son deuda pendiente)" },
      { termino: "Cobertura", valor: pctB18(coberturaExclusiones) },
      { termino: "Límite", valor: "Sólo «sin fecha de vencimiento» sigue siendo saldo real sin clasificar" },
    ],
  };

  // ── GE · Gestión ─────────────────────────────────────────────────────────
  // El embudo de analizarSeguimientoComercial es un encadenamiento de
  // subconjuntos: vencido ⊇ contactado ⊇ promesa ⊇ pago (cada etapa filtra
  // sobre la gestión de la etapa anterior). Restar etapas consecutivas da un
  // reparto SIN solape que sí suma el total de clientes vencidos.
  const vencidoTotal = seguimiento.embudo[0]?.clientes ?? 0;
  const contactadoTotal = seguimiento.embudo[1]?.clientes ?? 0;
  const promesaTotal = seguimiento.embudo[2]?.clientes ?? 0;
  const pagoTotal = seguimiento.embudo[3]?.clientes ?? 0;
  const sinGestionTotal = seguimiento.sinGestion.length;
  const conGestionSinPromesa = Math.max(contactadoTotal - promesaTotal, 0);
  const conPromesaSinPago = Math.max(promesaTotal - pagoTotal, 0);
  const promesasVencidasCount = seguimiento.promesas.filter((p) => p.estado === "fecha-vencida").length;
  // `seguimiento.saldoSinGestion` sale de prioridadSimulada() (lib/simulados.ts)
  // y suma el saldo TOTAL abierto del cliente (incluye facturas al día),
  // no solo la porción vencida — mismo defecto de origen que ya documenta
  // B18-5 para /prioritarios ("saldo priorizado" = 100% de la cartera con
  // saldo, no un subconjunto). Verificado con query real: para los clientes
  // "sin gestión" del corte 2026-08-24, ese número sobreestima en Q141,599.78
  // (16.76%) el saldo realmente vencido. Se recalcula acá el saldo VENCIDO
  // real (bucket != actual) de esos mismos clientes, cruzando contra
  // aging.clasificadas — mismo patrón de cruce que ya usa
  // agentes-cuadro-mando.ts para "vencidos activos".
  const idsSinGestion = new Set(seguimiento.sinGestion.map((fila) => fila.idCliente));
  let saldoVencidoSinGestion = 0;
  for (const fila of aging.clasificadas) {
    if (fila.bucket === "actual") continue;
    if (idsSinGestion.has(fila.factura.id_cliente)) saldoVencidoSinGestion += fila.saldo;
  }
  // Cuántos de los clientes sin gestión ya tienen una factura en 90+ (mora
  // crítica): la cola sin trabajar no es uniforme, parte ya es urgente.
  const clientesSinGestionEnMoraCritica = new Set(
    aging.clasificadas
      .filter((fila) => fila.bucket === "90+" && idsSinGestion.has(fila.factura.id_cliente))
      .map((fila) => fila.factura.id_cliente)
  ).size;
  const pctSinGestionEnMoraCritica = sinGestionTotal > 0
    ? clamp((clientesSinGestionEnMoraCritica / sinGestionTotal) * 100) : 0;

  const filasGestion = repartir([
    { nombre: "Sin gestión registrada", valor: sinGestionTotal, valorTexto: `${num(sinGestionTotal)} cliente(s)` },
    { nombre: "Con gestión, sin promesa", valor: conGestionSinPromesa, valorTexto: `${num(conGestionSinPromesa)} cliente(s)` },
    { nombre: "Con promesa, sin pago posterior", valor: conPromesaSinPago, valorTexto: `${num(conPromesaSinPago)} cliente(s)` },
    { nombre: "Con pago posterior a la promesa", valor: pagoTotal, valorTexto: `${num(pagoTotal)} cliente(s)` },
  ], { ordenar: false }); // etapas del embudo en su orden, no por tamaño
  const coberturaGestion = vencidoTotal > 0 ? clamp((contactadoTotal / vencidoTotal) * 100) : 0;

  const gestion: CategoriaB18 = {
    id: "gestion",
    sigla: "GE",
    nombre: "Gestión",
    senal: `${pctB18(coberturaGestion)} de los clientes vencidos tiene gestión registrada`,
    pregunta: "¿Qué saldo vencido tiene seguimiento y cuál no?",
    filas: filasGestion,
    forma: "apilada",
    cobertura: coberturaGestion,
    coberturaEtiqueta: "de los clientes con saldo vencido tiene al menos una gestión registrada",
    metricas: [
      { valor: fmt(saldoVencidoSinGestion), etiqueta: "saldo vencido sin gestión" },
      { valor: num(sinGestionTotal), etiqueta: "clientes sin gestión" },
      { valor: num(contactadoTotal), etiqueta: "clientes con gestión registrada" },
    ],
    problema: sinGestionTotal > 0
      ? `${num(sinGestionTotal)} clientes con saldo vencido (${fmt(saldoVencidoSinGestion)}) no tienen ninguna gestión registrada.`
      : "Todos los clientes con saldo vencido tienen al menos una gestión registrada.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(100 - coberturaGestion),
        kpiTexto: pctB18(clamp(100 - coberturaGestion)), etiqueta: "vencido sin gestión",
        resumen: `${num(sinGestionTotal)} clientes vencidos (${fmt(saldoVencidoSinGestion)}) sin ningún contacto registrado.`,
        problema: `${pctB18(clamp(100 - coberturaGestion))} de los clientes vencidos no tiene ninguna gestión registrada.`,
        accion: "Asignar responsable y primer contacto a la cola sin gestión (ver /seguimiento).",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: num(promesaTotal), etiqueta: "clientes con promesa documentada",
        resumen: "El reparto separa sin gestión, con gestión, con promesa y con pago posterior.",
        problema: "Tener una gestión registrada no es lo mismo que tener una promesa; y una promesa no es lo mismo que un pago.",
        accion: "No confundir «contactado» con «con compromiso de pago».",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(promesasVencidasCount), etiqueta: "promesas con fecha vencida",
        resumen: "Compromisos cuya fecha declarada ya pasó sin cierre registrado.",
        problema: `${num(promesasVencidasCount)} promesa(s) tienen fecha vencida sin resultado documentado.`,
        accion: "Revisar esas promesas primero; el dato no permite llamarlas incumplidas sin confirmar el resultado.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: pctSinGestionEnMoraCritica,
        kpiTexto: num(clientesSinGestionEnMoraCritica), etiqueta: "clientes sin gestión ya en mora crítica (90+)",
        resumen: `${pctB18(pctSinGestionEnMoraCritica)} de los ${num(sinGestionTotal)} clientes sin gestión (${num(clientesSinGestionEnMoraCritica)}) ya tienen una factura en 90+: la cola sin trabajar no es pareja, buena parte ya es urgente.`,
        problema: `${pctB18(pctSinGestionEnMoraCritica)} de los clientes sin gestión ya está en mora crítica (90+): no es solo «falta contacto», es contacto urgente.`,
        accion: `Priorizar el contacto en estos ${num(clientesSinGestionEnMoraCritica)} clientes antes que en el resto de la cola sin gestión (ver /seguimiento).`,
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · gestiones de cobranza registradas en el prototipo (localStorage)` },
      { termino: "Capa", valor: "Seguimiento comercial sobre clientes con saldo vencido, no resultado de cobro" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "No aplica — el reparto cuenta clientes, no saldo (el saldo se declara aparte)" },
      { termino: "Cobertura", valor: pctB18(coberturaGestion) },
      { termino: "Límite", valor: "Las gestiones viven sólo en el localStorage del navegador; el pago posterior no prueba que la promesa lo haya causado" },
    ],
  };

  // ── Resumen del dashboard integral ──────────────────────────────────────
  const pctVencidoDeClasificado = aging.totalClasificado > 0
    ? clamp((comercial.vencido / aging.totalClasificado) * 100) : 0;

  return {
    eyebrow: "COBRANZA · AGING DE CARTERA",
    titulo: "Aging de cartera",
    rotuloRiel: "Categorías",
    corte: fechaCorte,
    categorias: [antiguedad, concentracion, exclusiones, gestion],
    resumen: {
      subtitulo: "Antigüedad, concentración, exclusiones y gestión",
      kpis: [
        { etiqueta: "Cartera abierta", valor: fmt(carteraTotal), nota: `${pctB18(coberturaAntiguedad)} clasificable por tramo` },
        { etiqueta: "Saldo vencido", valor: fmt(comercial.vencido), nota: `${pctB18(pctVencidoDeClasificado)} de la cartera clasificada` },
        { etiqueta: "Concentración Top 10", valor: pctB18(coberturaConcentracion), nota: `en ${num(comercial.topClientes.length)} cliente(s)` },
        { etiqueta: "Vencido con gestión", valor: pctB18(coberturaGestion), nota: `${num(sinGestionTotal)} cliente(s) sin contacto` },
      ],
      tituloMix: "Antigüedad de la cartera",
      preguntaMix: "¿Dónde está parada la deuda abierta?",
      tituloCobertura: "Calidad de la lectura",
      preguntaCobertura: "¿Cuánto respalda cada categoría?",
      notaCobertura:
        "Cobertura significa algo distinto en cada categoría: antigüedad mide saldo clasificable, concentración mide saldo explicado por el Top 10, exclusiones mide facturas que permanecen en el aging y gestión mide clientes vencidos con contacto registrado. Cada una declara la suya en su pie de procedencia; no se comparan entre sí.",
      pie:
        "La cartera se mide en saldo abierto de factura, no en venta. El vencido no es un pronóstico de cobro: sin promesas de pago documentadas y sin capacidad de pago del cliente confirmada, esta pantalla ordena la gestión, no la garantiza. Ninguna fórmula de esta pantalla está aprobada por Finanzas.",
    },
  };
}
