import { repartir, pctB18, type CategoriaB18, type ContratoB18 } from "@/lib/contrato-b18";
import { analizarPrioritariosComercial, type FilaPrioridadComercial } from "@/lib/commercial-cobranza";
import type { Dataset, GestionCobranza } from "@/lib/types";

/**
 * CLIENTES PRIORITARIOS — cuatro categorías sobre el molde B18.
 *
 * Todo lo que se muestra acá sale de analizarPrioritariosComercial(), que a su
 * vez envuelve prioridadSimulada() (lib/simulados.ts). Este archivo NO calcula
 * ningún score ni ninguna regla de negocio nueva: agrupa y suma saldos ya
 * calculados, y traduce esa lectura al contrato del molde.
 *
 * ADVERTENCIA QUE NO SE SUAVIZA: scoreSimulado es una heurística local con
 * pesos ficticios (lib/simulados.ts, SUPUESTOS_SCORING). No es una
 * probabilidad de cobro, no está aprobada por Finanzas, y no promete que
 * nadie vaya a pagar. Esa advertencia queda escrita, literal, en el pie de
 * la categoría "Score" y repetida en el pie del dashboard integral.
 *
 * COBERTURA no significa lo mismo en las cuatro categorías:
 *  - Score: cuánto del saldo priorizado cubre el Top 10 por score.
 *  - Gestión: cuánto del saldo priorizado tiene un responsable derivado de
 *    una gestión registrada (no si esa gestión funcionó).
 *  - Concentración: cuánto del saldo priorizado explican las 5 cuentas de
 *    mayor saldo (Pareto real, no el mismo orden que el score).
 *  - Antigüedad: cuánto del saldo priorizado ya cruzó a mora crítica (90+).
 */

const num = (valor: number) => valor.toLocaleString("es-GT");
const seguro = (valor: number) => (Number.isFinite(valor) ? valor : 0);
const clamp = (valor: number) => Math.min(Math.max(seguro(valor), 0), 100);

function bucketDias(dias: number): string {
  if (dias <= 0) return "Al día o sin fecha (0)";
  if (dias <= 30) return "1 a 30 días";
  if (dias <= 60) return "31 a 60 días";
  if (dias <= 90) return "61 a 90 días";
  return "Más de 90 días";
}

/** Cuántas cuentas, ordenadas por saldo, hacen falta para llegar al objetivo (80% por defecto). */
function cuentasParaObjetivo(ordenadas: { saldo: number }[], total: number, objetivo = 80): number {
  if (total <= 0) return 0;
  let acumulado = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    acumulado += ordenadas[i].saldo;
    if ((acumulado / total) * 100 >= objetivo) return i + 1;
  }
  return ordenadas.length;
}

export function construirPrioritariosB18(
  dataset: Dataset,
  fechaCorte: string,
  gestiones: GestionCobranza[],
  fmt: (monto: number) => string
): ContratoB18 {
  const comercial = analizarPrioritariosComercial(dataset, fechaCorte, gestiones);
  const filas: FilaPrioridadComercial[] = comercial.filas; // ya viene ordenada por score desc.
  const saldoTotal = comercial.saldoTotal;
  const fuenteTexto = dataset.fuente === "odoo-real" ? "Odoo → Supabase (snapshot)" : "Demo ficticio";

  // ── SC · Score ───────────────────────────────────────────────────────────
  const topDiez = comercial.topDiez;
  const lider = topDiez[0] ?? null;
  const filasScore = repartir(
    topDiez.map((f) => ({ nombre: f.cliente, valor: f.score, valorTexto: `${f.score} pts (score simulado)` }))
  );
  const top2Score = (filasScore[0]?.pct ?? 0) + (filasScore[1]?.pct ?? 0);
  const coberturaScore = saldoTotal > 0 ? clamp((comercial.saldoTopDiez / saldoTotal) * 100) : 0;
  // Cuentas y saldo que NO entran a la vista Top 10 — la propia worklist
  // completa (`filas`) tiene 111 cuentas; el Top 10 sólo muestra 10.
  const cuentasFueraTopDiez = filas.length - topDiez.length;
  const saldoFueraTopDiez = saldoTotal - comercial.saldoTopDiez;
  // Comparación real (Top 10 por SCORE vs Top 10 por SALDO PURO), para dar
  // contexto a "Recomienda" sin cambiar su KPI/dona (que sigue siendo
  // coberturaScore, el número que de verdad define la categoría).
  const porSaldoDesc = [...filas].sort((a, b) => b.saldo - a.saldo || a.idCliente.localeCompare(b.idCliente));
  const saldoTop10PorSaldoPuro = porSaldoDesc.slice(0, 10).reduce((s, f) => s + f.saldo, 0);
  const coberturaTop10PorSaldoPuro = saldoTotal > 0 ? clamp((saldoTop10PorSaldoPuro / saldoTotal) * 100) : 0;

  const score: CategoriaB18 = {
    id: "score",
    sigla: "SC",
    nombre: "Score",
    senal: lider
      ? `${lider.cliente} lidera con score simulado ${lider.score}`
      : "No hay cuentas priorizadas",
    pregunta: "¿Cómo reparte el score simulado el Top 10 de la worklist?",
    filas: filasScore,
    cobertura: coberturaScore,
    coberturaEtiqueta: "del saldo priorizado total queda cubierto por el Top 10 del score simulado",
    metricas: [
      { valor: lider ? `${lider.score} pts` : "—", etiqueta: "score líder (simulado)" },
      { valor: fmt(comercial.saldoTopDiez), etiqueta: "saldo del Top 10" },
      { valor: num(filas.length), etiqueta: "cuentas priorizadas" },
    ],
    problema: `El score es una heurística simulada, con pesos ficticios 50/50 entre saldo y días de atraso — ${num(filas.length)} cuenta(s) quedaron priorizadas, y ${num(cuentasFueraTopDiez)} de ellas (${fmt(saldoFueraTopDiez)}) quedan fuera de la vista Top 10.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(lider?.score ?? 0),
        kpiTexto: lider ? `${lider.score} pts` : "—", etiqueta: "score simulado líder",
        resumen: lider ? `${lider.cliente} · ${fmt(lider.saldo)} · ${lider.dias} días de atraso.` : "Sin cuentas priorizadas.",
        problema: lider
          ? `${lider.cliente} encabeza el ranking simulado con ${lider.score} puntos sobre 100.`
          : "No hay cuentas con score simulado al corte.",
        accion: "Confirmar saldo y días contra el detalle de factura antes de mover recursos por este score.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18(top2Score), etiqueta: "Top 2 del score del Top 10",
        resumen: "El score combina saldo y días de atraso normalizados, con pesos ficticios 50/50.",
        problema: `Las dos cuentas líderes concentran ${pctB18(top2Score)} del score acumulado del Top 10 — no del saldo.`,
        accion: "Leer el score como orden relativo, nunca como magnitud de dinero.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(cuentasFueraTopDiez), etiqueta: "cuentas fuera del Top 10",
        resumen: `${fmt(saldoFueraTopDiez)} (${pctB18(saldoTotal > 0 ? clamp((saldoFueraTopDiez / saldoTotal) * 100) : 0)}) de saldo no aparece en ningún otro número de esta categoría: el Top 10 es sólo una ventana de 10 sobre ${num(filas.length)} cuentas.`,
        problema: `${num(cuentasFueraTopDiez)} cuentas (${fmt(saldoFueraTopDiez)}) no entran a la vista Top 10 — no desaparecen, sólo no se ven en esta pantalla.`,
        accion: "Revisar periódicamente más allá del Top 10; el score también ordena a estas cuentas, solo que no entran en la vista principal.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaScore,
        kpiTexto: pctB18(coberturaScore), etiqueta: "saldo cubierto por el Top 10",
        resumen: `Ninguna cifra de esta categoría es una probabilidad de cobro. Si en cambio se ordenara el Top 10 puro por saldo (sin días de atraso), cubriría ${pctB18(coberturaTop10PorSaldoPuro)} — el score deja fuera saldo grande porque también pesa la antigüedad.`,
        problema: "El dataset no contiene señales de riesgo de crédito real (historial, buró, límite de crédito); el score no las sustituye.",
        accion: "No usar este score para negociar plazos ni para reportarlo a Finanzas como probabilidad.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · score simulado (lib/simulados.ts) sobre saldo abierto y días de atraso` },
      { termino: "Capa", valor: "Heurística de orden interno, no probabilidad de cobro ni score de crédito" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro (los puntos de score no son moneda)" },
      { termino: "Cobertura", valor: pctB18(coberturaScore) },
      { termino: "Límite", valor: "Heurística simulada con pesos ficticios 50/50 (saldo/días) — no aprobada por Finanzas, no es una probabilidad de cobro ni una promesa de pago del cliente." },
    ],
  };

  // ── GE · Gestión ─────────────────────────────────────────────────────────
  const conGestion = filas.filter((f) => f.responsable !== "Sin responsable registrado");
  const sinGestion = filas.filter((f) => f.responsable === "Sin responsable registrado"); // conserva el orden por score.
  const saldoCon = conGestion.reduce((s, f) => s + f.saldo, 0);
  const saldoSin = sinGestion.reduce((s, f) => s + f.saldo, 0);
  const filasGestion = repartir([
    { nombre: "Con gestión registrada", valor: saldoCon, valorTexto: fmt(saldoCon) },
    { nombre: "Sin gestión registrada", valor: saldoSin, valorTexto: fmt(saldoSin) },
  ]);
  const coberturaGestion = saldoTotal > 0 ? clamp((saldoCon / saldoTotal) * 100) : 0;
  const liderSinGestion = sinGestion[0] ?? null;
  // Cruce Score x Gestión: de las 10 cuentas de mayor prioridad (score), ¿a
  // cuántas ya se les dio seguimiento? Reencuadra la cobertura general (que
  // hoy es 0.00% para toda la worklist) sobre el subconjunto que de verdad
  // importa gestionar primero.
  const topDiezSinGestion = topDiez.filter((f) => f.responsable === "Sin responsable registrado");
  // Distribución de la acción SUGERIDA por regla determinista
  // (`accionPorRegla`, lib/simulados.ts:96-104, función de días de atraso y
  // disputa) — a diferencia de `responsable`, este dato NO vive en
  // localStorage: es el mismo sin importar el navegador o la sesión.
  const porAccionSugerida = new Map<string, { cuentas: number; saldo: number }>();
  for (const f of filas) {
    const previo = porAccionSugerida.get(f.proximaAccion) ?? { cuentas: 0, saldo: 0 };
    previo.cuentas += 1;
    previo.saldo += f.saldo;
    porAccionSugerida.set(f.proximaAccion, previo);
  }
  const sinAccionHoy = porAccionSugerida.get("sin acción — al día") ?? { cuentas: 0, saldo: 0 };
  const pctSinAccionHoy = filas.length > 0 ? clamp((sinAccionHoy.cuentas / filas.length) * 100) : 0;
  const otrasAcciones = [...porAccionSugerida.entries()].filter(([accion]) => accion !== "sin acción — al día");

  const gestion: CategoriaB18 = {
    id: "gestion",
    sigla: "GE",
    nombre: "Gestión",
    senal: liderSinGestion
      ? `${liderSinGestion.cliente} es la cuenta priorizada de mayor score sin gestión registrada`
      : "Todas las cuentas priorizadas tienen una gestión registrada",
    pregunta: "¿A quién ya se dio seguimiento dentro de los priorizados?",
    filas: filasGestion,
    forma: "apilada",
    cobertura: coberturaGestion,
    coberturaEtiqueta: "del saldo priorizado tiene un responsable derivado de su última gestión registrada",
    metricas: [
      { valor: num(conGestion.length), etiqueta: "cuentas con gestión" },
      { valor: num(sinGestion.length), etiqueta: "cuentas sin gestión" },
      { valor: fmt(saldoSin), etiqueta: "saldo sin gestión" },
    ],
    problema: sinGestion.length > 0
      ? `${num(sinGestion.length)} de ${num(filas.length)} cuentas priorizadas no tienen una gestión de cobranza registrada detrás, incluidas las ${num(topDiezSinGestion.length)} de mayor score.`
      : "Todas las cuentas priorizadas tienen una gestión de cobranza registrada.",
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(liderSinGestion?.score ?? 0),
        kpiTexto: liderSinGestion ? `${liderSinGestion.score} pts` : "—", etiqueta: "score de la cuenta sin gestión",
        resumen: liderSinGestion
          ? `${liderSinGestion.cliente} · ${fmt(liderSinGestion.saldo)} · sin responsable asignado.`
          : "No hay cuentas priorizadas sin gestión.",
        problema: liderSinGestion
          ? `${liderSinGestion.cliente} es la prioridad más alta (score ${liderSinGestion.score}) sin gestión registrada.`
          : "Toda la worklist tiene una gestión registrada detrás.",
        accion: "Asignar responsable y registrar el primer contacto antes de sumar otra cuenta a la cola.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18(coberturaGestion), etiqueta: "saldo con gestión",
        resumen: "El reparto separa saldo con responsable de saldo sin responsable.",
        problema: `${pctB18(100 - coberturaGestion)} del saldo priorizado no tiene responsable derivado de una gestión.`,
        accion: "Repartir la cola sin gestión entre los responsables activos.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: num(topDiezSinGestion.length), etiqueta: "cuentas del Top 10 por score sin gestión",
        resumen: `Las ${num(topDiezSinGestion.length)} cuentas de mayor score — ${fmt(topDiezSinGestion.reduce((s, f) => s + f.saldo, 0))} en saldo — no tienen responsable asignado, no sólo el total genérico de ${num(sinGestion.length)}.`,
        problema: "No toda cuenta sin gestión pesa igual: hay que ordenar primero por score y saldo.",
        accion: "Asignar responsable a las cuentas del Top 10 por score antes de sumar otro nombre a la cola.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: pctSinAccionHoy,
        kpiTexto: pctB18(pctSinAccionHoy), etiqueta: "no necesita ninguna acción hoy (regla determinista)",
        resumen: `${num(sinAccionHoy.cuentas)} de ${num(filas.length)} cuentas están al día según la regla de acción sugerida (lib/simulados.ts). El resto se reparte en ${otrasAcciones.map(([accion, datos]) => `${datos.cuentas} "${accion}"`).join(", ")}.`,
        problema: "Esta acción sugerida es una regla determinista sobre días de atraso y disputa — no es lo mismo que tener un responsable registrado (eso lo mide Explica).",
        accion: "Usar esta distribución para planear la carga de la semana; no reemplaza la gestión que cada responsable registre.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · última gestión de cobranza por cliente, cruzada contra la worklist priorizada por score simulado` },
      { termino: "Capa", valor: "Presencia de responsable derivado de la última gestión, no efectividad de la gestión" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaGestion) },
      { termino: "Límite", valor: "No mide si el contacto fue efectivo, sólo si existe un registro de gestión previo; no forma parte del score simulado." },
    ],
  };

  // ── CN · Concentración ───────────────────────────────────────────────────
  const porSaldo = [...filas].sort((a, b) => b.saldo - a.saldo || a.idCliente.localeCompare(b.idCliente));
  const top5 = porSaldo.slice(0, 5);
  const saldoTop5 = top5.reduce((s, f) => s + f.saldo, 0);
  const filasConcentracion = repartir(top5.map((f) => ({ nombre: f.cliente, valor: f.saldo, valorTexto: fmt(f.saldo) })));
  const coberturaConcentracion = saldoTotal > 0 ? clamp((saldoTop5 / saldoTotal) * 100) : 0;
  const cuentasPara80 = cuentasParaObjetivo(porSaldo, saldoTotal, 80);
  const mayorSaldo = porSaldo[0] ?? null;
  const top2Concentracion = (filasConcentracion[0]?.pct ?? 0) + (filasConcentracion[1]?.pct ?? 0);
  // Cruce Concentración x Score: del Top 5 por SALDO (esta categoría), ¿cuántos
  // están también en el Top 10 por SCORE (categoría Score)? Si el score no
  // captura una cuenta grande, aparece acá como la excepción nombrada.
  const idsTopDiezScore = new Set(topDiez.map((f) => f.idCliente));
  const top5FueraDelScore = top5.filter((f) => !idsTopDiezScore.has(f.idCliente));
  const overlapTop5ConScore = top5.length - top5FueraDelScore.length;
  // Comparación real Top 5 vs Top 10 por saldo, para dar contexto a
  // "Recomienda" sin cambiar su KPI/dona (que sigue siendo coberturaConcentracion,
  // el número que de verdad define la categoría) — mismo patrón que CL-Recomienda
  // en Cuadro de mando ("en Top10 sube a X%").
  const saldoTop10Concentracion = porSaldo.slice(0, 10).reduce((s, f) => s + f.saldo, 0);
  const coberturaTop10Concentracion = saldoTotal > 0 ? clamp((saldoTop10Concentracion / saldoTotal) * 100) : 0;

  const concentracion: CategoriaB18 = {
    id: "concentracion",
    sigla: "CN",
    nombre: "Concentración",
    senal: `Top 5 por saldo concentra ${pctB18(coberturaConcentracion)} del saldo priorizado`,
    pregunta: "¿Dónde se concentra el saldo dentro de los priorizados?",
    filas: filasConcentracion,
    forma: "pareto",
    cobertura: coberturaConcentracion,
    coberturaEtiqueta: "del saldo priorizado total está explicado por las 5 cuentas de mayor saldo de este grupo",
    metricas: [
      { valor: num(cuentasPara80), etiqueta: "cuentas para el 80% del saldo" },
      { valor: fmt(saldoTop5), etiqueta: "saldo del Top 5 por saldo" },
      { valor: mayorSaldo ? fmt(mayorSaldo.saldo) : "—", etiqueta: "mayor saldo individual" },
    ],
    problema: `${num(cuentasPara80)} de ${num(filas.length)} cuentas concentran el 80% del saldo priorizado; del Top 5 por saldo, ${num(overlapTop5ConScore)} de 5 también aparece en el Top 10 por score.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(filasConcentracion[0]?.pct ?? 0),
        kpiTexto: mayorSaldo ? fmt(mayorSaldo.saldo) : "—", etiqueta: "mayor saldo individual",
        resumen: mayorSaldo
          ? `${mayorSaldo.cliente} concentra ${pctB18(filasConcentracion[0]?.pct ?? 0)} del saldo del Top 5.`
          : "Sin cuentas priorizadas.",
        problema: mayorSaldo
          ? `${mayorSaldo.cliente} tiene el mayor saldo dentro del grupo priorizado (score simulado ${mayorSaldo.score}).`
          : "No hay cuentas priorizadas.",
        accion: "Confirmar si esta cuenta es la de mayor riesgo o simplemente la de mayor tamaño comercial.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18(top2Concentracion), etiqueta: "Top 2 del Top 5",
        resumen: "El Pareto ordena por saldo, no por score simulado.",
        problema: "El líder por saldo no siempre coincide con el líder por score: son dos lecturas distintas.",
        accion: "Cruzar la cuenta líder por saldo con su score antes de decidir el orden de trabajo.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: `${num(overlapTop5ConScore)}/5`, etiqueta: "del Top 5 por saldo coincide con el Top 10 por score",
        resumen: top5FueraDelScore.length > 0
          ? `${top5FueraDelScore.map((f) => `${f.cliente} (score ${f.score}, ${fmt(f.saldo)})`).join(", ")} queda fuera del Top 10 por score aunque esté en el Top 5 por saldo.`
          : "Los 5 clientes de mayor saldo están también en el Top 10 por score.",
        problema: top5FueraDelScore.length > 0
          ? `El score no captura todo el saldo grande: pesa también los días de atraso, y una cuenta grande con pocos días de atraso queda fuera del Top 10.`
          : "El score sí prioriza a los 5 clientes de mayor saldo dentro de este grupo.",
        accion: "Revisar manualmente los saldos grandes que el score no prioriza, no solo confiar en el orden del Top 10.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: coberturaConcentracion,
        kpiTexto: pctB18(coberturaConcentracion), etiqueta: "explicado por el Top 5",
        resumen: `Concentración no es sinónimo de riesgo de no pago. En Top 10 sube a ${pctB18(coberturaTop10Concentracion)} del saldo priorizado.`,
        problema: "Una cuenta grande puede ser el cliente más sólido de la cartera, no el más riesgoso.",
        accion: "Asignar dueño y fecha de contacto al Top 5, con criterio comercial además del saldo.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · saldo abierto por cliente dentro de la worklist priorizada, lib/commercial-cobranza.ts` },
      { termino: "Capa", valor: "Saldo abierto dentro del grupo ya priorizado por score, no cartera total ni venta" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro" },
      { termino: "Cobertura", valor: pctB18(coberturaConcentracion) },
      { termino: "Límite", valor: "La concentración no mide riesgo de crédito; el ranking de saldo es independiente del score simulado." },
    ],
  };

  // ── AT · Antigüedad ──────────────────────────────────────────────────────
  const buckets = new Map<string, number>();
  for (const f of filas) {
    const clave = bucketDias(f.dias);
    buckets.set(clave, (buckets.get(clave) ?? 0) + f.saldo);
  }
  const filasAntiguedad = repartir(
    [...buckets.entries()].map(([nombre, valor]) => ({ nombre, valor, valorTexto: fmt(valor) }))
  );
  const bucketLider = filasAntiguedad[0];
  // Para el tablero: tramos en orden cronológico (B18-2); el ranking sigue
  // alimentando el KPI de Detecta. El Map se llena por orden de aparición
  // de clientes, así que el orden se fija acá explícitamente.
  const ORDEN_TRAMOS = ["Al día o sin fecha (0)", "1 a 30 días", "31 a 60 días", "61 a 90 días", "Más de 90 días"];
  const filasAntiguedadCronologicas = repartir(
    ORDEN_TRAMOS.filter((nombre) => buckets.has(nombre)).map((nombre) => ({
      nombre,
      valor: buckets.get(nombre) ?? 0,
      valorTexto: fmt(buckets.get(nombre) ?? 0),
    })),
    { ordenar: false }
  );
  const moraCritica = filas.filter((f) => f.dias > 90);
  const saldoCritico = moraCritica.reduce((s, f) => s + f.saldo, 0);
  const coberturaAntiguedad = saldoTotal > 0 ? clamp((saldoCritico / saldoTotal) * 100) : 0;
  const top2Antiguedad = (filasAntiguedad[0]?.pct ?? 0) + (filasAntiguedad[1]?.pct ?? 0);
  // Ratio en vez de conteo suelto (mismo patrón que CA-Prioriza/CL-Prioriza en
  // Cuadro de mando): moraCritica.length ya se muestra sin contexto en `metricas`.
  const pctMoraCritica = filas.length > 0 ? clamp((moraCritica.length / filas.length) * 100) : 0;
  // Cruce Antigüedad x Score: de las cuentas en mora crítica (90+), ¿cuántas
  // están priorizadas en el Top 10 por score? El bucketLider ya usa el MISMO
  // conjunto de cuentas que `moraCritica` (dias>90), así que su `pct` es
  // idéntico a `coberturaAntiguedad` — verificado a 8 decimales con
  // scripts/opciones-prioritarios.ts — por eso Recomienda no puede repetirlo.
  const moraCriticaEnTopDiez = moraCritica.filter((f) => idsTopDiezScore.has(f.idCliente));
  const saldoMoraCriticaEnTopDiez = moraCriticaEnTopDiez.reduce((s, f) => s + f.saldo, 0);
  const moraCriticaFueraDelScore = moraCritica.length - moraCriticaEnTopDiez.length;
  const pctMoraCriticaFueraDelScore = moraCritica.length > 0
    ? clamp((moraCriticaFueraDelScore / moraCritica.length) * 100) : 0;
  const saldoMoraCriticaFueraDelScore = saldoCritico - saldoMoraCriticaEnTopDiez;

  const antiguedad: CategoriaB18 = {
    id: "antiguedad",
    sigla: "AT",
    nombre: "Antigüedad",
    senal: `${bucketLider?.nombre ?? "Sin señal"} concentra ${pctB18(bucketLider?.pct ?? 0)} del saldo priorizado`,
    pregunta: "¿Qué tan atrasadas están las cuentas priorizadas?",
    filas: filasAntiguedadCronologicas,
    forma: "apilada",
    cobertura: coberturaAntiguedad,
    coberturaEtiqueta: "del saldo priorizado ya superó los 90 días de atraso (mora crítica)",
    metricas: [
      { valor: fmt(saldoCritico), etiqueta: "saldo en mora crítica 90+" },
      { valor: num(moraCritica.length), etiqueta: "cuentas en mora crítica" },
      { valor: `${comercial.medianaDias.toFixed(0)} días`, etiqueta: "mediana de atraso del grupo" },
    ],
    problema: `${num(moraCritica.length)} cuenta(s) priorizadas ya superan 90 días de atraso, con ${fmt(saldoCritico)} en juego; de esas, sólo ${num(moraCriticaEnTopDiez.length)} (${fmt(saldoMoraCriticaEnTopDiez)}) están en el Top 10 por score.`,
    tarjetas: [
      {
        id: "detecta", grafica: "dona", donaPct: clamp(bucketLider?.pct ?? 0),
        kpiTexto: pctB18(bucketLider?.pct ?? 0), etiqueta: bucketLider?.nombre ?? "Sin señal",
        resumen: `${bucketLider?.valorTexto ?? "sin dato"} concentrados en este tramo.`,
        problema: `${bucketLider?.nombre ?? "Un tramo"} concentra ${pctB18(bucketLider?.pct ?? 0)} del saldo priorizado.`,
        accion: "Confirmar el tramo líder contra el detalle de factura antes de repartir esfuerzo.",
      },
      {
        id: "explica", grafica: "barras",
        kpiTexto: pctB18(top2Antiguedad), etiqueta: "Top 2 tramos",
        resumen: "Los tramos agrupan por días de atraso máximo del cliente, no por factura individual.",
        problema: "Un cliente con 0 días puede estar al día o tener facturas sin fecha de vencimiento registrada: el dato no distingue los dos casos aquí.",
        accion: "Revisar factura por factura antes de asumir que un cliente en 0 días está realmente al día.",
      },
      {
        id: "prioriza", grafica: "pareto",
        kpiTexto: pctB18(pctMoraCritica), etiqueta: "de las cuentas priorizadas está en mora crítica (90+)",
        resumen: `${num(moraCritica.length)} de ${num(filas.length)} cuentas. Mediana de atraso del grupo completo: ${comercial.medianaDias.toFixed(0)} días.`,
        problema: `${fmt(saldoCritico)} están en cuentas que ya superaron 90 días.`,
        accion: "Separar mora crítica del resto; no se gestionan con el mismo guion.",
      },
      {
        id: "recomienda", grafica: "cobertura", donaPct: pctMoraCriticaFueraDelScore,
        kpiTexto: pctB18(pctMoraCriticaFueraDelScore), etiqueta: "de la mora crítica no está en el Top 10 por score",
        resumen: `El score prioriza sólo ${num(moraCriticaEnTopDiez.length)} de las ${num(moraCritica.length)} cuentas en mora crítica (${fmt(saldoMoraCriticaEnTopDiez)}). Las otras ${num(moraCriticaFueraDelScore)}, con ${fmt(saldoMoraCriticaFueraDelScore)} en juego, quedan fuera del Top 10 porque su saldo individual pesa menos, aunque lleven más días de atraso.`,
        problema: "Más días de atraso no es, por definición del dataset, una promesa de que la cuenta no pagará — y el score del Top 10 no cubre a la mayoría de la mora crítica.",
        accion: "Revisar manualmente las cuentas en mora crítica que el score no prioriza antes de asumir que el Top 10 cubre todo el riesgo de antigüedad.",
      },
    ],
    metadatos: [
      { termino: "Fuente", valor: `${fuenteTexto} · días de atraso máximo por cliente dentro de la worklist priorizada, lib/commercial-cobranza.ts sobre lib/simulados.ts` },
      { termino: "Capa", valor: "Distribución de antigüedad dentro del grupo ya priorizado por score, no de la cartera total" },
      { termino: "Corte", valor: fechaCorte },
      { termino: "Moneda", valor: "Quetzal — moneda de registro (para los saldos, no para los días)" },
      { termino: "Cobertura", valor: pctB18(coberturaAntiguedad) },
      { termino: "Límite", valor: "Un cliente con 0 días de atraso puede estar al día o tener facturas sin fecha de vencimiento: el dato no distingue los dos casos aquí." },
    ],
  };

  return {
    eyebrow: "COBRANZA · WORKLIST SIMULADA",
    titulo: "Clientes prioritarios",
    rotuloRiel: "Categorías",
    corte: fechaCorte,
    categorias: [score, gestion, concentracion, antiguedad],
    resumen: {
      subtitulo: "Score, gestión, concentración y antigüedad de la worklist priorizada",
      // Los 4 KPI de cabecera cambiaron (2026-09-03): "Cuentas con saldo
      // abierto" (111, el 100% de la worklist — no distingue nada) y "Score
      // líder (simulado)" (la cifra de UN cliente con una heurística no
      // aprobada por Finanzas) no resumían el grupo ni orientaban ninguna
      // decisión. Se reemplazan por Concentración Top 5 y Saldo sin gestión:
      // ambas ya se calculaban para las categorías de abajo, y sí describen
      // el tamaño real del problema de priorización.
      kpis: [
        { etiqueta: "Saldo total con deuda abierta", valor: fmt(saldoTotal), nota: `${num(filas.length)} cuentas priorizadas` },
        { etiqueta: "Concentración Top 5", valor: pctB18(coberturaConcentracion), nota: `${fmt(saldoTop5)} en 5 de ${num(filas.length)} cuentas` },
        { etiqueta: "Saldo priorizado sin gestión", valor: fmt(saldoSin), nota: `${num(sinGestion.length)} de ${num(filas.length)} cuentas · ${pctB18(100 - coberturaGestion)} del saldo` },
        { etiqueta: "Saldo de clientes en mora crítica 90+", valor: fmt(saldoCritico), nota: `${pctB18(coberturaAntiguedad)} — por cliente, no por factura; no compara con Cuadro de mando` },
      ],
      tituloMix: "Score simulado del Top 10",
      preguntaMix: "¿Cómo se reparte el score entre las diez cuentas líderes?",
      tituloCobertura: "Calidad de la lectura",
      preguntaCobertura: "¿Cuánto respalda cada categoría dentro de los priorizados?",
      notaCobertura:
        "Cobertura significa algo distinto en cada categoría: cada una declara la suya en su pie de procedencia. El score no es una probabilidad de cobro.",
      pie:
        "El score de esta worklist es una heurística simulada, con pesos ficticios y sin aprobación de Finanzas — no es una probabilidad de cobro ni una promesa de pago del cliente. Ninguna fórmula de esta pantalla está aprobada por Finanzas.",
    },
  };
}
