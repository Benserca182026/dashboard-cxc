# Plan de reconstrucción — qué hacer cuando lleguen los exports

**Fecha:** 2026-08-23 · Requiere: los tres exports de
[`exports-odoo-pendientes.md`](./exports-odoo-pendientes.md)
Contexto y cifras: [`estado-dashboard.md`](./estado-dashboard.md)

Este plan tiene un orden y el orden importa. Los pasos 1 a 4 se hacen **antes**
de cargar un solo dato. Saltarse ese orden hace que el paso 6 —el diff— deje de
detectar nada.

---

## 0. No se borra nada

**El dataset actual es la línea base del experimento.**

Está mal en formas que ya medimos con precisión: 26,285,671.61 en ventas,
−149 en ED-11.7.3, 547/751 bajo mínimo, −70.9% de valor. Esos números son
nuestro único punto de comparación. Si los borramos y cargamos limpio, tenemos
un dataset nuevo sin nada contra qué contrastarlo, y perdemos la capacidad de
demostrar que las correcciones hicieron lo que dijimos.

Nada se sobreescribe, nada se trunca, nada se `DELETE`. El dataset viejo se
archiva en el **paso 8**, y no antes.

---

## 1. Reescribir los importadores ANTES de correr ninguno

Se leen **línea por línea**, buscando **valores constantes escritos a mano**.
No se corre ninguno hasta terminar esta lectura.

Constantes conocidas hoy:

| Constante | Dónde | Efecto |
|---|---|---|
| `id_factura: null` | `scripts/importar-pagos-odoo.mjs:147` | `efectividadCohortePct` = 0% siempre |
| `stock_minimo: 0` | `scripts/importar-inventario-odoo.mjs:119` y `:245` | 0/751 con mínimo; "bajo mínimo" degenera a "existencia ≤ 0" |
| `costo_unitario: 0` | `importar-inventario-odoo.mjs:117`, `:243` | Margen falso en toda la cadena de ventas |
| `precio_unitario: 0` | `importar-inventario-odoo.mjs:118`, `:244` | Valor de inventario falso |
| `id_venta` sin poblar | facturas | 0 de 3,182 filas vinculadas a su pedido |

Esa lista es **la que conocemos**, no la que existe. La lectura línea por línea
es para encontrar las que faltan.

### Por qué este paso va primero, sin excepción

> **El diff es CIEGO a los defectos que se reproducen fielmente en ambos lados.**

Si el importador nuevo escribe `stock_minimo: 0` igual que el viejo, la
comparación del paso 6 muestra "sin cambios" en esa columna. Y "sin cambios" se
lee como "correcto". El defecto sobrevive **con el sello de aprobación del
diff**, que es peor que no haber hecho el diff.

Esto no tiene atajo. No se puede "cargar primero y limpiar después", porque
después el diff ya no sirve para nada.

---

## 2. Escribir el importador de `sale.order.line` — nunca existió

No hay script para esa tabla. Se cargó **por API directa de Odoo, sin script
versionado** (ver el comentario en `lib/datosReales.ts:41-46`: el modelo no
tiene vista de lista en ningún menú, así que se sacó por API a mano).

Consecuencia: **la carga de las 23,869 líneas es irreproducible.** No sabemos
qué filtro se aplicó, qué estados entraron, ni si se paginó bien. Es la tabla
de la que sale el total inflado de 26,285,671.61 y es la única que no podemos
volver a generar.

Se escribe `scripts/importar-venta-lineas-odoo.mjs`, versionado, con:
- el filtro explícito (ninguno: **todos los estados**, con `estado_odoo` como columna),
- `discount` y `price_subtotal` de verdad,
- la validación cruzada `qty × price_unit × (1 − discount/100) == price_subtotal`,
  fila por fila, contando las que no cuadran en vez de ignorarlas.

---

## 3. Una sola fecha de corte para todo el sistema, en un archivo

Hoy la fecha de corte es **editable en la UI**, y `pagosAplicados`
(`lib/calculos.ts:26`) **ni siquiera la usa**. Resultado: distintas partes del
dashboard responden a fechas distintas y ninguna lo declara.

Se crea **un archivo** (p. ej. `lib/corte.ts`) que exporta la fecha de corte y
la fecha del saldo inicial de inventario (la del export (b)). Todo lo demás la
importa de ahí. Ninguna función vuelve a recibirla por parámetro opcional con
default, ni a leerla del estado de la UI.

Regla: **si un cálculo depende de la fecha, la importa de ese archivo o no
compila.**

---

## 4. Corregir la paginación antes de comparar

`traerTodo()` (`lib/datosReales.ts:65-85`) pagina con header `Range` **sin
`order`**. PostgREST no garantiza orden estable entre páginas: filas repetidas o
perdidas entre la página N y la N+1.

Sin arreglar esto, el diff del paso 6 va a mostrar diferencias que no son
diferencias de datos sino de paginación, y vamos a perseguir fantasmas en una
tabla de 23,869 filas. Se agrega `order` por clave primaria antes de cualquier
comparación.

---

## 5. Carga en paralelo, no en sitio

El dataset nuevo se carga en **tablas nuevas** (esquema o prefijo aparte). Las
viejas quedan intactas y en línea.

Nada de `UPDATE`, nada de `UPSERT` sobre lo existente. Una carga en sitio
destruye el lado izquierdo de la comparación en el mismo acto de crear el
derecho.

---

## 6. Comparar fila por fila contra el dataset viejo

No totales. **Fila por fila**, por clave.

Categorías de resultado:
- **Igual** → nada que hacer.
- **Cambió, con explicación** → cada cambio debe mapear a una causa conocida:
  descuento aplicado, estado filtrado, saldo inicial sumado, mínimo real
  cargado. Se anota cuál.
- **Cambió, sin explicación** → **es un defecto que nadie había visto.** Se
  investiga hasta entenderlo. No se acepta un diff con filas en esta categoría.
- **Apareció / desapareció** → cambio de cardinalidad; casi siempre es filtro o
  paginación, casi nunca es dato.

Cifras que **deben** moverse y en qué dirección:

| Métrica | Viejo | Nuevo esperado |
|---|---:|---:|
| Total de ventas (líneas) | 26,285,671.61 | **19,671,235.56** |
| ED-11.7.3 | −149 | **658** |
| Productos con existencia negativa | 280 (−872,681.75) | **0**, o cada uno explicado |
| Productos con mínimo > 0 | 0 de 751 | **> 0**, según export (c) |
| Bajo mínimo | 547 de 751 (73%) | debe **bajar** y significar reposición |

Cifras que **NO** deben moverse:
- Pedidos − facturas = **345,223.95**. Esa diferencia es legítima. Si cambia, el
  cambio necesita explicación tanto como cualquier otro.
- Facturas: **19,326,011.61** sobre **3,182** filas.

---

## 7. Verificación contra Odoo POR PRODUCTO, no agregada

Se toma una lista de SKUs y se compara **uno por uno** contra la existencia que
declara Odoo. **ED-11.7.3 debe dar exactamente 658.** No "cerca de 658".

> **Un agregado que cuadra puede esconder errores que se compensan.**

Si el total de inventario cuadra pero un producto está +200 y otro −200, el
agregado dice "correcto" y las dos cifras están mal. Con 751 productos, la
probabilidad de compensaciones accidentales no es despreciable — y ya sabemos
que hay 280 productos con signo invertido, que es exactamente el material del
que se hacen las compensaciones.

Lo mismo aplica al riesgo del export (b): si el saldo inicial se fecha mal, el
doble conteo aparece **producto por producto** mucho antes que en el total, y en
el total puede no aparecer nunca.

Complemento: **las pruebas** hoy son 76 contra `datosDemo`, ninguna importa
`cargarDatasetReal`, y `verificacion/linea-base.mjs` falla desde siempre y está
fuera de `npm test`. Antes de cerrar, al menos las verificaciones por producto
entran a `npm test` con fixtures congelados del dataset real, y `linea-base.mjs`
o se arregla o se borra — pero deja de ser un script roto que nadie corre.

---

## 8. Archivar el viejo — al final

El dataset viejo se archiva **cuando el diff esté explicado**: cuando la
categoría "cambió sin explicación" del paso 6 esté vacía y las verificaciones
por producto del paso 7 pasen.

Antes de eso sigue en línea, porque es la única evidencia de que las
correcciones hicieron lo que decimos que hicieron.

---

## Resumen del orden

1. Reescribir importadores (buscar constantes escritas a mano) — **antes de cargar nada**
2. Escribir el importador de `sale.order.line` que nunca existió
3. Una sola fecha de corte, en un archivo
4. Arreglar la paginación (`order` en `traerTodo()`)
5. Cargar en paralelo, nunca en sitio
6. Diff fila por fila; cero filas sin explicación
7. Verificar contra Odoo **por producto**; ED-11.7.3 = 658 exacto
8. Archivar el viejo
