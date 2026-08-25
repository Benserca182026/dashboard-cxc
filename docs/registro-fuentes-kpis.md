# Registro de fuentes y KPIs

**Proyecto:** Dashboard CxC — Benserca 18  
**Propósito:** catálogo versionado para que el Dashboard, Dataflow y una futura vista móvil consulten la misma definición.  
**Regla de lectura:** cada valor debe conservar fuente, corte, población y evidencia. `Supabase` es la copia de trabajo de exports Odoo; no es una fuente de negocio independiente.

## Estados

| Estado | Significado | Regla de publicación |
|---|---|---|
| Confirmado | Fuente, corte, población y cálculo reproducible disponibles. | Puede mostrarse con su corte. |
| Parcial | La aritmética cuadra en la copia, pero falta una conciliación o atributo. | Uso operativo; no certificación financiera. |
| Bloqueado | Falta fuente, definición o clave de unión. | Mostrar el límite; no inventar un monto. |

## Registro

| Página / módulo | KPI o dato | Origen Odoo / reporte | Corte conocido | Estado | Evidencia y control requerido |
|---|---|---|---|---|---|
| Centro | Cartera vencida | `account.move` de cliente, publicado, residual y vencimiento; idealmente reporte de antigüedad. | Operativo: 2026-08-24. | Confirmado en la copia | Q703,209.70 cuadra dentro del dataset operativo. Guardar export, filtros de compañía/moneda y fecha de consulta. |
| Centro | Mora mayor a 180 días | Antigüedad por factura construida desde `account.move`. | 2026-08-24. | Confirmado en la copia | Q322,830.97 / 45.91% de vencido. Revalidar contra Aged Receivable al mismo corte. |
| Centro | Cuentas sin vendedor | `res.partner.user_id` y/o `account.move.invoice_user_id`. | Sin corte utilizable. | Bloqueado | El export no preserva propietario. Definir si se usa vendedor del cliente o de factura y extraerlo. |
| Centro | Clientes perdidos | `sale.order` / `sale.order.line` o facturas, con definición de cliente perdido aprobada. | Cálculo operativo 2025. | Parcial | 104 clientes / Q1,537,203.05. Conservar la definición, periodo y exclusiones; conciliar con el reporte comercial de Odoo. |
| Centro / Ventas | Descuento | `sale.order.line` o factura: lista y subtotal sin IVA, descuentos, impuestos y notas de crédito. | Sin corte homologado. | Bloqueado | 26.25% mezcla lista sin IVA con total con IVA; no es descuento. Extraer bases homogéneas y definición aprobada. |
| Ventas | Venta registrada y Top clientes | `sale.order`, `sale.order.line`; alternativamente facturas según definición aprobada de venta. | Copia: 2026-08-19; snapshot: 2026-08-25. | Parcial | La copia contiene 3,189 pedidos / Q19,292,422.91; no mezclar con el snapshot de 3,209 pedidos. Registrar estado, moneda, compañía y fecha. |
| Ventas | Margen comercial | `stock.valuation.layer` → `stock.move` → `sale.order.line` → `sale.order`; facturas para ingreso neto. | Según export de costos y ventas. | Parcial | Costo estándar histórico por entrega; cobertura aproximada de ingresos 96%. Rotular “margen sobre costo histórico estándar”, no costo contable definitivo. |
| Inventario | Capital y unidades históricas | `stock.quant` para unidades y `stock.valuation.layer` para valor. | 2026-08-19. | Confirmado histórico | Q2,707,822.74 y 26,477 unidades pertenecen al mismo control histórico; no describen inventario actual. |
| Inventario | Existencia valorizada actual | `stock.quant` + `stock.valuation.layer`, mismo minuto, compañía, moneda y productos. | No disponible. | Bloqueado | La ventana de movimientos inicia con salidas en 279 series; entradas menos salidas no reconstruye saldo inicial. |
| Inventario | Valor de salidas / ABC | `stock.move.line` / `stock.move`, estado `done`, origen y destino; capas para costo. | Ventana 2025-08-20 a 2026-08-20. | Parcial | Mide salida física interna→externa. No afirmar que cada salida fue venta sin `sale_line_id` y pedido vinculado. |
| Inventario | Baja rotación | Movimientos confirmados + costo; existencia y mínimos para decisión final. | Ventana 2025-08-20 a 2026-08-20. | Parcial | SKU con entradas y sin salida en la ventana. No prueba stock actual ni sobrestock. |
| Inventario | Mínimos / cobertura / overstock | `stock.quant`, reglas de reabastecimiento y/o mínimos por producto. | No disponible. | Bloqueado | Extraer `stock.warehouse.orderpoint` o política aprobada, junto con demanda y existencia al mismo corte. |
| Aging | Buckets, DSO y vencido | Reporte Aged Receivable; `account.move` residual/vencimiento; libro mayor de socios. | Snapshot: 2026-08-25 10:05; copia: 2026-08-19 envejecida al 24. | Parcial | No mezclar el snapshot sin filas con la copia operativa. Conciliar facturas, pagos y créditos al mismo corte. |
| Prioritarios | Saldo Top 10 y worklist | Facturas abiertas (`account.move`) y reglas explícitas de priorización. | Operativo declarado. | Parcial | La aritmética de Q442,105.55 Top 10 y Q1,133,597.08 worklist es reproducible; score, disputa y dueño no vienen completos de Odoo. |
| Seguimiento | Gestiones, promesas y productividad | `account_followup`, `mail.activity`, responsable y estado. | No disponible en la copia. | Bloqueado | Ceros de `localStorage` sólo describen esta aplicación. Extraer actividades y follow-up para medir gestión empresarial. |
| Forecast | Escenarios de caja y reactivación | Facturas abiertas + histórico de promesas, cobros y cancelaciones. | Corte operativo declarado. | Parcial / simulación | Reglas de 10/30/60 días son escenarios mecánicos; no publicarlos como probabilidad de cobro ni forecast financiero certificado. |
| Datos | Cobertura y frescura de cargas | Metadatos de importación, archivos fuente y tablas Supabase. | Por carga. | Confirmado técnico | Útil para saber qué se cargó, de cuándo es y qué falta; no sustituye conciliación Odoo. |

## Evidencia mínima por futura carga

Cada carga o consulta que habilite un KPI debe guardar, como mínimo:

1. Identificador de carga y fecha/hora con zona horaria.
2. Modelo o reporte de Odoo, compañía, moneda, filtros y población.
3. Archivo/export o consulta reproducible y suma de control.
4. Captura del reporte Odoo cuando la extracción sea manual.
5. Definición de la fórmula y versión de esta documentación.
6. Resultado de conciliación, diferencias y responsable de validación.

## Claves de unión requeridas

| Caso | Recorrido requerido |
|---|---|
| Costo histórico por venta | `stock.valuation.layer` → `stock.move` → `sale.order.line` → `sale.order`. |
| Salida física que es venta | `stock.move.line` → `stock.move` → `sale.order.line` → `sale.order`. |
| Cartera y pagos | Factura `account.move` → apuntes/conciliaciones del libro mayor de socios. |
| Responsable comercial | Cliente `res.partner.user_id` y/o factura `account.move.invoice_user_id`, con definición elegida. |

## Uso por Sites / móvil

Sites debe leer este registro como índice de confianza, no como datos transaccionales. La búsqueda móvil debe pasar por Dataflow en modo sólo lectura y responder siempre con: resultado, fuente Odoo, corte, filtros, identificador de carga y evidencia asociada.

La auditoría de detalle vigente se conserva en [informe-confiabilidad-odoo-2026-08-25.md](./informe-confiabilidad-odoo-2026-08-25.md).
