import type { Dataset, Producto, Venta, VentaLinea } from "./types";

export type AgenteProductoVentas = "familia" | "tipo" | "modelo" | "licencia";
export type VisualProducto = "dona" | "barras" | "pareto";

export type FilaAgenteProducto = {
  nombre: string;
  productos: number;
  valor: number;
  pct: number;
  pedidos: number;
  unidades: number;
};

export type LecturaAgenteProducto = {
  iniciales: string;
  nombre: string;
  senal: string;
  titulo: string;
  explicacion: string;
  hallazgo: string;
  problema: string;
  accion: string;
  kpiPct: number;
  kpiEtiqueta: string;
  pregunta: string;
  kpiVisual: VisualProducto;
  filas: FilaAgenteProducto[];
  cobertura: number;
};

type Clasificacion = {
  familia: string | null;
  tipo: string | null;
  modelo: string | null;
  licencia: string | null;
};

type LineaComercial = VentaLinea & {
  venta: Venta;
  producto: Producto;
  valor: number;
  clasificacion: Clasificacion;
};

const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const redondear = (valor: number) => Math.round(valor * 100) / 100;
const lecturasPorDataset = new WeakMap<Dataset, Record<AgenteProductoVentas, LecturaAgenteProducto>>();

/**
 * Clasificación deliberadamente inferida y local: no escribe catálogo ni Odoo.
 * Las reglas son visibles para que negocio pueda validar cada extensión.
 */
function clasificar(producto: Producto): Clasificacion {
  const texto = normalizar(`${producto.sku} ${producto.nombre_producto}`);
  let familia: string | null = null;
  let tipo: string | null = null;
  let modelo: string | null = null;
  let licencia: string | null = null;

  // Un casco puede mencionar visor; la categoría principal debe ganar.
  if (/\bCASCO\b/.test(texto)) familia = "Cascos";
  else if (/\b(VISOR|FORRO|MECANISMO|TORNILLO|TUERCA|REPUESTO|REPUESTOS)\b/.test(texto)) familia = "Repuestos de casco";
  else if (/\b(LLANTA|LLANTAS|TUBO|TUBOS)\b/.test(texto)) familia = "Llantas y cámaras";
  else if (/\b(JACKET|CHAQUETA|IMPERMEABLE|GUANTE|GUANTES)\b/.test(texto)) familia = "Indumentaria";
  else if (/\b(BOMBA|CORREA|FILTRO|BUJIA|DISCO DE CLUTCH)\b/.test(texto)) familia = "Repuestos de moto";
  else if (/\b(KIT|PROTECCION|CODERAS|RODILLERAS)\b/.test(texto)) familia = "Protección y accesorios";

  if (familia === "Cascos") {
    if (/CROSS MODULAR/.test(texto)) tipo = "Cross Modular";
    else if (/CASCO MODULAR/.test(texto)) tipo = "Modular";
    else if (/CASCO INTEGRAL/.test(texto)) tipo = "Integral";
    else if (/CASCO ABATIBLE/.test(texto)) tipo = "Abatible";
  }

  const aliasModelos: [RegExp, string][] = [
    [/\bBOSTON\b/, "Boston"], [/\b(SHANGAI|SHANGHAI)\b/, "Shangai"],
    [/\bFRANKIE\b/, "Frankie"], [/\bKOMBAT\b/, "Kombat"], [/\bPILOT\b/, "Pilot"],
    [/\bCHEKO\b/, "Cheko"], [/\bBOSS\b/, "Boss"], [/\bSHENZHEN\b/, "Shenzhen"],
    [/\bLEXUS\b/, "Lexus"], [/\bZOOM\b/, "Zoom"], [/\bJET 2\b/, "Jet 2"],
    [/\bSTARK\b/, "Stark"], [/\bRUNNER\b/, "Runner"], [/\bW2\b/, "W2"],
    [/\bEXTREME\b/, "Extreme"], [/\bKOBRA\b/, "Kobra"],
  ];
  for (const [regla, nombre] of aliasModelos) {
    if (regla.test(texto)) { modelo = nombre; break; }
  }

  if (/DC COMICS|BATMAN|SUPERMAN/.test(texto)) licencia = "DC Comics";
  else if (/MARVEL|SPIDERMAN|WOLVERINE|AVENGERS/.test(texto)) licencia = "Marvel";
  else if (/LOONEY/.test(texto)) licencia = "Looney Tunes";
  else if (/BOB ESPONJA/.test(texto)) licencia = "Bob Esponja";

  return { familia, tipo, modelo, licencia };
}

function filasPor(items: LineaComercial[], atributo: keyof Clasificacion, etiquetaSinSenal: string): { filas: FilaAgenteProducto[]; cobertura: number } {
  const total = items.reduce((suma, item) => suma + item.valor, 0);
  const grupos = new Map<string, { valor: number; productos: Set<string>; pedidos: Set<string>; unidades: number }>();
  for (const item of items) {
    const nombre = item.clasificacion[atributo] ?? etiquetaSinSenal;
    const grupo = grupos.get(nombre) ?? { valor: 0, productos: new Set(), pedidos: new Set(), unidades: 0 };
    grupo.valor += item.valor;
    grupo.productos.add(item.id_producto);
    grupo.pedidos.add(item.id_venta);
    grupo.unidades += item.cantidad;
    grupos.set(nombre, grupo);
  }
  const filas = [...grupos.entries()].map(([nombre, grupo]) => ({
    nombre,
    productos: grupo.productos.size,
    valor: redondear(grupo.valor),
    pct: total > 0 ? redondear((grupo.valor / total) * 100) : 0,
    pedidos: grupo.pedidos.size,
    unidades: redondear(grupo.unidades),
  })).sort((a, b) => b.valor - a.valor);
  const sinSenal = filas.find((fila) => fila.nombre === etiquetaSinSenal)?.valor ?? 0;
  return { filas, cobertura: total > 0 ? redondear(100 - (sinSenal / total) * 100) : 0 };
}

/** Fuente única para los cuatro agentes: pedidos Odoo confirmados + líneas + SKU. */
export function construirLecturasProductoVentas(dataset: Dataset): Record<AgenteProductoVentas, LecturaAgenteProducto> {
  const lecturaEnCache = lecturasPorDataset.get(dataset);
  if (lecturaEnCache) return lecturaEnCache;
  const productos = new Map((dataset.productos ?? []).map((producto) => [producto.id_producto, producto]));
  const ventas = new Map((dataset.ventas ?? []).filter((venta) => venta.estado_odoo === "sale").map((venta) => [venta.id_venta, venta]));
  const lineas: LineaComercial[] = (dataset.ventaLineas ?? []).flatMap((linea) => {
    const venta = ventas.get(linea.id_venta);
    const producto = productos.get(linea.id_producto);
    if (!venta || !producto) return [];
    return [{ ...linea, venta, producto, valor: linea.cantidad * linea.precio_unitario, clasificacion: clasificar(producto) }];
  });

  const familia = filasPor(lineas, "familia", "Sin clasificar");
  const cascos = lineas.filter((linea) => linea.clasificacion.familia === "Cascos");
  const tipo = filasPor(cascos, "tipo", "Sin clasificar");
  const modelo = filasPor(cascos, "modelo", "Sin clasificar");
  const licencia = filasPor(cascos, "licencia", "Sin señal de licencia");
  const principal = (filas: FilaAgenteProducto[]) => filas.find((fila) => !fila.nombre.startsWith("Sin ")) ?? filas[0] ?? { nombre: "Sin señal", productos: 0, valor: 0, pct: 0, pedidos: 0, unidades: 0 };
  const pendiente = (filas: FilaAgenteProducto[], etiqueta: string) => filas.find((fila) => fila.nombre === etiqueta) ?? { nombre: etiqueta, productos: 0, valor: 0, pct: 0, pedidos: 0, unidades: 0 };
  const fa = principal(familia.filas), tc = principal(tipo.filas), mo = principal(modelo.filas), li = principal(licencia.filas);
  const faPendiente = pendiente(familia.filas, "Sin clasificar");
  const tcPendiente = pendiente(tipo.filas, "Sin clasificar");
  const moPendiente = pendiente(modelo.filas, "Sin clasificar");
  const liPendiente = pendiente(licencia.filas, "Sin señal de licencia");

  const resultado = {
    familia: {
      iniciales: "FA", nombre: "Familias", senal: `${fa.nombre} · ${fa.pct.toFixed(2)}% de composición`,
      titulo: "¿Qué familia sostiene la venta?", pregunta: "¿Qué familia sostiene la venta?", kpiVisual: "dona",
      explicacion: "Lee líneas de pedidos confirmados y agrupa su composición a precio de lista por familia inferida desde SKU y nombre.",
      hallazgo: `${fa.nombre} reúne ${fa.pct.toFixed(2)}% de la composición; ${fa.pedidos.toLocaleString("es-GT")} pedidos la incluyen.`,
      problema: faPendiente.valor > 0 ? `${faPendiente.productos} SKU aún no tienen familia inferida y representan ${faPendiente.pct.toFixed(2)}% de la composición.` : "La familia está completamente identificada en este corte.",
      accion: "Usar el Pareto para decidir profundidad de surtido, exposición y campañas por familia.",
      kpiPct: fa.pct, kpiEtiqueta: fa.nombre, filas: familia.filas.slice(0, 5), cobertura: familia.cobertura,
    },
    tipo: {
      iniciales: "TC", nombre: "Tipo de casco", senal: `${tc.nombre} · ${tc.pct.toFixed(2)}% del mix de cascos`,
      titulo: "¿Qué tipo de casco domina la demanda?", pregunta: "¿Qué tipo de casco domina el mix?", kpiVisual: "barras",
      explicacion: "Limita la lectura a líneas clasificadas como Cascos y separa Integral, Modular, Abatible y Cross Modular.",
      hallazgo: `${tc.nombre} aporta ${tc.pct.toFixed(2)}% de la composición de cascos y aparece en ${tc.pedidos.toLocaleString("es-GT")} pedidos.`,
      problema: tcPendiente.valor > 0 ? `${tcPendiente.productos} SKU de casco aún no distinguen su tipo comercial.` : "El tipo de casco está identificado en este corte.",
      accion: "Separar los tipos para asignar compra, exhibición y campañas según demanda observada.",
      kpiPct: tc.pct, kpiEtiqueta: tc.nombre, filas: tipo.filas.slice(0, 5), cobertura: tipo.cobertura,
    },
    modelo: {
      iniciales: "MO", nombre: "Modelos", senal: `${mo.nombre} · ${mo.pct.toFixed(2)}% de composición de cascos`,
      titulo: "¿Qué modelos explican la facturación?", pregunta: "¿Qué modelos explican la facturación?", kpiVisual: "pareto",
      explicacion: "Reconoce modelos desde nombre y SKU, normalizando equivalencias comerciales como Shangai y Shanghai.",
      hallazgo: `${mo.nombre} lidera los modelos identificados con ${mo.pct.toFixed(2)}% de la composición de cascos.`,
      problema: moPendiente.valor > 0 ? `${moPendiente.productos} SKU de casco no resuelven todavía a un modelo; equivalen a ${moPendiente.pct.toFixed(2)}% de la composición.` : "Todos los cascos resuelven a un modelo en este corte.",
      accion: "Priorizar aliases y nuevos modelos por valor y pedidos antes de decidir reposición o promoción.",
      kpiPct: mo.pct, kpiEtiqueta: mo.nombre, filas: modelo.filas.filter((fila) => fila.nombre !== "Sin clasificar").slice(0, 5), cobertura: modelo.cobertura,
    },
    licencia: {
      iniciales: "LI", nombre: "Licencias", senal: `${li.nombre} · ${li.pct.toFixed(2)}% con señal identificada`,
      titulo: "¿Qué propiedades comerciales aparecen en la venta?", pregunta: "¿Qué peso comercial tienen las licencias?", kpiVisual: "dona",
      explicacion: "Una licencia sólo se declara cuando el SKU o nombre muestra una señal comercial reconocible; la ausencia no demuestra que no exista.",
      hallazgo: `${li.nombre} es la señal de licencia identificada de mayor composición, con ${li.pedidos.toLocaleString("es-GT")} pedidos.`,
      problema: `${liPendiente.pct.toFixed(2)}% de la composición de cascos no trae señal de licencia en el nombre; se mantiene como incertidumbre, no como producto sin licencia.`,
      accion: "Contrastar las licencias identificadas con el maestro comercial antes de definir una campaña por propiedad.",
      kpiPct: li.pct, kpiEtiqueta: li.nombre, filas: licencia.filas.filter((fila) => fila.nombre !== "Sin señal de licencia").slice(0, 5), cobertura: licencia.cobertura,
    },
  } satisfies Record<AgenteProductoVentas, LecturaAgenteProducto>;
  lecturasPorDataset.set(dataset, resultado);
  return resultado;
}
