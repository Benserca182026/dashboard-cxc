# Estado del Dashboard CxC

**Fecha del documento:** 2026-08-23 · **Repo:** `dashboard-cxc/prototipo` · **HEAD:** `3c1448a`

Este archivo es la **única fuente de verdad** sobre qué está publicado, qué está
verificado, qué está pendiente y de qué depende cada cosa. Si otro documento
contradice a éste, gana éste.

---

## 1. Qué está publicado

Tanda anterior, ya en producción:

| Cambio | Evidencia de que quedó |
|---|---|
| Moneda obligatoria | **0** montos en `$`, **3,248** en `Q` |
| Score de prioritarios con desempate | MOTOCENTER primero; WALMART antes que CEMACO |
| Cliente fantasma eliminado | **0** ids `CLI-xxx` crudos en pantalla |

**URLs sirviendo la versión nueva:**
- `dashboard-cxc-benserca-18.vercel.app`
- `dashboard-cxc-benserca.vercel.app`

**URL sirviendo la versión VIEJA:** `dashboard-cxc.vercel.app` — todavía muestra
los **3,248 montos en dólares**. Vive en el scope anterior de Vercel y **no se
puede reapuntar desde la cuenta actual**. No es un despliegue pendiente: es un
dominio inalcanzable. Cualquiera que abra ese link está viendo datos con la
moneda equivocada.

---

## 2. Qué está verificado (hallazgos cerrados)

### 2.1 Ventas: el total está inflado en Q6,614,436.05

- Mostrado: **26,285,671.61**
- Real: **19,671,235.56**
- Diferencia: **6,614,436.05**

Descomposición **cerrada al centavo**:

| Concepto | Efecto |
|---|---:|
| Descuento no restado | **+6,866,617.56** |
| Presupuestos contados como ventas | **+126,631.14** |
| Cancelados no contados | **−378,812.65** |
| **Total** | **+6,614,436.05** |

**Causa:** `lib/cadena.ts:96` — `importe = cantidad × precio_unitario`, sin
descuento y sin filtrar por estado.

**Por qué no se arregla con una línea de código:** la columna `descuento`
**no existe** — ni en el esquema de Supabase, ni en la interfaz `VentaLinea`
(`lib/types.ts:117-123`), ni en los datos. No hay de dónde restarla.

**Pero la cifra correcta ya está en la base:** `ventas.total_odoo_referencia` =
**19,671,235.56** sobre **3,234 pedidos**. Se puede mostrar el total correcto
hoy mismo; lo que no se puede hoy es el **desglose por línea** ni el **margen**.

### 2.2 Los TRES totales del sistema (no dos)

| Fuente | Monto | Filas |
|---|---:|---:|
| Pedidos (`ventas.total_odoo_referencia`) | 19,671,235.56 | 3,234 |
| Facturas (`monto_original`, no anulada) | 19,326,011.61 | 3,182 |
| Líneas (cantidad × precio) | 26,285,671.61 | 23,869 |

La diferencia de **345,223.95** entre pedidos y facturas es **legítima**:
pedidos sin facturar o facturados parcialmente. **No es un bug.** No hay que
"cuadrarla".

**Sí es un problema:** `facturas.id_venta` está poblado en **0 de 3,182 filas**.
Sin ese vínculo no se puede decir *cuáles* pedidos son los que faltan facturar —
sólo cuánto suman en agregado.

### 2.3 Inventario: la existencia se calcula sin saldo inicial

La existencia es la **suma de movimientos desde 2025-08-22**, sin punto de
partida. `stock.quant` se lee **sólo para SKU y nombre**, no para cantidad.

Consecuencia medible: **ED-11.7.3 da −149 calculadas contra 658 reales.**

### 2.4 Inventario: `stock_minimo` hardcodeado en 0

Escrito a mano en `scripts/importar-inventario-odoo.mjs:119` y `:245`.
Resultado: **0 de 751** productos con mínimo > 0.

Por eso el indicador **"bajo mínimo" degeneró a "existencia ≤ 0"** y marca
**547 de 751 (73%)**. No está midiendo reposición: está contando el bug de 2.3.

### 2.5 Inventario: el −70.9%

Es `766,620.49 / 2,635,102.99 − 1`. El numerador incluye **280 productos con
existencia negativa que restan 872,681.75**. Sin esos negativos el número sería
otro. La caída no es comercial: es aritmética del saldo inicial faltante.

### 2.6 El anillo "valor en riesgo" mostraba 0% valiendo −113.8%

`Argumento.tsx:147` hacía `Math.max(0, Math.min(100, pct))` y usaba ese
resultado para **el arco y para la cifra del centro**. Un déficit mayor que el
total entero se leía como "0%", es decir, como si no pasara nada.

**Estado:** hay un arreglo **en el árbol de trabajo, sin commitear** (`M
components/Argumento.tsx`), propiedad de otro frente: el recorte queda sólo en
el dibujo, el número se imprime con su signo, y el anillo se marca "fuera de
escala". **Verificar en pantalla antes de darlo por publicado.**

### 2.7 `efectividadCohortePct` vale 0% siempre

Cadena completa:
1. `scripts/importar-pagos-odoo.mjs:147` escribe `id_factura: null` para **todos**
   los pagos (decisión deliberada: no declarar una conciliación que no se hizo).
2. `lib/calculos.ts:26` (`pagosAplicados`) filtra por `p.id_factura === factura.id_factura`.
3. Ningún pago matchea nunca → 0%.

La cobranza real **sí entra**, pero por otra puerta: como NotaCredito sintética
`REC-<id_factura>` derivada de `saldo_pendiente_odoo`
(`lib/datosReales.ts:189-205`). O sea que el dinero cobrado está contado, pero
la **efectividad** no se puede medir.

Dos defectos adicionales en el mismo camino:
- `pagosAplicados` **no filtra por fecha de corte**.
- La fecha de corte es **editable** en la UI. Un pago posterior al corte puede
  reducir un saldo que a esa fecha estaba pendiente.

### 2.8 `traerTodo()` pagina sin orden estable

`lib/datosReales.ts:65-85` pagina con header `Range` **sin cláusula `order`**.
PostgREST **no garantiza orden entre páginas**: una fila puede repetirse o
perderse entre la página N y la N+1. En tablas de 23,869 filas esto no es
teórico. Es una fuente de diferencias que aparecen y desaparecen entre recargas,
y por lo tanto una fuente de falsos positivos en cualquier diff futuro.

### 2.9 Pruebas: 76 tests que no tocan los datos reales

- Las **76** corren contra `datosDemo`.
- **Ninguna** importa `cargarDatasetReal`.
- `verificacion/linea-base.mjs` (fuera de este paquete, en la raíz del proyecto)
  **falla desde siempre** y está **fuera de `npm test`** — `package.json` corre
  sólo `test-calculos`, `test-kpis`, `test-cadena`, `test-argumento`.

Traducción: la suite verde **no es evidencia** sobre ninguno de los hallazgos de
la sección 2. Todos se descubrieron fuera de ella.

---

## 3. Qué está pendiente y de qué depende

| Pendiente | Bloqueado por | Se puede hacer sin eso |
|---|---|---|
| Total de ventas correcto en pantalla | — | **Sí**: usar `ventas.total_odoo_referencia` (19,671,235.56) |
| Desglose de venta por línea y **margen** | Export **(a)** `sale.order.line.discount` | No |
| Filtrar presupuestos y cancelados | Export **(a)** `estado_odoo` | No |
| Existencia de inventario correcta | Export **(b)** `stock.quant` + **fecha de corte** | No |
| "Bajo mínimo" que signifique algo | Export **(c)** `product_min_qty` | No |
| Valor de inventario / el −70.9% | Export **(b)** (elimina los 280 negativos) | No |
| `efectividadCohortePct` | Conciliación pago↔factura (`id_factura`) | No |
| Vincular pedidos con facturas | `facturas.id_venta` (0/3,182 poblado) | No |
| Paginación reproducible | Agregar `order` a `traerTodo()` | **Sí**, cambio de código local |
| Corte de fecha único | Archivo de configuración único | **Sí**, cambio de código local |
| Pruebas sobre datos reales | — | **Sí**, pero necesita fixtures congelados |
| `dashboard-cxc.vercel.app` actualizado | Acceso al scope viejo de Vercel | **No** — fuera de alcance |

**Los tres exports son el cuello de botella real.** Ver
[`exports-odoo-pendientes.md`](./exports-odoo-pendientes.md) para la solicitud
lista para mandar, y [`plan-reconstruccion.md`](./plan-reconstruccion.md) para
qué se hace cuando lleguen.

---

## 4. Regla de lectura

Tres números de este documento parecen errores y **no lo son**:

- **345,223.95** (pedidos − facturas): legítimo.
- **0%** de efectividad: no es que no se cobre; es que no se puede medir.
- **Suite de tests en verde**: no cubre nada de la sección 2.

Y un número que parece correcto y **no lo es**: cualquier **agregado de
inventario** que cuadre mientras la existencia se calcule sin saldo inicial. Un
doble conteo se ve idéntico a un dato correcto. Ver la advertencia en los otros
dos documentos.
