-- ============================================================================
-- CIERRE de escritura para `anon` — 2026-09-03.
--
-- Elimina TODAS las políticas de INSERT y UPDATE que _rls-temporal.sql y
-- _rls-temporal-ventas-inventario.sql le dieron al rol `anon` el 2026-08-19.
-- Deja SELECT intacto — el dashboard es de solo lectura desde el navegador,
-- nunca escribió nada él mismo, así que esto no le rompe nada a la app.
--
-- CÓMO EJECUTAR: pegar este archivo completo en el SQL Editor del proyecto
-- Supabase (jfvmuemyjcdesnoqeaix) y correrlo. No requiere downtime, no borra
-- datos, solo revoca permiso de escritura de un rol.
--
-- Esto NO reemplaza rotar la clave publishable (sigue siendo la misma que
-- ya estuvo expuesta en el historial de git) ni activar CXC_AUTH_ACTIVA.
-- Cierra específicamente el riesgo más grave: que cualquiera con la clave
-- (pública por diseño, vive en el navegador) pueda modificar o insertar
-- facturas, pagos, clientes, ventas o inventario reales.
-- ============================================================================

-- clientes, condiciones_pago, facturas, pagos, notas_credito, disputas, saldos_odoo
drop policy if exists "TEMPORAL_anon_insert_clientes" on clientes;
drop policy if exists "TEMPORAL_anon_update_clientes" on clientes;
drop policy if exists "TEMPORAL_anon_insert_condiciones_pago" on condiciones_pago;
drop policy if exists "TEMPORAL_anon_insert_facturas" on facturas;
drop policy if exists "TEMPORAL_anon_update_facturas" on facturas;
drop policy if exists "TEMPORAL_anon_insert_pagos" on pagos;
drop policy if exists "TEMPORAL_anon_update_pagos" on pagos;
drop policy if exists "TEMPORAL_anon_insert_notas_credito" on notas_credito;
drop policy if exists "TEMPORAL_anon_insert_disputas" on disputas;
drop policy if exists "TEMPORAL_anon_insert_saldos_odoo" on saldos_odoo;
drop policy if exists "TEMPORAL_anon_update_saldos_odoo" on saldos_odoo;

-- productos, ventas, venta_lineas, movimientos_inventario
drop policy if exists "TEMPORAL_anon_insert_productos" on productos;
drop policy if exists "TEMPORAL_anon_update_productos" on productos;
drop policy if exists "TEMPORAL_anon_insert_ventas" on ventas;
drop policy if exists "TEMPORAL_anon_update_ventas" on ventas;
drop policy if exists "TEMPORAL_anon_insert_venta_lineas" on venta_lineas;
drop policy if exists "TEMPORAL_anon_update_venta_lineas" on venta_lineas;
drop policy if exists "TEMPORAL_anon_insert_movimientos_inventario" on movimientos_inventario;
drop policy if exists "TEMPORAL_anon_update_movimientos_inventario" on movimientos_inventario;

-- Verificación rápida después de correr esto (opcional, para confirmar):
-- select tablename, policyname, cmd from pg_policies
--   where policyname like 'TEMPORAL_anon_%' order by tablename, cmd;
-- Debería devolver SOLO filas con cmd = 'SELECT', ninguna INSERT/UPDATE.
