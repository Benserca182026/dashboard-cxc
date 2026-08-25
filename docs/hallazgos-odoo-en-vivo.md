# Boletín — hallazgos de Odoo (Frente 1)

Sólo el Frente 1 escribe en este archivo. Un hecho por línea:
`hora · de dónde salió · valor`.

**Advertencia de origen, léala antes de usar cualquier cifra de abajo.**
En esta sesión **no hubo Odoo vivo**: el puente CDP del puerto 9444 estaba
caído (`curl http://127.0.0.1:9444/json/version` → exit 7, sin proceso
escuchando). Todo lo de abajo sale de **extractos que el propio Odoo produjo**
(exports XLSX y respuestas `search_read` de la API web) que **sobrevivieron en
disco** de sesiones anteriores. Es material de Odoo, no una lectura de pantalla
de hoy. **Cada línea declara su fecha de origen.** Donde dice `2026-08-19` o
`2026-08-20`, esa es la fecha del dato — NO 2026-08-24.

---

## LOS TRES URGENTES

### 1. ¿Las ventas traen vendedor? → **SÍ.** (Frente 7: desbloqueado)

- `15:10 · odoo/extract/sale_order.xlsx (export de sale.order, 2026-08-19 11:33), encabezados de hoja 1 · ["Referencia del pedido","Fecha de Creación","Cliente","Comercial","Actividades","Total","Estado"]`
- `15:10 · misma hoja, primera fila de datos · Comercial = "ANDERSON GONZALEZ" (poblado, no vacío)`
- `15:10 · scripts/importar-ventas-odoo.mjs:17-18 · "Comercial" (vendedor) se lee pero no tiene campo destino en Venta — se ignora`

**Qué establece:** Odoo entrega el vendedor por pedido, en la columna
`Comercial` del export estándar de `sale.order`, con valor real. En la API es
el campo `user_id` de `sale.order`.
**Qué NO establece:** no se comprobó qué porcentaje de los 3.234 pedidos trae
`Comercial` no vacío — sólo que la columna existe y al menos una fila la tiene.
El vendedor **se pierde en la importación**, no en Odoo: no hay campo destino
en `Venta` (`lib/types.ts`).

### 2. ¿Hay tipo de cambio GTQ/USD? → **NO en disco. Y para CxC no hace falta.** (Frente 2)

- `15:12 · facturas.xlsx (export de account.move, 2026-08-19), 3.207 filas · filas donde "Total firmado" != "Total en divisa firmado": 0`
- `15:12 · mismo archivo · suma "Total" = 19,413,988.80 · suma "Importe libre de impuestos firmado" = 17,333,945.34 · ratio = 1.119998`
- `15:12 · vencido-por-cobrar.xlsx · las columnas "Amount Currency" y "Currency" existen pero vienen VACÍAS en el export resumen`

**Qué establece:** en las 3.207 facturas, el importe en divisa y el importe en
moneda de compañía son **idénticos fila por fila**. Es decir: **toda la cartera
está en una sola moneda (GTQ)** y no hay ninguna conversión en juego para CxC.
El ratio 1.119998 confirma además **IVA del 12%** sobre la base.
**Qué NO establece:** **ninguna tasa de cambio aparece en ningún archivo en
disco.** No se leyó `res.currency` ni `res.currency.rate`, así que no puedo
decir si Odoo tiene USD configurado ni con qué fecha. Si el Frente 2 necesita
una tasa para algo que no sea CxC (ventas trae indicios de multi-moneda, ver
abajo), **hay que pedirla a Odoo vivo** — no la deduzca de estos archivos.

- `15:12 · scripts/importar-ventas-odoo.mjs:26-30 · el "Total" de sale.order se ve en Excel como "$ 1,234.56" o "1,234.56 Q", pero la celda cruda es un número pelado sin moneda → moneda_id quedó SIEMPRE null`

**Contradicción declarada:** el lado **facturas** es 100% una sola moneda; el
lado **ventas** tiene indicios de dos símbolos. No están resueltos entre sí.
Requiere lectura de `res.currency` en Odoo vivo.

### 3. ¿Odoo trae el vínculo pago↔factura? → **El export NO. El modelo SÍ.**

- `15:10 · pagos.xlsx (export de account.payment, 2026-08-19), encabezados · ["Fecha","Número","Diario","Método de pago","Cliente/Proveedor","Pago por lotes","Importe con signo en la moneda de la compañía","Estado"]`
- `15:10 · mismo archivo, primera fila · Número = "BNK2/2026/08/0026"`
- `15:10 · facturas.xlsx, primera fila · Número = "3201"`

**Qué establece:** el export de pagos que se usó **no tiene ninguna columna de
factura**. El `id_factura: null` de `importar-pagos-odoo.mjs:147` fue forzado
por **la vista que se exportó**, no por una limitación de Odoo.

**REFUTACIÓN de una hipótesis que estaba escrita en el código:**
`scripts/importar-pagos-odoo.mjs:18-20` dice que `referencia_pago` («Número»)
es *«probablemente el mismo texto que el número de factura (así se vio en
Odoo)»*. **Es falso.** El «Número» del pago es la referencia del asiento de
banco (`BNK2/2026/08/0026`); el número de factura es un correlativo corto
(`3201`). **Nunca van a cruzar por texto.** Cualquier plan de conciliación que
dependa de esa igualdad está muerto antes de empezar.

**Dónde sí vive el vínculo en Odoo** (no verificado contra el servidor, es
conocimiento del modelo — trátese como PROPUESTA hasta confirmarlo):
`account.payment.reconciled_invoice_ids`, y en el detalle
`account.move.line.full_reconcile_id` / `account.partial.reconcile`. Se piden
con `search_read` igual que todo lo demás (ver «La máquina» abajo).

---

## LA MÁQUINA PARA ENTRAR A ODOO — existe, y es mejor de lo que se creía

- `15:05 · _odoo.mjs:3 · única referencia al puerto 9444 en todo el proyecto; no hay script que levante ese navegador`
- `15:02 · curl http://127.0.0.1:9444/json/version · exit 7 (conexión rechazada); netstat: ningún proceso escuchando en 9444 ni 9222`
- `15:07 · <scratchpad 4cde63be>/odoo/launch.js · levanta chromium con launchPersistentContext sobre un userDataDir propio ("profile/"), --remote-debugging-port=9333, headless:false, y se queda vivo para login manual`
- `15:08 · <scratchpad 4cde63be>/odoo/pull-sale-lines.js · NO usa el diálogo de exportación: hace page.evaluate y llama POST /web/dataset/call_kw con {model, method:"search_read", args:[dominio, [campos]], kwargs:{limit, offset, order}}, paginando de 2000 en 2000`

**Qué establece:** la mecánica **sí generaliza a cualquier modelo**, y no por
cambiar el fragmento de URL, sino por **cambiar `model` y la lista de campos**
en la llamada `search_read`. Eso vuelve irrelevante la pregunta de si el
diálogo de exportación deja elegir columnas: **con `search_read` se pide
exactamente el campo que se quiera**, incluido `discount`.

**Requisitos del entorno:** (a) Playwright — presente, `node_modules/playwright`
v1.62.1, con chromium en caché; (b) un Chromium con depuración remota y
**sesión de Odoo iniciada** — `launch.js` lo levanta con un perfil persistente,
pero **el login es manual la primera vez**; (c) el puerto: `launch.js` usa
**9333**, `_odoo.mjs` usa **9444**. Son dos épocas distintas del proyecto.

- `15:04 · Chrome instalado: 151.0.7922.173` — a partir de Chrome 136 el flag `--remote-debugging-port` **se ignora sobre el perfil por defecto**; por eso hace falta el `userDataDir` propio de `launch.js`, no el perfil personal del usuario.

---

## VENTAS — reconciliación exacta al centavo (origen: API `search_read`, 2026-08-20)

- `15:14 · odoo/extract/sale_order_api.json · 3.234 pedidos, campos [id,name,partner_id,date_order,amount_total,state]`
- `15:14 · odoo/extract/sale_order_line.json · 24.349 líneas, campos [id,order_id,product_id,product_uom_qty,price_unit,price_subtotal]`

**`sale.order` por estado** (`amount_total`, INCLUYE impuestos):

| state | pedidos | amount_total |
|---|---:|---:|
| `sale` | **3.189** | **19,292,422.91** |
| `cancel` | 25 | 282,479.83 |
| `draft` | 16 | 87,156.52 |
| `sent` | 4 | 9,176.30 |
| **TODOS** | **3.234** | **19,671,235.56** |

- `15:14 · no existe ningún pedido en estado 'done' en esta base — "confirmado" == state 'sale', y nada más`

**`sale.order.line`, bruto vs neto de Odoo, por estado del pedido:**

| state | líneas | qty×price_unit | Σ price_subtotal | descuento |
|---|---:|---:|---:|---:|
| `sale` | 23.732 | 26,159,040.47 | 17,225,403.75 | 8,933,636.72 |
| `cancel` | 480 | 369,353.74 | 253,736.77 | 115,616.97 |
| `draft` | 117 | 113,522.14 | 77,818.49 | 35,703.65 |
| `sent` | 20 | 13,109.00 | 8,193.16 | 4,915.84 |
| **TODOS** | **24.349** | **26,655,025.35** | **17,565,152.17** | **9,089,873.18** |

**Dos identidades exactas, al centavo, que cierran el caso del "26 millones":**

- `15:14 · 24.349 líneas − 480 líneas de pedidos 'cancel' = 23.869` → **el conteo de líneas que ya está en la base.**
- `15:14 · 26,655,025.35 − 369,353.74 (bruto de 'cancel') = 26,285,671.61` → **el total inflado que muestra la app, exacto.**

Es decir: `venta_lineas` en la base **son exactamente las líneas de los pedidos
no cancelados**, y la app suma `cantidad × precio_unitario` sobre ellas.

**CORRECCIÓN a la descomposición que circulaba.** La cifra «descuento no
restado +6,866,617.56» **mezcla el IVA adentro**. Sale de comparar una suma de
líneas **sin impuesto** contra un `amount_total` **con impuesto**. Separados:

- `15:14 · descuento real sobre pedidos no cancelados = 26,285,671.61 − 17,311,415.40 = 8,974,256.21`
- `15:14 · IVA de los pedidos 'sale' = 19,292,422.91 − 17,225,403.75 = 2,067,019.16 (12%)`

El total de 6,614,436.05 de diferencia es correcto; **su desglose no lo era.**
El descuento verdadero es **Q8,974,256.21**, y el IVA lo compensa parcialmente.
Quien corrija `lib/cadena.ts:96` tiene que decidir explícitamente si el número
que quiere mostrar es **con o sin IVA** — son 2.07 millones de diferencia.

**`price_subtotal` YA ESTÁ EN DISCO.** No hace falta pedir `discount` a nadie
para arreglar el total de ventas: Odoo ya entregó el importe neto por línea,
para las 24.349 líneas.

---

## FACTURAS (origen: facturas.xlsx, export de account.move, 2026-08-19)

- `15:12 · 3.207 filas · suma "Total" = 19,413,988.80 · suma "Importe adeudado" = 1,221,574.27`
- `15:12 · Estado: {Publicado: 3.194, Cancelado: 6, Borrador: 7}`
- `15:12 · Estado de pago: {Pagado: 2.761, No pagadas: 164, Revertido: 138, "En proceso de pago": 73, "Pagado Parcialmente": 71}`
- `15:12 · el export TRAE "Importe adeudado" por factura — el saldo pendiente por documento existe en Odoo y no se está usando`

**Sobre la completitud (#18):** en la base hay **3.182** facturas; este export
de Odoo trae **3.207**. **Faltan 25.** No pude establecer cuáles ni por qué:
requiere cruzar número a número contra la tabla, y la base no fue consultada en
esta sesión (ver «Lo que no pude comprobar»).

---

## CARTERA / AGING (origen: vencido-por-cobrar.xlsx, 2026-08-19)

- `15:12 · encabezado literal de la columna de corriente · "As of: 08/19/2026" ← ÉSTA es la fecha de corte del reporte`
- `15:12 · 133 clientes`

| tramo | monto |
|---|---:|
| `As of: 08/19/2026` (corriente, no vencido) | 1,005,992.96 |
| `1 - 30` | 227,890.38 |
| `31 - 60` | **−18,180.32** |
| `61 - 90` | **−19,507.10** |
| `91 - 120` | 89,917.14 |
| `Older` | 585,080.92 |
| **Total** | **1,871,193.98** |

- `15:12 · la suma de los 6 tramos da 1,871,193.98 y la columna "Total" da 1,871,193.98 · diferencia 0.00 · NO hay saldo no clasificable`
- `15:12 · dos tramos son NEGATIVOS (saldos a favor del cliente); cualquier gráfico de barras apiladas los va a dibujar mal`

**Ojo con el nombre:** «vencido» **no** es 1,871,193.98. Ese es el **total de
cartera**. El vencido = total − corriente = **865,201.02**. La entrada
`cxc_saldo_vencido_total` del fixture pide «el pie de la columna Total», que es
la cartera entera. **Población y nombre no coinciden** — hay que decidir cuál
de los dos se quiere antes de llenarla.

**Discrepancia sin resolver:** «Importe adeudado» de facturas suma
**1,221,574.27**; el aging total da **1,871,193.98**. Difieren en
**649,619.71**. Ambos son de Odoo y de la misma fecha nominal. No lo pude
explicar (ver «Lo que no pude comprobar»).

---

## INVENTARIO (origen: stock_quant.xlsx, export 2026-08-19 11:40)

- `15:14 · encabezados · ["Producto","Ubicación","Cantidad inventariada","Cantidad disponible"]`
- `15:14 · 2.030 filas en total, de las cuales 795 son filas de dato real (Ubicación no vacía); el resto son encabezados de grupo de Odoo, en DOS niveles (producto y ubicación)`
- `15:14 · suma de "Cantidad inventariada" sobre las 795 filas reales = 26,477 unidades`
- `15:14 · ubicaciones internas y su total · NAC/Stock 24.907 · C VEN/Stock 560 · C CEM/Stock 395 · C MAS/Stock 360 · RESER/Stock 114 · MUEST/Stock 98 · C YAD/Stock 39 · DEFEC/Stock 4`
- `15:14 · son 8 ubicaciones, no 6 como decía docs/exports-odoo-pendientes.md`
- `15:14 · hay existencias NEGATIVAS en el propio Odoo (ej. [09.07.2.2] en NAC/Stock = −2), no es sólo un artefacto de la app`

### ED-11.7.3 — el testigo, y una trampa de fechas

- `15:14 · stock_quant.xlsx, filas de [ED-11.7.3] GUANTES DE PROTECCIÓN EDGE TALLA L · C MAS/Stock 29 + C VEN/Stock 23 + NAC/Stock 662 = 714 (el encabezado de grupo de Odoo confirma 714)`

**El fixture dice 658 (capturado 2026-08-23). Este export de Odoo dice 714
(2026-08-19). Los dos son de Odoo. Difieren en 56.**

Esto **no** es un error de nadie: son dos fechas distintas y el stock se movió.
Pero es exactamente la trampa que se advirtió: **si alguien usa el 714 del 19
como saldo inicial y le suma movimientos desde el 22, el resultado va a ser
plausible y va a estar mal.** El saldo inicial y la ventana de movimientos
tienen que fecharse contra el MISMO instante, y ese instante hay que leerlo de
Odoo, no elegirlo.

**No cargué ningún saldo inicial.** Con dos cifras de Odoo en desacuerdo y sin
Odoo vivo para desempatar, cargar cualquiera de las dos era fabricar el número.

---

## OTROS MODELOS DISPONIBLES EN DISCO (no analizados a fondo)

- `15:10 · odoo/extract/stock_move_line.xlsx · 12.175 filas · ["Fecha","Referencia","Producto","Desde","Hasta","Hecho","Estado"]`
- `15:10 · odoo/extract/stock_valuation_layer.xlsx · 31.554 filas · ["Creado el","Producto","Cantidad","Valor total"] ← la valoración de inventario que pide el fixture sale de acá`
- `15:10 · follow-up-reports.xlsx · 64 filas · ["Nombre","Adeudo Total","Total de Vencido","Estado del seguimiento","Nivel del seguimiento"] ← lo más cercano a "disputas" que hay`
- `15:10 · vencido-por-cobrar-detalle.xlsx · 395 filas · mismas columnas que el resumen, pero por factura`

### ¿Existen disputas en Odoo?

**No como tal.** Lo más cercano es el **seguimiento de cobranza**
(`account_followup`): `follow-up-reports.xlsx` trae `Estado del seguimiento`
(ej. «Se requiere una acción») y `Nivel del seguimiento` (ej. «Primer correo de
recordatorio»), para 64 clientes. **Eso es gestión de cobro, no disputa.** No
encontré ningún modelo de disputa/reclamo en el material disponible. Confirmar
contra Odoo vivo antes de que ningún frente construya una pantalla de disputas.

---

## STOCK MÍNIMO (`stock.warehouse.orderpoint`)

- `15:14 · NO existe ningún export de stock.warehouse.orderpoint en disco. Ninguno.`

`stock_minimo` sigue escrito a mano en 0 y **no hay dato para reemplazarlo**.
Es el único de los tres exports pedidos que **no** se puede resolver con
material ya existente. Se pide con
`search_read('stock.warehouse.orderpoint', [], ['product_id','product_min_qty','product_max_qty','warehouse_id'])`.

---

## COSTOS DE PRODUCTO — el insumo que se daba por perdido, existe

- `15:16 · odoo/extract/costos-productos.json · 745 registros con costo_unitario real, campo "origen":"odoo-stock-valuation-layer"`
- `15:16 · muestra · {"sku":"09.07.2.2","costo_unitario":100.07} · {"sku":"110/90-17","costo_unitario":10.29}`
- `15:16 · odoo/calcular-costos.js · lo deriva del stock_valuation_layer usando SOLO las filas de entrada (cantidad > 0), es decir el costo realmente pagado, no un promedio contaminado por las salidas`

`scripts/importar-inventario-odoo.mjs` dice en su cabecera que
`costo_unitario` queda en 0 porque «ninguno de los dos archivos trae precio de
catálogo». **Eso ya no es cierto**: hay costo real para 745 de los 751 SKU. Sin
esto no hay valor de inventario ni margen; con esto, los dos se vuelven
calculables.

## VALORACIÓN DE INVENTARIO

- `15:16 · stock_valuation_layer.xlsx · 30.801 filas de dato (de 31.554; 753 son encabezados de grupo) · Σ "Valor total" = 2,707,822.74 · Σ "Cantidad" = 26,479`

**Contraste independiente que da confianza:** `stock.quant` dice **26.477**
unidades y `stock.valuation.layer` dice **26.479**. Son dos exports distintos,
de dos modelos distintos, y **coinciden dentro de 2 unidades**. Es la primera
cifra de inventario de este proyecto con dos fuentes que se respaldan.

## INFORME DE VENTAS (sale_report.xlsx) — no sirve como cifra de control

- `15:17 · sale_report.xlsx · tabla dinámica de "Total libre de impuestos" por mes · Total 6,555,243.12 · cubre sólo agosto 2025 → agosto 2026`
- `15:17 · NO trae ninguna medida de margen`

No es comparable con nada: es una ventana de 13 meses, mientras `sale.order`
arranca en 2022. **El margen sigue sin cifra de control.**

---

## ESTADO DEL FIXTURE `fixtures/cifras-odoo.json` (actualizado 2026-08-24)

| cifra | valor | fecha del dato |
|---|---:|---|
| `ventas_total_confirmado` (SIN filtrar) | 19,671,235.56 | 2026-08-23 |
| `ventas_pedidos_confirmados` (SIN filtrar) | 3.234 | 2026-08-23 |
| **`ventas_total_estado_sale`** (nueva) | **19,292,422.91** | 2026-08-20 |
| **`ventas_pedidos_estado_sale`** (nueva) | **3.189** | 2026-08-20 |
| `inventario_existencia_ed_11_7_3` | 658 *(export del 19 dice 714)* | 2026-08-23 |
| **`inventario_unidades_totales`** | **26.477** | 2026-08-19 |
| **`inventario_valor_costo_total`** | **2,707,822.74** | 2026-08-19 |
| `inventario_skus_bajo_minimo` | **sigue PENDIENTE** | — |
| **`cxc_saldo_vencido_total`** | **1,871,193.98** | 2026-08-19 |
| `ventas_margen_bruto` | **sigue PENDIENTE** | — |

**Se cerraron 3 de 5 pendientes.** Los 2 que quedan **no se pueden cerrar con
material existente** y están declarados como tales, no rellenados a ojo:
`stock.warehouse.orderpoint` no tiene ni un export en disco, y el margen no
aparece en ningún informe guardado.

**Las dos guardas que no podían pasar jamás, ahora sí pueden.** El problema era
de población, no de aritmética: `lib/datosReales.ts:262` filtra a
`estado_odoo === "sale"`, así que la app suma 3.189 pedidos, mientras el fixture
guardaba el total de los 3.234. Se compara contra las cifras nuevas, de la misma
población, y las viejas quedan como contexto impreso. **No se bajó ninguna
tolerancia.**

---

## FACTURAS — la prueba «#18 completitud» queda EXPLICADA POR COMPLETO

Cruce número a número entre `facturas.xlsx` (Odoo) y la tabla `facturas` de
Supabase, leída por REST el 2026-08-24.

- `15:22 · GET /rest/v1/facturas · 3.182 filas en la base`
- `15:22 · facturas.xlsx · 3.207 filas con dato`
- `15:22 · en Odoo y NO en la base: 25 · en la base y NO en Odoo: 0`

**Las 25 se reparten en exactamente dos causas, y ninguna es un bug del importador:**

**(a) 11 facturas SIN NÚMERO** — 4 `Cancelado` + 7 `Borrador`. Su columna
«Número» dice literalmente `/`, que es el marcador de Odoo para un documento
que todavía no tomó correlativo. Suman **87,977.19**. Como la clave de la
tabla se deriva del número, once documentos llamados `/` colapsarían en una
sola fila.

**(b) 14 facturas `Publicado` con TODAS las columnas de dinero VACÍAS.**

- `15:24 · facturas.xlsx, fila del número 2115 · ["2115","B6D49DD7","444220544","MOTOREPUESTOS NISSI","45908","45938","","","","","","","Pagado","Publicado"]`

Total, Total firmado, Total en divisa, Importe libre de impuestos e Importe
adeudado vienen **todas en blanco**, aunque el documento está `Publicado` y
`Pagado`. `importar-facturas-odoo.mjs:138-141` las descarta con el motivo
«monto ilegible en Total» — **y hace bien: se negó a inventar un monto.**

- `15:23 · comprobado que 2115, 2114 y 1678 no están en la base bajo ninguna variante del número (búsqueda LIKE) — no es un problema de formato`

**Conclusión que importa para todos los frentes:** el hueco **no está en la
importación, está en el EXPORT XLSX**, que devolvió celdas vacías para
facturas que en Odoo sí tienen importe. Es el argumento más fuerte a favor de
abandonar el export de pantalla y pedir los datos con `search_read`, donde el
campo llega o no llega, pero no llega en blanco por culpa del renderizador.
