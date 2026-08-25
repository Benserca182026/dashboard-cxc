# Exports de Odoo pendientes — solicitud lista para mandar

**Para:** quien tenga acceso de administrador a Odoo
**De:** proyecto Dashboard CxC
**Fecha:** 2026-08-23

Son **tres exports**. Cada uno desbloquea una cifra que hoy el dashboard muestra
mal. Formato preferido: CSV con encabezados, UTF-8, separador coma. Un archivo
por export.

---

## Resumen: qué desbloquea cada uno y cuánto vale

| Export | Desbloquea | Vale |
|---|---|---|
| **(a)** `sale.order.line` | Total de ventas correcto por línea, margen real, y filtro de presupuestos/cancelados | **Q6,614,436.05** de inflado (26,285,671.61 → 19,671,235.56) |
| **(b)** `stock.quant` + fecha de corte | Saldo inicial de inventario: la existencia deja de ser negativa | **ED-11.7.3: de −149 a 658**; corrige los **280 productos negativos** que restan **872,681.75** y el **−70.9%** |
| **(c)** `stock.warehouse.orderpoint` | Que "bajo mínimo" signifique reposición y no "existencia ≤ 0" | El indicador hoy marca **547 de 751 (73%)**; con mínimos reales pasa a ser accionable |

---

## (a) `sale.order.line` — líneas de pedido de venta

**Modelo:** `sale.order.line`

**Campos requeridos:**

| Campo | Por qué |
|---|---|
| `id` | Clave de la línea |
| `order_id` | Vincula con el pedido |
| `product_id` | Vincula con el producto |
| `product_uom_qty` | Cantidad (ya lo tenemos, sirve de control) |
| `price_unit` | Precio unitario (ya lo tenemos, sirve de control) |
| **`discount`** | **El campo que falta.** Hoy no existe en el esquema, ni en la interfaz `VentaLinea`, ni en los datos |
| **`price_subtotal`** | Importe ya neto de descuento. Es el control cruzado: `qty × price_unit × (1 − discount/100)` debe dar exactamente esto |
| **`order_id.state`** (`estado_odoo`) | Distingue `draft`/`sent` (presupuesto), `cancel` (cancelado) y `sale`/`done` (venta real) |

**Filtro:** ninguno. **Queremos las líneas de TODOS los estados**, incluidos
presupuestos y cancelados, con el estado como columna. Filtrar en Odoo nos
impide reproducir la descomposición de +126,631.14 (presupuestos) y
−378,812.65 (cancelados) que ya está verificada.

**Por qué importa:** hoy el dashboard calcula el importe como
`cantidad × precio_unitario` (`lib/cadena.ts:96`), sin descuento y sin filtrar
estado. Eso solo produce **+6,866,617.56** de descuento no restado. `discount`
sin `price_subtotal` no sirve: sin el subtotal de Odoo no hay forma de
comprobar que aplicamos el descuento igual que él (porcentaje vs. monto, orden
de redondeo). **Los dos campos, o ninguno.**

---

## (b) `stock.quant` — existencia física, CON FECHA DE CORTE

**Modelo:** `stock.quant`

**Campos requeridos:**

| Campo | Por qué |
|---|---|
| `product_id` (SKU y nombre) | Clave |
| **`quantity`** | La existencia. Hoy leemos `stock.quant` **sólo para SKU y nombre** y descartamos la cantidad |
| `location_id` | Para poder auditar la agregación |

**Filtro exacto:** `location_id.usage = 'internal'`
Sin ese filtro entran ubicaciones virtuales (proveedor, cliente, ajuste de
inventario, tránsito) y la suma no significa nada.

**Agregación:** por **SKU**, sumando sobre las **seis bodegas**. Si el export
sale desagregado por bodega, mejor: agregamos nosotros y podemos auditar.

### MÁS: la fecha de corte del export — esto es lo crítico

**Necesitamos la fecha y hora exactas a las que ese `quantity` corresponde.**

Hoy la existencia se calcula como la suma de movimientos **desde 2025-08-22**,
**sin saldo inicial**. El plan es usar este export como saldo inicial y sumarle
los movimientos posteriores. Para eso hay que saber **desde cuándo** sumar.

Si el export está fechado el día D y sumamos movimientos desde antes de D,
**contamos dos veces** los movimientos entre esa fecha y D.

> **Un doble conteo se ve idéntico a un dato correcto.**
> No da negativo, no da error, no rompe ninguna prueba. Da un número plausible
> que está mal. Es exactamente el tipo de defecto que ya nos costó los −149 de
> ED-11.7.3 y que nadie vio durante semanas.

Por eso: **el export sin su fecha de corte no sirve y no lo vamos a usar.**
Preferimos seguir con la existencia rota y sabida, que con una existencia
plausible y silenciosamente incorrecta.

Formato aceptable de la fecha: la marca de tiempo en que se corrió el export
(`YYYY-MM-DD HH:MM`, con zona horaria), anotada en el nombre del archivo o en
el mensaje. No hace falta que sea una columna.

**Control de aceptación:** el SKU **ED-11.7.3** debe dar exactamente **658**.
No "cerca de 658". Exactamente.

---

## (c) `stock.warehouse.orderpoint` — reglas de reabastecimiento

**Modelo:** `stock.warehouse.orderpoint`

**Campos requeridos:**

| Campo | Por qué |
|---|---|
| `product_id` (SKU) | Clave |
| **`product_min_qty`** | El mínimo de reposición |
| `product_max_qty` | Útil, no imprescindible |
| `warehouse_id` | Si hay reglas por bodega, las necesitamos separadas |

**Filtro:** activas. Si hay productos sin regla, está bien — necesitamos saber
cuáles son, porque para ésos el mínimo es genuinamente desconocido y no debe
inventarse un 0.

**Por qué importa:** `stock_minimo` está **escrito a mano en 0** en
`scripts/importar-inventario-odoo.mjs:119` y `:245`. **0 de 751** productos
tienen mínimo > 0. Con todos los mínimos en cero, la condición "existencia <
mínimo" se volvió "existencia ≤ 0" y hoy marca **547 de 751 (73%)** de los
productos como "bajo mínimo" — lo que en realidad está reportando es el bug del
saldo inicial faltante, no un problema de reposición.

---

## Nota final

Los tres exports son **independientes**: si (a) llega antes que (b), se
aprovecha (a) igual. Pero **ninguno se carga en el sistema hasta reescribir su
importador** — ver [`plan-reconstruccion.md`](./plan-reconstruccion.md).
