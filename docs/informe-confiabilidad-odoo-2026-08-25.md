# Informe de confiabilidad y procedencia de datos

**Proyecto:** Dashboard CxC — Benserca 18  
**Fecha de revisión:** 25 de agosto de 2026  
**Alcance:** Centro, Ventas, Inventario, Aging, Prioritarios, Seguimiento, Forecast y Datos.  
**Criterio:** una cifra sólo se considera confirmada si conserva fuente, población, fecha de corte y cálculo reproducible.

## Dictamen ejecutivo

El tablero **no usa una sola base ni un solo corte**. Odoo es la fuente de negocio, Supabase es una copia intermedia de exportaciones de Odoo, el fixture `dashboard-v2.json` conserva snapshots declarados y `localStorage` conserva interacciones del navegador. Esas cuatro capas no son equivalentes.

| Estado | Significado | Uso permitido |
|---|---|---|
| **Confirmado** | Reproducible, con población y corte explícitos. | Operación, con el corte indicado. |
| **Parcial** | El cálculo interno cuadra, pero falta reconciliar corte, población o algún atributo. | Exploración; no certificación financiera. |
| **Bloqueado** | Falta la fuente o la definición; cualquier cifra sería inventada o engañosa. | Mostrar el límite, no el monto. |

La regla práctica es: **no mezclar un snapshot histórico con análisis operativo para formar un KPI nuevo**. Una cifra correcta para el 19 de agosto puede ser incorrecta si se la presenta como saldo actual del 25 de agosto.

## Fuente correcta según la pregunta

| Pregunta de negocio | Fuente Odoo primaria | Complemento / control |
|---|---|---|
| ¿Cuánto se vendió? | `sale.order` y `sale.order.line`, o facturas de cliente según la definición aprobada. | Estado, compañía, moneda y fecha explícitos. |
| ¿Cuál es la deuda vencida? | **Antigüedad de cuentas por cobrar**; técnicamente `account.move` publicado, residual y vencimiento. | Libro mayor de socios para conciliar pagos/créditos. |
| ¿Quién es dueño de la cuenta? | `res.partner.user_id` (vendedor del cliente) y/o `account.move.invoice_user_id` (vendedor de factura). | No son el mismo concepto; hay que elegir uno. |
| ¿Cuánto costó una venta entregada? | `stock.valuation.layer` → `stock.move` → `sale.order.line` → `sale.order`. | Facturas/notas de crédito para ingreso neto. |
| ¿Cuánto vale el inventario? | `stock.quant` para unidades y `stock.valuation.layer` para valor. | Ambos deben extraerse al mismo corte. |
| ¿Qué gestión de cobranza ocurrió? | `account_followup` y `mail.activity`. | Conciliaciones para atribuir pago a documento. |

Supabase no es una fuente de negocio independiente: hoy contiene una copia de exportaciones. Sirve para la interfaz y cálculos reproducibles sobre esa copia, pero no sustituye el control Odoo al mismo corte.

## Veredicto por página

| Página | Origen predominante | Veredicto | Qué puede afirmarse hoy | Qué no debe afirmarse |
|---|---|---|---|---|
| **Centro de mando** | Cartera operativa en Supabase + snapshots V2. | **Mixto** | Cartera vencida del corte operativo y rankings; bloqueo de cobertura de inventario. | Que todos los KPIs comparten corte o que las acciones heredadas son vigentes. |
| **Ventas** | Export `sale.order`/`sale.order.line` en Supabase + snapshot de Odoo. | **Parcial** | Venta registrada del extracto y rankings de ese extracto. | Que sea la venta actual de Odoo, si no se refresca el export. |
| **Inventario** | `stock.quant`, `stock.move.line` y `stock.valuation.layer` de distintos cortes. | **Parcial / histórico** | Capital y unidades del control histórico del 19-ago. | Existencia, rotación u overstock actual con datos de cortes mezclados. |
| **Aging** | Snapshot V2 + facturas operativas de Supabase. | **Mixto** | La clasificación operativa del extracto, con corte declarado. | Que el DSO y vencido del snapshot sean calculables con las mismas filas. |
| **Prioritarios** | Facturas Odoo/Supabase + reglas simuladas + `localStorage`. | **Parcial** | Saldos y días del dataset operativo. | Responsable, acción, disputa o score como dato de Odoo. |
| **Seguimiento** | Facturas Odoo/Supabase + gestiones en `localStorage`. | **Cartera parcial; seguimiento bloqueado** | Cartera abierta y vencida de la copia. | “No hubo contacto”, promesas, productividad o cobertura de cobranzas de la empresa. |
| **Forecast** | Facturas operativas y reglas mecánicas. | **Simulación declarada** | Escenarios matemáticos sobre cartera y candidatos de reactivación. | Probabilidad de cobro, caja futura o cumplimiento de meta. |
| **Datos** | Importador, Supabase y metadatos de carga. | **Útil como control técnico** | Cobertura, frescura y anomalías de la copia cargada. | Que resuelva por sí solo la conciliación con Odoo. |

## Hallazgos prioritarios y estado de corrección

### Centro de mando

Se corrigieron las cinco acciones para no presentar snapshots como hechos actuales:

| Acción | Antes | Estado actual |
|---|---|---|
| Mora mayor de 180 días | Q318,329 / 52% heredado. | **Actualizada:** Q322,830.97 / 45.91%, corte operativo 2026-08-24. |
| Cuentas sin vendedor | 26 cuentas / Q214,818.52 sin filas importadas que lo prueben. | **Bloqueada:** falta `partner.user_id` / dueño de cobranza. |
| Clientes perdidos | 105 / Q1.48M de snapshot. | **Actualizada:** 104 clientes / Q1,537,203.05 facturados en 2025. |
| “Descuento ponderado” | 26.25% presentado como descuento. | **Bloqueada:** es una brecha entre lista sin IVA y total con IVA; no es descuento real. El control comparable aproximado es 34.15%. |
| Cobertura / overstock | Monto no reproducible. | **Bloqueada correctamente:** no se publica monto sin umbral, detalle por SKU y corte único. |

El agente de “Próxima acción” fue actualizado para consumir la mora corregida. La cartera vencida operativa de **Q703,209.70** sí cuadra dentro del dataset usado por la aplicación y debe conservar su corte explícito.

### Ventas

La página combina una copia operativa congelada al **19-ago** (3,189 pedidos por **Q19,292,422.91**) con un snapshot Odoo de **25-ago** (3,209 pedidos). Los dos números pueden ser válidos para sus respectivas extracciones, pero no se deben comparar como si fueran el mismo corte.

El “descuento 26.25%” no es descuento: mezcla precio de lista sin IVA con `amount_total` con IVA. Para hablar de descuento se debe comparar bases homogéneas: lista versus subtotal sin IVA, conservando líneas, impuestos y definición.

El margen ya no debe llamarse costo real FIFO/AVCO. El recorrido extraído demuestra costo histórico **estándar** de Odoo al movimiento: `stock.valuation.layer` → `stock.move` → línea de pedido → pedido. Las categorías usan costo estándar y valoración periódica manual; por eso las capas no tienen asiento contable automático. Es una medida útil, pero debe rotularse **“margen sobre costo histórico estándar, parcial conciliado”**.

### Inventario

El valor de **Q2,707,822.74** y **26,477 unidades** coincide con los exports del **19-ago**: es un control histórico válido, no inventario actual. Una extracción posterior de valoración arroja otro valor; no se deben mezclar ambas para inferir variación.

Para publicar capital, cobertura, mínimo, sobrestock o rotación actual se necesita una extracción única de `stock.quant` y `stock.valuation.layer`, misma compañía, moneda, productos y minuto de corte. Hasta entonces el bloqueo de cobertura es la respuesta correcta.

### Aging, Prioritarios y Seguimiento

El snapshot V2 de Aging (25-ago 10:05) no conserva las filas ni la consulta. La copia operativa envejece facturas del export del 19-ago a un corte de 24-ago. Por eso aparecen diferencias reales, por ejemplo:

- Vencido V2: **Q607,929.37**; operativo: **Q703,209.70**.
- DSO V2: **61.26 días**; operativo: **47.33 días**.
- Mora >180 operativa: **Q322,830.97**, 45.91% de lo vencido.

En Prioritarios, los Top 10 suman **Q442,105.55** y el saldo de worklist es **Q1,133,597.08**: esa aritmética es reproducible contra la copia. Sin embargo, responsable, próxima acción y score no provienen de Odoo. En especial, las disputas llegan como arreglo vacío y no pueden interpretarse como “cero disputas”.

En Seguimiento, “0 gestiones”, “0 promesas” y “0 productividad” significan que el navegador actual no tiene entradas en `localStorage`; **no significan que la empresa no haya gestionado la cartera**. Existe evidencia de Follow-up en Odoo para 64 clientes, por lo que esos ceros no son publicables como gestión empresarial.

### Forecast

El Forecast está correctamente rotulado como simulación y no asigna probabilidades. Construye los escenarios aplicando reglas mecánicas de 10, 30 y 60 días sobre facturas abiertas con vencimiento; no existe histórico de promesas y cobros que permita calibrar esas curvas.

Por tanto, es válido como herramienta para discutir escenarios y reactivación, pero no como pronóstico financiero, compromiso de caja ni porcentaje de probabilidad. La meta comercial se mantiene como “sin dato”, que es correcto.

### Datos

La página Datos sirve como control de la calidad de la copia: cobertura, frescura, columnas, descartes y conciliaciones. No certifica la contabilidad por sí misma. Su principal función debe ser mostrar qué se cargó, de cuándo es y qué falta antes de habilitar cada KPI.

## Controles Odoo que faltan

Prioridad 0 — extraer al mismo minuto, compañía y moneda:

1. **Antigüedad de cuentas por cobrar**, detallada por factura y cliente.
2. **Libro mayor de socios**, para conciliar créditos y pagos.
3. Facturas de cliente con `amount_residual`, vencimiento, estado, tipo de documento y vendedor.
4. Clientes con `res.partner.user_id` y límite de crédito.
5. Follow-up y actividades (`account_followup` / `mail.activity`) con responsable, estado y próxima actividad.
6. Capas de valoración, movimientos y líneas de venta vinculadas para costo histórico por entrega.
7. `stock.quant` y `stock.valuation.layer` en un mismo corte para inventario.

## Reglas de publicación a partir de ahora

1. Cada tarjeta debe mostrar: fuente, corte, población y definición.
2. Si faltan filas, consulta o clave de unión, se publica **Bloqueado**, no una estimación presentada como hecho.
3. Un snapshot sólo puede describirse como snapshot; no se mezcla con datos vivos.
4. `localStorage` se rotula “gestión de esta aplicación”, nunca “actividad de Odoo”.
5. Costos estándar, FIFO y promedio se rotulan según el método real configurado en Odoo.
6. Antes de publicar una cifra financiera, se guarda su control reproducible (export, filtros, consulta y fecha).

## Conclusión

El dashboard ya hace una distinción importante entre dato operativo, snapshot y bloqueo; el trabajo pendiente es completar las extracciones y reconciliaciones para que esa distinción no viva sólo en el texto, sino en cada KPI. Hoy debe usarse como **tablero operativo parcialmente trazable**, no como reporte financiero certificado. La parte más sólida es la aritmética de cartera del dataset operativo con corte declarado; las áreas que dependen de vendedor, seguimiento, disputas, crédito, costos contables y forecasts requieren aún la extracción Odoo indicada arriba.
