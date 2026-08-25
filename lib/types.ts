// Modelo de datos del prototipo — transcripción directa de paso-4-modelo-datos.md.
// Todo dato que circule por estos tipos es FICTICIO en este prototipo.

export type EstadoCliente = "activo" | "inactivo";
export type EstadoFactura = "abierta" | "pagada" | "anulada" | "disputada";
export type EstadoAplicacionPago = "aplicado" | "no_aplicado" | "parcial";
export type EstadoNotaCredito = "aplicada" | "pendiente" | "anulada";
export type EstadoDisputa = "abierta" | "en_revision" | "resuelta" | "rechazada";
export type TipoGestion =
  | "llamada"
  | "email"
  | "carta"
  | "visita"
  | "escalamiento_legal"
  | "otro";
export type SlaEstado = "en_plazo" | "vencido" | "cumplido" | "no_aplica";

export interface Cliente {
  id_cliente: string;
  nombre_cliente: string;
  identificacion_fiscal?: string;
  estado_cliente: EstadoCliente;
  condiciones_pago_default_id?: string;
  fecha_creacion: string; // ISO yyyy-mm-dd
}

export interface Factura {
  id_factura: string;
  id_cliente: string;
  numero_factura: string;
  fecha_emision: string;
  /** Puede faltar en datos importados — en ese caso la factura se EXCLUYE del aging y se reporta (regla M6/Paso 6). */
  fecha_vencimiento: string | null;
  monto_original: number;
  moneda_id: string;
  /** Estado BASE registrado. El estado operativo se deriva con `estadoFacturaDerivado` (regla 2.1 del Paso 4). */
  estado_factura: EstadoFactura;
  /** Paso 11: venta que originó esta factura. Opcional para no romper datos importados solo-CxC. */
  id_venta?: string;
}

export interface Pago {
  id_pago: string;
  id_factura: string | null; // nullable: pagos no aplicados/anticipos
  id_cliente: string;
  fecha_pago: string;
  monto_pago: number;
  moneda_id: string;
  estado_aplicacion: EstadoAplicacionPago;
  referencia_pago?: string;
}

export interface NotaCredito {
  id_nota_credito: string;
  id_factura: string | null; // nullable: notas generales al cliente
  id_cliente: string;
  fecha_emision: string;
  monto_nota_credito: number;
  moneda_id: string;
  motivo?: string;
  estado_nota_credito: EstadoNotaCredito;
}

export interface Disputa {
  id_disputa: string;
  id_factura: string;
  id_cliente: string;
  fecha_apertura: string;
  fecha_resolucion: string | null;
  motivo_disputa?: string;
  monto_disputado: number;
  estado_disputa: EstadoDisputa;
}

export interface GestionCobranza {
  id_gestion: string;
  id_cliente: string;
  id_factura: string | null;
  responsable: string;
  fecha_hora: string;
  tipo_gestion: TipoGestion;
  resultado?: string;
  proxima_accion?: string;
  fecha_proxima_accion?: string;
  sla_estado: SlaEstado;
  notas?: string;
  creado_por: string;
  fecha_creacion: string;
  modificado_por?: string;
  fecha_modificacion?: string;
}

// ── Paso 11 — cadena Ventas e Inventario (alcance declarado 2026-08-15) ──
// El hecho se guarda UNA vez: una venta genera su factura (Factura.id_venta) y
// su salida de inventario (MovimientoInventario.id_venta). CxC, Ventas e
// Inventario son tres vistas de esa cadena, no tres depósitos.

export type TipoMovimientoInventario = "entrada" | "salida" | "ajuste";

export interface Producto {
  id_producto: string;
  sku: string;
  nombre_producto: string;
  costo_unitario: number;
  precio_unitario: number;
  /** Umbral de reposición. NO es el stock: la existencia SIEMPRE se deriva de los movimientos. */
  stock_minimo: number;
}

export interface Venta {
  id_venta: string;
  id_cliente: string;
  fecha_venta: string;
  /** Moneda propia del pedido, recuperada de sale.order.currency_id. */
  moneda_id?: Moneda | null;
  /**
   * Capa "hecho": el total que Odoo cerró para este pedido
   * (ventas.total_odoo_referencia), con el descuento YA aplicado.
   * Opcional: un CSV solo-CxC o el dataset demo no lo traen.
   *
   * Nota histórica: acá decía "el total NO se guarda: es Σ(cantidad × precio)
   * de sus líneas". Eso es cierto para un modelo donde las líneas traen el
   * descuento. En ESTE export de Odoo no lo traen, así que Σ líneas es el
   * pedido a precio de lista — otra magnitud, no el total vendido.
   */
  total_referencia?: Cifra<"hecho"> | null;
  /** Estado del pedido tal como lo escribió Odoo ("sale", "draft", "sent", "Cancelado"). */
  estado_odoo?: string | null;
}

export interface VentaLinea {
  id_linea: string;
  id_venta: string;
  id_producto: string;
  cantidad: number;
  precio_unitario: number;
}

export interface MovimientoInventario {
  id_movimiento: string;
  id_producto: string;
  fecha: string;
  tipo: TipoMovimientoInventario;
  /** Negativa en salidas. La existencia es la suma de esta columna. */
  cantidad: number;
  /** Si nació de una venta, queda dicho cuál: el descuento es auditable. */
  id_venta: string | null;
  motivo?: string;
  /** Ubicaciones que Odoo sí entregó para entradas/salidas. Son trazabilidad
   *  del movimiento, no una afirmación de existencia actual por bodega. */
  ubicacion_desde?: string | null;
  ubicacion_hasta?: string | null;
}

export interface CondicionPago {
  id_condicion_pago: string;
  nombre: string;
  dias_credito: number;
}

export interface Dataset {
  clientes: Cliente[];
  facturas: Factura[];
  pagos: Pago[];
  notasCredito: NotaCredito[];
  disputas: Disputa[];
  condicionesPago: CondicionPago[];
  /** Origen del dataset — para que la UI siempre declare de dónde salen los datos. */
  fuente: "demo-ficticio" | "csv-importado" | "odoo-real";
  /** Paso 11 — opcionales: un CSV solo-CxC sigue siendo un Dataset válido. */
  productos?: Producto[];
  ventas?: Venta[];
  ventaLineas?: VentaLinea[];
  movimientosInventario?: MovimientoInventario[];
}

// ── PROCEDENCIA — de qué capa viene cada número (2026-08-23) ────────────────
//
// El sistema tiene DOS capas de números sobre ventas, y NO son la misma cosa:
//
//   "hecho"        el pedido tal como Odoo lo cerró — ventas.total_odoo_referencia.
//                  Ya trae aplicado el descuento realmente otorgado.
//   "composicion"  lo que se reconstruye sumando líneas (cantidad × precio_unitario).
//                  El export de líneas NO trae la columna descuento: esa suma es
//                  el pedido A PRECIO DE LISTA, no lo vendido.
//
// Sobre los datos reales, los pedidos en estado "sale" dan 26,159,040.47 de
// líneas contra 19,292,422.91 de referencia. Un número que divida numerador de
// una capa entre denominador de la otra no está sesgado: NO SIGNIFICA NADA.
//
// CORRECCIÓN 2026-08-24 (docs/hallazgos-odoo-en-vivo.md): acá decía que esa
// diferencia era "Q6,866,617.56 de descuento no restado". La cifra estaba bien;
// el NOMBRE estaba mal. Esa resta compara una suma de líneas SIN impuesto
// contra un total CON impuesto, así que mete el IVA adentro y mezcla dos
// efectos opuestos. Separados, sobre pedidos no cancelados:
//
//   descuento real   Q8,974,256.21   (26,285,671.61 bruto − 17,311,415.40 neto)
//   IVA (12%)        Q2,067,019.16   (19,292,422.91 − 17,225,403.75)
//
// El descuento es MAYOR que la brecha observada; el IVA lo compensa en parte.
// Quien vaya a mostrar "lo vendido" tiene que decidir EXPLÍCITAMENTE si la
// cifra es con o sin IVA: son 2.07 millones de diferencia, y ninguna de las dos
// respuestas es la obvia. Esa decisión es de Finanzas, no del código.
//
// Por eso el número no viaja como `number` suelto sino dentro de `Cifra<C>`,
// que lleva su capa en el TIPO. Sumar, restar o comparar exige la misma capa;
// mezclarlas no es un error de disciplina que alguien deba recordar, es un
// error de compilación. El valor crudo vive en un campo privado (#valor): no
// se puede leer sin pasar por `valorParaMostrar()`, que existe únicamente para
// formatear en pantalla.
//
// La ÚNICA comparación legítima entre capas es medir la brecha entre ellas, y
// vive en una sola función con nombre propio: `brechaEntreCapas()` en
// lib/cadena.ts. Si aparece una segunda, es un bug.

// ── LA TERCERA CAPA: "conversion" (moneda) ─────────────────────────────────
//
// El primer bug de este proyecto fue montos en QUETZALES rotulados como
// DÓLARES. La lección no es "poner bien el rótulo": es que un monto en dólares
// NO ES EL MISMO HECHO que el monto en quetzales del que salió. Es el mismo
// dinero bajo otra razón formal — una LECTURA derivada, que depende de un tipo
// de cambio con fuente y fecha. Sin esa tasa declarada, no existe.
//
// Por eso la conversión es una capa más, con las mismas garantías que las otras
// dos: `Cifra<"conversion">` es INVARIANTE, así que no se puede sumar, restar
// ni comparar contra un `Cifra<"hecho">` ni contra un `Cifra<"composicion">`.
// Eso hace que la regla dura —EL CAMBIO ES DE VISTA, NUNCA DE DATO— deje de
// depender de que alguien se acuerde: un umbral, una tolerancia o un cuadre
// calculado sobre dólares NO COMPILA.
//
// El quetzal es la moneda de REGISTRO y el predeterminado siempre. El dólar es
// una vista derivada que sólo se pinta, nunca se calcula.

export type Capa = "hecho" | "composicion" | "conversion";

export type Moneda = "GTQ" | "USD";

/** La moneda en que están los hechos. No es configurable: es lo que dice el
 *  dato de origen (ver `moneda_id`, con default 'GTQ' en el esquema real). */
export const MONEDA_DE_REGISTRO: Moneda = "GTQ";

/**
 * Un tipo de cambio USABLE. Los tres primeros campos son obligatorios a
 * propósito: una tasa sin fuente y sin fecha no es un tipo de cambio, es un
 * número inventado, y con él la conversión sería exactamente el bug original
 * con más pasos. PROHIBIDO construir uno con una tasa "razonable" de memoria.
 */
export interface TipoCambio {
  /** Cuántos quetzales vale un dólar. */
  quetzalesPorDolar: number;
  /** Quién publica la tasa (p. ej. "Banco de Guatemala, tipo de cambio de referencia"). */
  fuente: string;
  /** A qué fecha rige. Una tasa sin fecha no dice nada: cambia todos los días. */
  fecha: string;
  /** Dónde verificarla. */
  enlace?: string;
}

/**
 * Por qué la vista en dólares NO está disponible. Se muestra en el control
 * deshabilitado con el mismo vocabulario que el estado "sin-dato": qué falta,
 * qué se pierde, cómo se llena.
 */
export interface MotivoSinTipoCambio {
  queFalta: string;
  consecuencia: string;
  comoSeLlena: string;
}

export class Cifra<C extends Capa> {
  readonly capa: C;
  #valor: number;

  /**
   * Fantasma. Nunca existe en runtime; está para que la capa sea INVARIANTE:
   * sin él, `Cifra<"hecho">` sería asignable a `Cifra<"hecho" | "composicion">`
   * y una lista mixta compilaría. Con él, no.
   */
  declare readonly _capaInvariante?: (c: C) => C;

  private constructor(capa: C, valor: number) {
    this.capa = capa;
    this.#valor = Math.round(valor * 100) / 100;
  }

  /** Capa "hecho": derivado de ventas.total_odoo_referencia. */
  static hecho(valor: number): Cifra<"hecho"> {
    return new Cifra("hecho", valor);
  }

  /** Capa "composicion": derivado de líneas (cantidad × precio de lista). */
  static composicion(valor: number): Cifra<"composicion"> {
    return new Cifra("composicion", valor);
  }

  static cero<C2 extends Capa>(capa: C2): Cifra<C2> {
    return new Cifra(capa, 0);
  }

  /**
   * Capa "conversion": el MISMO dinero leído en otra moneda.
   *
   * No hay un `Cifra.conversion(n)` suelto a propósito. La ÚNICA manera de
   * fabricar esta capa es pasando por acá, y acá exige un `TipoCambio`
   * completo — con fuente y fecha. Así es imposible que aparezca un monto en
   * dólares sin una tasa declarada detrás: no es una convención que haya que
   * respetar, es la única puerta que existe.
   *
   * Es `static` y toma los quetzales como `number` porque convierte desde
   * CUALQUIER capa: el hecho y la composición son ambos quetzales, y el
   * resultado deja de pertenecer a la capa de origen — pasa a ser una lectura.
   */
  static enDolares(quetzales: number, tc: TipoCambio): Cifra<"conversion"> {
    if (!(tc.quetzalesPorDolar > 0)) {
      // Una tasa de 0 o negativa no es una tasa. Antes de dividir por ella y
      // devolver Infinity con cara de monto, se corta acá.
      throw new Error(
        `Tipo de cambio inválido (${tc.quetzalesPorDolar}): la conversión no se hace con una tasa que no lo es.`
      );
    }
    return new Cifra("conversion", quetzales / tc.quetzalesPorDolar);
  }

  /** Suma una lista homogénea. La capa se declara explícita para que la lista vacía siga teniendo procedencia. */
  static sumar<C2 extends Capa>(capa: C2, cifras: readonly Cifra<C2>[]): Cifra<C2> {
    let acumulado = 0;
    for (const c of cifras) acumulado += c.#valor;
    return new Cifra(capa, acumulado);
  }

  mas(otra: Cifra<C>): Cifra<C> {
    return new Cifra(this.capa, this.#valor + otra.#valor);
  }

  menos(otra: Cifra<C>): Cifra<C> {
    return new Cifra(this.capa, this.#valor - otra.#valor);
  }

  /** Reparto porcentual DENTRO de una misma capa. null si la base es 0. */
  porcentajeDe(base: Cifra<C>): number | null {
    if (base.#valor === 0) return null;
    return (this.#valor / base.#valor) * 100;
  }

  /** Promedio dentro de la capa (p. ej. ticket promedio). null si n <= 0. */
  entre(n: number): Cifra<C> | null {
    if (n <= 0) return null;
    return new Cifra(this.capa, this.#valor / n);
  }

  mayorQue(otra: Cifra<C>): boolean {
    return this.#valor > otra.#valor;
  }

  esCero(): boolean {
    return this.#valor === 0;
  }

  /**
   * Salida a `number`. Existe SOLO para formatear en pantalla o para medir la
   * brecha entre capas en `brechaEntreCapas()`. Usarlo para volver a calcular
   * (dividir, sumar) tira por la borda toda la garantía de arriba.
   */
  valorParaMostrar(): number {
    return this.#valor;
  }
}

export type BucketAging = "actual" | "1-30" | "31-60" | "61-90" | "90+";

export const BUCKETS: BucketAging[] = ["actual", "1-30", "31-60", "61-90", "90+"];
