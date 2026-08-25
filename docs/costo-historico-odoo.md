# Costo histórico por pedido desde Odoo

## Resultado

La relación por identificadores reales quedó demostrada y automatizada:

```text
sale.order.id
  -> sale.order.line.order_id
  -> stock.move.sale_line_id
  -> stock.valuation.layer.stock_move_id
```

Para el ingreso neto se agregó la relación contable:

```text
sale.order.line.id
  -> account.move.line.sale_line_ids
  -> account.move.line.move_id
  -> account.move.move_type/state
```

No se comparan referencias textuales como `S00001` con `NAC/OUT/00001`.

Snapshot utilizado: `20260825T185142Z`, extraído de Benserca 18 SA con
`fields_get`, `search_count` y `search_read`. Los archivos crudos están en
`.odoo-extracts/costos-historicos-20260825T185142Z/` y no se versionan porque
contienen información comercial. `manifest.json` conserva dominios, campos,
conteos, corte y SHA-256 de cada archivo.

## Campos verificados en esta versión de Odoo

- `sale.order`: `id`, `name`, `partner_id`, `date_order`, `state`,
  `currency_id`, `company_id`, `amount_total`, `amount_untaxed`,
  `currency_rate`.
- `sale.order.line`: `id`, `order_id`, `product_id`, `product_uom_qty`,
  `qty_delivered`, `qty_invoiced`, `price_unit`, `discount`,
  `price_subtotal`, `state`, `currency_id`, `company_id`.
- `stock.move`: `id`, `sale_line_id`, `picking_id`, `product_id`,
  `product_uom`, `state`, `date`, `quantity_done`, `product_uom_qty`,
  `product_qty`, `origin`, `reference`, relaciones de movimientos y compañía.
  El campo candidato `quantity` no existe en esta versión.
- `stock.valuation.layer`: `id`, `stock_move_id`, `product_id`, `quantity`,
  `unit_cost`, `value`, `remaining_qty`, `remaining_value`, `account_move_id`,
  `create_date`, `description`, `company_id`, y relaciones entre capas. El
  campo `stock_landed_cost_id` no existe en esta versión.
- `account.move.line`: `id`, `move_id`, `account_id`, `product_id`, `debit`,
  `credit`, `balance`, moneda, `sale_line_ids`, `parent_state`, cantidades y
  subtotales. No existe `stock_valuation_layer_ids` en este modelo.
- `account.move`: estado, tipo, fechas, moneda, importes firmados y reverso.
- `product.product` y `product.category`: tipo, categoría, método de costo y
  método de valoración.

## Fórmulas

Ingreso neto sin IVA en moneda de compañía:

```text
-Σ account.move.line.balance
```

Se incluyen solamente apuntes de facturas publicadas ligados por
`sale_line_ids`. En una factura de cliente el ingreso tiene balance negativo;
en una nota de crédito el balance es positivo. Cambiar el signo produce ingreso
neto y conserva correctamente el efecto de reembolsos. `balance` ya está en GTQ
y evita mezclar el pedido histórico en USD con los pedidos en GTQ.

Costo histórico valorado por Odoo:

```text
-Σ stock.valuation.layer.value
```

Las salidas tienen cantidad y valor negativos; las devoluciones, positivos.
Cambiar el signo produce costo neto y las devoluciones reducen el costo.

Margen publicado:

```text
ingreso neto - costo histórico valorado
```

Se publica solamente para líneas donde la cantidad facturada neta coincide con
la cantidad entregada neta. Los pedidos parciales conservan sus cifras, pero el
margen total del pedido queda nulo; se informa por separado la población de sus
líneas conciliadas.

## Cobertura y conciliación

- 3,209 pedidos `state=sale`.
- 23,858 líneas de pedido.
- 25,317 movimientos relacionados por `sale_line_id`.
- 25,067 movimientos terminados y 25,067 capas de valoración.
- 0 movimientos terminados sin capa.
- 81,789 unidades entregadas según `sale.order.line.qty_delivered`.
- 81,789 unidades netas reconstruidas desde las capas; diferencia 0.
- Valor de capas de venta: -Q9,616,241.87.
- Costo reconstruido: Q9,616,241.87; diferencia 0.
- 23,875 capas de salida y 1,192 capas de devolución.
- 3,215 facturas y 241 notas de crédito publicadas.
- 25,204 apuntes contables de ingreso ligados a líneas de venta.
- 22,487 líneas activas conciliadas.
- 2,995 pedidos completamente conciliados, 92 parciales y 122 sin actividad
  contable o física.

Población conciliada:

- Ingreso neto sin IVA: Q15,794,034.13.
- Costo histórico estándar: Q9,520,651.33.
- Margen bruto: Q6,273,382.80.
- Margen: 39.72%.
- Cobertura sobre el ingreso vinculado: 98.729%.
- Cobertura sobre el costo vinculado: 99.0059%.

Exclusiones principales:

- 226 líneas entregadas no facturadas.
- 183 líneas facturadas no entregadas.
- 1 línea de servicio facturada sin costo de inventario.
- 961 líneas sin actividad contable ni física.
- 166 líneas históricas cuyo `qty_invoiced` no se reconstruye completamente
  desde `sale_line_ids`; se excluyen cuando rompen la igualdad de cantidades.

## Por qué no puede llamarse costo real FIFO/AVCO

Las cuatro categorías utilizadas declaran:

```text
property_cost_method = standard
property_valuation = manual_periodic
```

Por tanto, `stock.valuation.layer.value` conserva el costo estándar que Odoo
usó en la fecha del movimiento. Es histórico y está ligado a la entrega real,
pero no identifica el costo de una compra/lote ni aplica FIFO o promedio móvil.

Además, todas las capas de venta tienen `account_move_id=false`. Con valoración
manual periódica Odoo no generó asientos automáticos de costo por capa, así que
no existe un control COGS en `account.move.line` que pueda conciliarse pedido a
pedido. El ingreso sí se controla con apuntes contables publicados.

En el universo global hay 170 ajustes manuales sin `stock_move_id`, con valor
neto Q110,587.57. Se preservan, pero no se reparten entre pedidos porque Odoo no
entrega una relación que justifique esa asignación.

Conclusión: la aplicación debe rotular el resultado como **margen sobre costo
histórico estándar de Odoo, parcial conciliado**. No debe llamarlo costo real,
costo realizado FIFO/AVCO ni margen contable definitivo.

## Reproducibilidad

Con Chrome autenticado en el puerto 9444:

```powershell
npm run odoo:extraer-costos
npm run odoo:calcular-costos
npm run test:costo-historico
```

El extractor tiene lista blanca: `fields_get`, `search_count` y `search_read`.
No contiene `create`, `write`, `unlink` ni acciones de negocio. No escribe en
Odoo, Supabase o Vercel.
