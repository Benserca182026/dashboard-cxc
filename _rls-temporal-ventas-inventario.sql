-- ============================================================================
-- POLÍTICA RLS TEMPORAL — mismo criterio y mismas advertencias que
-- _rls-temporal.sql (léase ese archivo primero). Separado en archivo propio
-- para las 4 tablas nuevas de Ventas/Inventario, y así no tocar el archivo
-- de la otra sesión mientras las dos cargas conviven.
--
-- Da a `anon` SELECT + INSERT + UPDATE (UPDATE hace falta para que el
-- upsert con Prefer: resolution=merge-duplicates funcione en recargas,
-- mismo motivo documentado en la adenda de _rls-temporal.sql). Nada de
-- DELETE.
--
-- Mismo aviso: esto es aceptable SOLO mientras el proyecto está en carga
-- de prueba, sin usuarios reales apuntando a él. Antes de producción,
-- DROP estas políticas y definir un modelo real de autenticación.
--
-- NO SE EJECUTÓ TODAVÍA — se corre a mano en el SQL Editor de Supabase
-- (proyecto jfvmuemyjcdesnoqeaix) cuando se decida cargar estos datos.
-- Fecha de creación: 2026-08-19.
-- ============================================================================

create policy "TEMPORAL_anon_select_productos" on productos
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_productos" on productos
  for insert to anon with check (true);
create policy "TEMPORAL_anon_update_productos" on productos
  for update to anon using (true) with check (true);

create policy "TEMPORAL_anon_select_ventas" on ventas
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_ventas" on ventas
  for insert to anon with check (true);
create policy "TEMPORAL_anon_update_ventas" on ventas
  for update to anon using (true) with check (true);

create policy "TEMPORAL_anon_select_venta_lineas" on venta_lineas
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_venta_lineas" on venta_lineas
  for insert to anon with check (true);
create policy "TEMPORAL_anon_update_venta_lineas" on venta_lineas
  for update to anon using (true) with check (true);

create policy "TEMPORAL_anon_select_movimientos_inventario" on movimientos_inventario
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_movimientos_inventario" on movimientos_inventario
  for insert to anon with check (true);
create policy "TEMPORAL_anon_update_movimientos_inventario" on movimientos_inventario
  for update to anon using (true) with check (true);

-- Reversión simétrica:
-- drop policy if exists "TEMPORAL_anon_select_productos" on productos;
-- drop policy if exists "TEMPORAL_anon_insert_productos" on productos;
-- drop policy if exists "TEMPORAL_anon_update_productos" on productos;
-- drop policy if exists "TEMPORAL_anon_select_ventas" on ventas;
-- drop policy if exists "TEMPORAL_anon_insert_ventas" on ventas;
-- drop policy if exists "TEMPORAL_anon_update_ventas" on ventas;
-- drop policy if exists "TEMPORAL_anon_select_venta_lineas" on venta_lineas;
-- drop policy if exists "TEMPORAL_anon_insert_venta_lineas" on venta_lineas;
-- drop policy if exists "TEMPORAL_anon_update_venta_lineas" on venta_lineas;
-- drop policy if exists "TEMPORAL_anon_select_movimientos_inventario" on movimientos_inventario;
-- drop policy if exists "TEMPORAL_anon_insert_movimientos_inventario" on movimientos_inventario;
-- drop policy if exists "TEMPORAL_anon_update_movimientos_inventario" on movimientos_inventario;
