-- ============================================================================
-- POLÍTICA RLS TEMPORAL — NO ES LA POLÍTICA DEFINITIVA.
--
-- Esto existe con un solo propósito: poder cargar los datos reales de
-- Benserca 18 desde el navegador o desde un script Node usando la clave
-- PUBLISHABLE (anon) — sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1 —
-- sin necesitar la clave service_role.
--
-- Lo que hace: le da al rol `anon` permiso de SELECT e INSERT en las 7
-- tablas. NADA MÁS. No hay UPDATE, no hay DELETE.
--
-- Lo que NO resuelve — y no debe fingir resolver:
--   "¿quién puede VER estos datos financieros reales?" sigue sin
--   contestar. Con esta política, CUALQUIERA que tenga la clave
--   publishable (que es pública a propósito, vive en el navegador) puede
--   leer y escribir las 7 tablas. Eso es aceptable SOLO mientras el
--   proyecto está en carga de datos de prueba, sin tráfico real ni
--   usuarios reales apuntando a él.
--
-- ANTES DE CUALQUIER DESPLIEGUE A PRODUCCIÓN (o de que cualquier persona
-- fuera del equipo de carga tenga la URL):
--   1. DROP todas las políticas creadas acá abajo (o hacé
--      `alter table ... disable row level security` y volvé a armar RLS
--      desde cero — lo que sea más limpio en ese momento).
--   2. Definí un modelo real de autenticación (Supabase Auth con
--      usuarios/roles, o el mecanismo que se decida) y políticas que
--      filtren por ese usuario/rol — no por "cualquiera con la clave
--      publishable".
--   3. Esa decisión de "quién ve qué" es de negocio, no técnica — no se
--      inventa acá. Este archivo deliberadamente NO la resuelve.
--
-- Fecha de creación: 2026-08-19. Si esto sigue aplicado dentro de unas
-- semanas y hay usuarios reales cerca del proyecto, es una señal de que
-- se quedó más tiempo del que debía.
--
-- NO SE EJECUTÓ TODAVÍA — este archivo se corre a mano cuando quien
-- carga los datos decida que es momento de hacerlo.
-- ============================================================================

-- clientes
create policy "TEMPORAL_anon_select_clientes" on clientes
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_clientes" on clientes
  for insert to anon with check (true);

-- condiciones_pago
create policy "TEMPORAL_anon_select_condiciones_pago" on condiciones_pago
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_condiciones_pago" on condiciones_pago
  for insert to anon with check (true);

-- facturas
create policy "TEMPORAL_anon_select_facturas" on facturas
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_facturas" on facturas
  for insert to anon with check (true);

-- pagos
create policy "TEMPORAL_anon_select_pagos" on pagos
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_pagos" on pagos
  for insert to anon with check (true);

-- notas_credito
create policy "TEMPORAL_anon_select_notas_credito" on notas_credito
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_notas_credito" on notas_credito
  for insert to anon with check (true);

-- disputas
create policy "TEMPORAL_anon_select_disputas" on disputas
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_disputas" on disputas
  for insert to anon with check (true);

-- saldos_odoo
create policy "TEMPORAL_anon_select_saldos_odoo" on saldos_odoo
  for select to anon using (true);
create policy "TEMPORAL_anon_insert_saldos_odoo" on saldos_odoo
  for insert to anon with check (true);

-- ============================================================================
-- ADENDA — agregado después de la primera recarga real (2026-08-19).
--
-- Los scripts de importación usan upsert (Prefer: resolution=merge-
-- duplicates) A PROPÓSITO: así una recarga es segura y no duplica filas.
-- Pero un upsert, cuando el id ya existe, hace un UPDATE por debajo — y la
-- política de arriba sólo daba INSERT+SELECT. Resultado real: al recargar
-- facturas, el lote que tocaba filas repetidas (o clientes ya cargados por
-- el archivo de facturas) se rechazó con "new row violates row-level
-- security policy (USING expression)". Sin este UPDATE, "merge-duplicates"
-- sólo sirve la primera vez que la tabla está vacía — deja de tener sentido
-- como upsert. Se agrega acá, mismo carácter temporal que el resto del
-- archivo.
create policy "TEMPORAL_anon_update_clientes" on clientes
  for update to anon using (true) with check (true);
create policy "TEMPORAL_anon_update_facturas" on facturas
  for update to anon using (true) with check (true);
create policy "TEMPORAL_anon_update_pagos" on pagos
  for update to anon using (true) with check (true);
create policy "TEMPORAL_anon_update_saldos_odoo" on saldos_odoo
  for update to anon using (true) with check (true);
-- ============================================================================

-- ============================================================================
-- Para revertir esto cuando llegue el momento, el DROP simétrico es:
--
-- drop policy if exists "TEMPORAL_anon_select_clientes" on clientes;
-- drop policy if exists "TEMPORAL_anon_insert_clientes" on clientes;
-- drop policy if exists "TEMPORAL_anon_select_condiciones_pago" on condiciones_pago;
-- drop policy if exists "TEMPORAL_anon_insert_condiciones_pago" on condiciones_pago;
-- drop policy if exists "TEMPORAL_anon_select_facturas" on facturas;
-- drop policy if exists "TEMPORAL_anon_insert_facturas" on facturas;
-- drop policy if exists "TEMPORAL_anon_select_pagos" on pagos;
-- drop policy if exists "TEMPORAL_anon_insert_pagos" on pagos;
-- drop policy if exists "TEMPORAL_anon_select_notas_credito" on notas_credito;
-- drop policy if exists "TEMPORAL_anon_insert_notas_credito" on notas_credito;
-- drop policy if exists "TEMPORAL_anon_select_disputas" on disputas;
-- drop policy if exists "TEMPORAL_anon_insert_disputas" on disputas;
-- drop policy if exists "TEMPORAL_anon_select_saldos_odoo" on saldos_odoo;
-- drop policy if exists "TEMPORAL_anon_insert_saldos_odoo" on saldos_odoo;
-- drop policy if exists "TEMPORAL_anon_update_clientes" on clientes;
-- drop policy if exists "TEMPORAL_anon_update_facturas" on facturas;
-- drop policy if exists "TEMPORAL_anon_update_pagos" on pagos;
-- drop policy if exists "TEMPORAL_anon_update_saldos_odoo" on saldos_odoo;
-- ============================================================================
