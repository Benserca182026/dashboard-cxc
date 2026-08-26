import { calcularAging, nombreDeCliente, type ResultadoAging } from "./calculos";
import { prioridadSimulada } from "./simulados";
import type { Dataset, GestionCobranza, Pago } from "./types";

export type EstadoAgenteComercial = "accion" | "atencion" | "control";

export interface AgenteComercial {
  id: string;
  nombre: string;
  pregunta: string;
  respuesta: string;
  accion: string;
  impacto?: number;
  estado: EstadoAgenteComercial;
  visual?: { etiqueta: string; valor: number; total: number; tono?: "azul" | "ambar" | "rojo" };
}

export interface ClienteVencido {
  idCliente: string;
  nombre: string;
  saldo: number;
  diasMax: number;
  facturas: number;
  enDisputa: boolean;
  responsable: string;
  acumuladoPct: number;
}

export interface FacturaVencida {
  idFactura: string;
  numero: string;
  idCliente: string;
  cliente: string;
  saldo: number;
  dias: number;
  bucket: string;
  enDisputa: boolean;
}

export interface CargaResponsable {
  responsable: string;
  saldo: number;
  clientes: number;
}

export interface AnalisisAgingComercial {
  vencido: number;
  topClientes: ClienteVencido[];
  topFacturas: FacturaVencida[];
  responsables: CargaResponsable[];
  clientesParaOchentaPct: number;
  porcentajeTopDiez: number;
  agentes: AgenteComercial[];
  comparacionHistoricaDisponible: false;
}

export interface FilaPrioridadComercial {
  idCliente: string;
  cliente: string;
  saldo: number;
  dias: number;
  score: number;
  probabilidad: null;
  responsable: string;
  proximaAccion: string;
  enDisputa: boolean;
}

export interface AnalisisPrioritariosComercial {
  filas: FilaPrioridadComercial[];
  topDiez: FilaPrioridadComercial[];
  saldoTotal: number;
  saldoTopDiez: number;
  medianaSaldo: number;
  medianaDias: number;
  agentes: AgenteComercial[];
}

export interface EtapaEmbudo {
  id: "vencido" | "contactado" | "promesa" | "pago";
  etiqueta: string;
  clientes: number;
  aclaracion: string;
}

export interface PromesaSeguimiento {
  idGestion: string;
  cliente: string;
  responsable: string;
  fecha: string | null;
  accion: string;
  estado: "fecha-vencida" | "proxima" | "sin-fecha" | "vigente";
}

export interface ProductividadResponsable {
  responsable: string;
  gestiones: number;
  clientes: number;
  promesas: number;
  clientesConPagoPosterior: number;
  conversionPromesaPct: number;
}

export interface AnalisisSeguimientoComercial {
  embudo: EtapaEmbudo[];
  promesas: PromesaSeguimiento[];
  sinGestion: FilaPrioridadComercial[];
  productividad: ProductividadResponsable[];
  agentes: AgenteComercial[];
  saldoSinGestion: number;
}

const MS_DIA = 86_400_000;

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(hasta.slice(0, 10) + "T00:00:00Z") -
      Date.parse(desde.slice(0, 10) + "T00:00:00Z")) /
      MS_DIA
  );
}

function ultimaGestionPorCliente(gestiones: GestionCobranza[]): Map<string, GestionCobranza> {
  const mapa = new Map<string, GestionCobranza>();
  for (const gestion of gestiones) {
    const anterior = mapa.get(gestion.id_cliente);
    if (!anterior || gestion.fecha_hora > anterior.fecha_hora) {
      mapa.set(gestion.id_cliente, gestion);
    }
  }
  return mapa;
}

function responsableDe(
  idCliente: string,
  ultimas: Map<string, GestionCobranza>
): string {
  return ultimas.get(idCliente)?.responsable || "Sin responsable registrado";
}

function cantidadParaPorcentaje(
  valores: { saldo: number }[],
  total: number,
  objetivo = 80
): number {
  if (total <= 0) return 0;
  let acumulado = 0;
  for (let i = 0; i < valores.length; i++) {
    acumulado += valores[i].saldo;
    if ((acumulado / total) * 100 >= objetivo) return i + 1;
  }
  return valores.length;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
    : ordenados[mitad];
}

function textoEsPromesa(gestion: GestionCobranza): boolean {
  return /promet|promesa/i.test(
    `${gestion.resultado ?? ""} ${gestion.proxima_accion ?? ""}`
  );
}

function pagoAplicado(pago: Pago): boolean {
  return pago.estado_aplicacion !== "no_aplicado" && pago.monto_pago > 0;
}

export function analizarAgingComercial(
  dataset: Dataset,
  fechaCorte: string,
  gestiones: GestionCobranza[],
  agingCalculado?: ResultadoAging
): AnalisisAgingComercial {
  const aging = agingCalculado ?? calcularAging(dataset, fechaCorte);
  const ultimas = ultimaGestionPorCliente(gestiones);
  const vencidas = aging.clasificadas.filter((fila) => fila.dias > 0 && fila.saldo > 0);
  const vencido = redondear2(vencidas.reduce((suma, fila) => suma + fila.saldo, 0));
  const porCliente = new Map<
    string,
    Omit<ClienteVencido, "acumuladoPct" | "responsable">
  >();

  for (const fila of vencidas) {
    const actual = porCliente.get(fila.factura.id_cliente) ?? {
      idCliente: fila.factura.id_cliente,
      nombre: nombreDeCliente(dataset.clientes, fila.factura.id_cliente),
      saldo: 0,
      diasMax: 0,
      facturas: 0,
      enDisputa: false,
    };
    actual.saldo += fila.saldo;
    actual.diasMax = Math.max(actual.diasMax, fila.dias);
    actual.facturas += 1;
    actual.enDisputa ||= fila.estado === "disputada";
    porCliente.set(fila.factura.id_cliente, actual);
  }

  let acumulado = 0;
  const clientesOrdenados: ClienteVencido[] = [...porCliente.values()]
    .sort((a, b) => b.saldo - a.saldo || b.diasMax - a.diasMax)
    .map((fila) => {
      acumulado += fila.saldo;
      return {
        ...fila,
        saldo: redondear2(fila.saldo),
        responsable: responsableDe(fila.idCliente, ultimas),
        acumuladoPct: vencido > 0 ? (acumulado / vencido) * 100 : 0,
      };
    });

  const topFacturas: FacturaVencida[] = [...vencidas]
    .sort((a, b) => b.saldo - a.saldo || b.dias - a.dias)
    .slice(0, 10)
    .map((fila) => ({
      idFactura: fila.factura.id_factura,
      numero: fila.factura.numero_factura,
      idCliente: fila.factura.id_cliente,
      cliente: nombreDeCliente(dataset.clientes, fila.factura.id_cliente),
      saldo: fila.saldo,
      dias: fila.dias,
      bucket: fila.bucket,
      enDisputa: fila.estado === "disputada",
    }));

  const porResponsable = new Map<string, { saldo: number; clientes: Set<string> }>();
  for (const fila of clientesOrdenados) {
    const actual = porResponsable.get(fila.responsable) ?? {
      saldo: 0,
      clientes: new Set<string>(),
    };
    actual.saldo += fila.saldo;
    actual.clientes.add(fila.idCliente);
    porResponsable.set(fila.responsable, actual);
  }
  const responsables = [...porResponsable.entries()]
    .map(([responsable, valor]) => ({
      responsable,
      saldo: redondear2(valor.saldo),
      clientes: valor.clientes.size,
    }))
    .sort((a, b) => b.saldo - a.saldo);

  const clientesParaOchentaPct = cantidadParaPorcentaje(clientesOrdenados, vencido);
  const topClientes = clientesOrdenados.slice(0, 10);
  const saldoTopDiez = topClientes.reduce((suma, fila) => suma + fila.saldo, 0);
  const porcentajeTopDiez = vencido > 0 ? (saldoTopDiez / vencido) * 100 : 0;
  const lider = clientesOrdenados[0] ?? null;
  const gestionables = clientesOrdenados
    .filter((fila) => !fila.enDisputa)
    .slice(0, 5);
  const saldoGestionable = redondear2(
    gestionables.reduce((suma, fila) => suma + fila.saldo, 0)
  );

  const agentes: AgenteComercial[] = [
    {
      id: "prioridad",
      nombre: "Cobro hoy",
      pregunta: "¿A quién debemos gestionar primero?",
      respuesta: lider
        ? `${lider.nombre}: ${lider.diasMax} días de atraso${lider.enDisputa ? " y disputa activa" : ""}.`
        : "No hay clientes con saldo vencido al corte.",
      impacto: lider?.saldo,
      accion: lider
        ? lider.enDisputa
          ? "Resolver la disputa antes de reclamar el pago."
          : "Asignar responsable y registrar el próximo contacto."
        : "Mantener vigilancia sobre el siguiente corte.",
      estado: lider ? "accion" : "control",
      visual: lider ? { etiqueta: "del vencido", valor: lider.saldo, total: vencido, tono: "rojo" } : undefined,
    },
    {
      id: "concentracion",
      nombre: "Concentración",
      pregunta: "¿Cuántos clientes explican el 80% del vencido?",
      respuesta:
        clientesParaOchentaPct > 0
          ? `${clientesParaOchentaPct} de ${clientesOrdenados.length} clientes forman al menos el 80% del saldo vencido.`
          : "No hay saldo vencido que concentrar.",
      impacto: vencido,
      accion: "Trabajar el Pareto antes de repartir esfuerzos sobre toda la cartera.",
      estado: clientesParaOchentaPct > 0 ? "atencion" : "control",
      visual: clientesParaOchentaPct > 0 ? { etiqueta: "clientes para 80%", valor: clientesParaOchentaPct, total: clientesOrdenados.length, tono: "ambar" } : undefined,
    },
    {
      id: "recuperacion",
      nombre: "Monto gestionable",
      pregunta: "¿Qué monto puede ponerse en gestión primero?",
      respuesta:
        gestionables.length > 0
          ? `El Top ${gestionables.length} no disputado reúne saldo vencido listo para gestión; no equivale a una promesa de recuperación.`
          : "No hay saldo vencido no disputado dentro de la primera prioridad.",
      impacto: saldoGestionable,
      accion: "Asignar dueño, fecha y resultado esperado a cada cuenta del Top 5.",
      estado: gestionables.length > 0 ? "accion" : "control",
      visual: gestionables.length > 0 ? { etiqueta: "vencido no disputado", valor: saldoGestionable, total: vencido, tono: "azul" } : undefined,
    },
  ];

  return {
    vencido,
    topClientes,
    topFacturas,
    responsables,
    clientesParaOchentaPct,
    porcentajeTopDiez,
    agentes,
    comparacionHistoricaDisponible: false,
  };
}

export function analizarPrioritariosComercial(
  dataset: Dataset,
  fechaCorte: string,
  gestiones: GestionCobranza[]
): AnalisisPrioritariosComercial {
  const ultimas = ultimaGestionPorCliente(gestiones);
  const filas: FilaPrioridadComercial[] = prioridadSimulada(dataset, fechaCorte).map(
    (fila) => {
      const ultima = ultimas.get(fila.idCliente);
      return {
        idCliente: fila.idCliente,
        cliente: fila.nombreCliente,
        saldo: fila.saldoTotal,
        dias: fila.diasMaxAtraso,
        score: fila.scoreSimulado,
        probabilidad: null,
        responsable: responsableDe(fila.idCliente, ultimas),
        proximaAccion: ultima?.proxima_accion || fila.accionSugerida,
        enDisputa: fila.enDisputa,
      };
    }
  );
  const topDiez = filas.slice(0, 10);
  const saldoTotal = redondear2(filas.reduce((suma, fila) => suma + fila.saldo, 0));
  const saldoTopDiez = redondear2(
    topDiez.reduce((suma, fila) => suma + fila.saldo, 0)
  );
  const paraOchenta = cantidadParaPorcentaje(
    [...filas].sort((a, b) => b.saldo - a.saldo),
    saldoTotal
  );
  const lider = topDiez[0] ?? null;
  const moraCritica = filas.filter((fila) => fila.dias > 90);
  const saldoCritico = redondear2(
    moraCritica.reduce((suma, fila) => suma + fila.saldo, 0)
  );
  const sinResponsable = filas.filter(
    (fila) => fila.responsable === "Sin responsable registrado"
  );
  const primeroSinResponsable = sinResponsable[0] ?? null;

  const agentes: AgenteComercial[] = [
    {
      id: "impacto",
      nombre: "Impacto × urgencia",
      pregunta: "¿Qué cuenta combina mayor impacto y urgencia?",
      respuesta: lider
        ? `${lider.cliente} encabeza la worklist con score simulado ${lider.score}.`
        : "No hay cuentas abiertas que priorizar.",
      impacto: lider?.saldo,
      accion: lider ? lider.proximaAccion : "Mantener vigilancia del próximo corte.",
      estado: lider ? "accion" : "control",
      visual: lider ? { etiqueta: "saldo de la worklist", valor: lider.saldo, total: saldoTotal, tono: "rojo" } : undefined,
    },
    {
      id: "pareto",
      nombre: "Concentración",
      pregunta: "¿Dónde se concentra el saldo de la worklist?",
      respuesta:
        paraOchenta > 0
          ? `${paraOchenta} de ${filas.length} cuentas forman al menos el 80% del saldo abierto.`
          : "No hay saldo abierto para construir el Pareto.",
      impacto: saldoTotal,
      accion: "Revisar primero las cuentas que forman el 80%, no solo el score aislado.",
      estado: paraOchenta > 0 ? "atencion" : "control",
      visual: paraOchenta > 0 ? { etiqueta: "cuentas para 80%", valor: paraOchenta, total: filas.length, tono: "ambar" } : undefined,
    },
    {
      id: "mora",
      nombre: "Escalamiento 90+",
      pregunta: "¿Cuánto está por encima de 90 días?",
      respuesta: `${moraCritica.length} cuenta(s) superan 90 días de atraso máximo.`,
      impacto: saldoCritico,
      accion: "Separar disputa, escalamiento y cobro normal antes del contacto.",
      estado: moraCritica.length > 0 ? "atencion" : "control",
      visual: moraCritica.length > 0 ? { etiqueta: "saldo en 90+", valor: saldoCritico, total: saldoTotal, tono: "rojo" } : undefined,
    },
    {
      id: "accion",
      nombre: "Cobertura de dueño",
      pregunta: "¿Qué prioridad todavía no tiene dueño registrado?",
      respuesta: primeroSinResponsable
        ? `${primeroSinResponsable.cliente} es la primera cuenta sin responsable registrado.`
        : "Todas las cuentas priorizadas tienen un responsable derivado de su última gestión.",
      impacto: primeroSinResponsable?.saldo,
      accion: primeroSinResponsable
        ? `Asignar dueño y ejecutar: ${primeroSinResponsable.proximaAccion}.`
        : "Revisar fechas de las próximas acciones.",
      estado: primeroSinResponsable ? "accion" : "control",
      visual: { etiqueta: "cuentas con dueño", valor: filas.length - sinResponsable.length, total: filas.length, tono: "azul" },
    },
  ];

  return {
    filas,
    topDiez,
    saldoTotal,
    saldoTopDiez,
    medianaSaldo: mediana(filas.map((fila) => fila.saldo)),
    medianaDias: mediana(filas.map((fila) => fila.dias)),
    agentes,
  };
}

export function analizarSeguimientoComercial(
  dataset: Dataset,
  fechaCorte: string,
  gestiones: GestionCobranza[]
): AnalisisSeguimientoComercial {
  const prioridad = analizarPrioritariosComercial(dataset, fechaCorte, gestiones);
  const vencidos = prioridad.filas.filter((fila) => fila.dias > 0);
  const idsVencidos = new Set(vencidos.map((fila) => fila.idCliente));
  const gestionesVencidos = gestiones.filter((g) => idsVencidos.has(g.id_cliente));
  const idsContactados = new Set(gestionesVencidos.map((g) => g.id_cliente));
  const gestionesPromesa = gestionesVencidos.filter(textoEsPromesa);
  const idsPromesa = new Set(gestionesPromesa.map((g) => g.id_cliente));

  const idsPagoPosterior = new Set<string>();
  for (const idCliente of idsPromesa) {
    const primeraPromesa = gestionesPromesa
      .filter((g) => g.id_cliente === idCliente)
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))[0];
    if (!primeraPromesa) continue;
    const tienePago = dataset.pagos.some(
      (p) =>
        p.id_cliente === idCliente &&
        pagoAplicado(p) &&
        p.fecha_pago >= primeraPromesa.fecha_hora.slice(0, 10)
    );
    if (tienePago) idsPagoPosterior.add(idCliente);
  }

  const embudo: EtapaEmbudo[] = [
    {
      id: "vencido",
      etiqueta: "Con saldo vencido",
      clientes: vencidos.length,
      aclaracion: "clientes con días de atraso > 0 al corte",
    },
    {
      id: "contactado",
      etiqueta: "Con gestión",
      clientes: idsContactados.size,
      aclaracion: "clientes vencidos con al menos una gestión registrada",
    },
    {
      id: "promesa",
      etiqueta: "Con promesa documentada",
      clientes: idsPromesa.size,
      aclaracion: "el texto de resultado o próxima acción menciona una promesa",
    },
    {
      id: "pago",
      etiqueta: "Con pago posterior",
      clientes: idsPagoPosterior.size,
      aclaracion: "pago aplicado posterior a la promesa; no prueba causalidad",
    },
  ];

  const promesas: PromesaSeguimiento[] = gestionesPromesa
    .map((gestion) => {
      const fecha = gestion.fecha_proxima_accion ?? null;
      const diasHasta = fecha ? diasEntre(fechaCorte, fecha) : null;
      let estado: PromesaSeguimiento["estado"] = "sin-fecha";
      if (diasHasta != null && diasHasta < 0) estado = "fecha-vencida";
      else if (diasHasta != null && diasHasta <= 7) estado = "proxima";
      else if (diasHasta != null) estado = "vigente";
      return {
        idGestion: gestion.id_gestion,
        cliente: nombreDeCliente(dataset.clientes, gestion.id_cliente),
        responsable: gestion.responsable,
        fecha,
        accion: gestion.proxima_accion || gestion.resultado || "Promesa documentada",
        estado,
      };
    })
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha.localeCompare(b.fecha);
    });

  const sinGestion = vencidos.filter((fila) => !idsContactados.has(fila.idCliente));
  const saldoSinGestion = redondear2(
    sinGestion.reduce((suma, fila) => suma + fila.saldo, 0)
  );
  const responsables = new Map<string, GestionCobranza[]>();
  for (const gestion of gestionesVencidos) {
    const propias = responsables.get(gestion.responsable) ?? [];
    propias.push(gestion);
    responsables.set(gestion.responsable, propias);
  }
  const productividad: ProductividadResponsable[] = [...responsables.entries()]
    .map(([responsable, propias]) => {
      const clientes = new Set(propias.map((g) => g.id_cliente));
      const promesasPropias = propias.filter(textoEsPromesa);
      const clientesConPagoPosterior = new Set(
        promesasPropias
          .map((g) => g.id_cliente)
          .filter((id) => idsPagoPosterior.has(id))
      ).size;
      return {
        responsable,
        gestiones: propias.length,
        clientes: clientes.size,
        promesas: promesasPropias.length,
        clientesConPagoPosterior,
        conversionPromesaPct:
          propias.length > 0 ? (promesasPropias.length / propias.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.gestiones - a.gestiones);

  const vencidasSinCierre = promesas.filter((p) => p.estado === "fecha-vencida");
  const proximas = promesas.filter((p) => p.estado === "proxima");
  const primeroSinGestion = sinGestion[0] ?? null;
  const moraSinAccion = sinGestion.filter((fila) => fila.dias > 90);
  const saldoMoraSinAccion = redondear2(
    moraSinAccion.reduce((suma, fila) => suma + fila.saldo, 0)
  );

  const saldoVencidoSeguimiento = redondear2(vencidos.reduce((suma, fila) => suma + fila.saldo, 0));
  const agentes: AgenteComercial[] = [
    {
      id: "siguiente",
      nombre: "Cola sin gestión",
      pregunta: "¿A quién debe contactar cobranza ahora?",
      respuesta: primeroSinGestion
        ? `${primeroSinGestion.cliente} es la cuenta vencida de mayor prioridad sin gestión.`
        : "No hay cuentas vencidas sin una gestión registrada.",
      impacto: primeroSinGestion?.saldo,
      accion: primeroSinGestion
        ? primeroSinGestion.proximaAccion
        : "Continuar con las próximas acciones ya registradas.",
      estado: primeroSinGestion ? "accion" : "control",
      visual: primeroSinGestion ? { etiqueta: "saldo sin gestión", valor: primeroSinGestion.saldo, total: saldoVencidoSeguimiento, tono: "rojo" } : undefined,
    },
    {
      id: "promesas",
      nombre: "Embudo de promesas",
      pregunta: "¿Qué compromisos están vencidos o próximos?",
      respuesta: `${vencidasSinCierre.length} promesa(s) con fecha vencida sin cierre registrado y ${proximas.length} con fecha dentro de 7 días.`,
      accion: "Verificar primero las fechas vencidas; el dato no permite llamarlas incumplidas sin confirmar el resultado.",
      estado: vencidasSinCierre.length > 0 ? "atencion" : "control",
      visual: { etiqueta: "promesas con fecha vencida", valor: vencidasSinCierre.length, total: Math.max(promesas.length, 1), tono: "ambar" },
    },
    {
      id: "cobertura",
      nombre: "Cobertura de gestión",
      pregunta: "¿Cuánto vencido todavía no tiene gestión?",
      respuesta: `${sinGestion.length} de ${vencidos.length} clientes vencidos no tienen contacto registrado.`,
      impacto: saldoSinGestion,
      accion: "Asignar responsable y fecha de primer contacto al Top sin gestión.",
      estado: sinGestion.length > 0 ? "accion" : "control",
      visual: { etiqueta: "saldo con gestión", valor: saldoVencidoSeguimiento - saldoSinGestion, total: saldoVencidoSeguimiento, tono: "azul" },
    },
    {
      id: "riesgo",
      nombre: "Mora sin acción",
      pregunta: "¿Qué mora crítica sigue sin acción?",
      respuesta: `${moraSinAccion.length} cuenta(s) por encima de 90 días siguen sin gestión registrada.`,
      impacto: saldoMoraSinAccion,
      accion: "Separar disputa, escalamiento y cobranza normal antes de asignar el siguiente paso.",
      estado: moraSinAccion.length > 0 ? "atencion" : "control",
      visual: { etiqueta: "saldo 90+ sin gestión", valor: saldoMoraSinAccion, total: saldoVencidoSeguimiento, tono: "rojo" },
    },
  ];

  return {
    embudo,
    promesas,
    sinGestion,
    productividad,
    agentes,
    saldoSinGestion,
  };
}
