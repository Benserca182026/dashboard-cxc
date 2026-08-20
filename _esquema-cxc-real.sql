-- Esquema para datos REALES de Benserca 18 SA (Cuentas por Cobrar).
-- Espejo exacto de lib/types.ts — mismos nombres de campo, para que el
-- mapeo entre la app y la base sea 1:1, sin traducción.
--
-- Proyecto Supabase dedicado (jfvmuemyjcdesnoqeaix) — separado a propósito
-- del que usa el canvas de DataFlow, para no mezclar el pizarrón de trabajo
-- con datos financieros reales de la empresa.

create table if not exists clientes (
  id_cliente text primary key,
  nombre_cliente text not null,
  identificacion_fiscal text,
  estado_cliente text not null default 'activo' check (estado_cliente in ('activo','inactivo')),
  condiciones_pago_default_id text,
  fecha_creacion date not null default current_date
);

create table if not exists condiciones_pago (
  id_condicion_pago text primary key,
  nombre text not null,
  dias_credito integer not null
);

create table if not exists facturas (
  id_factura text primary key,
  id_cliente text not null references clientes(id_cliente),
  numero_factura text not null,
  fecha_emision date not null,
  fecha_vencimiento date, -- nullable: sin fecha, la factura se excluye del aging
  monto_original numeric(14,2) not null,
  moneda_id text not null default 'GTQ',
  estado_factura text not null default 'abierta' check (estado_factura in ('abierta','pagada','anulada','disputada')),
  id_venta text,
  -- Saldo pendiente YA CALCULADO por Odoo ("Importe adeudado"), no
  -- inventado por la app. Sin el vínculo pago<->factura (ver pagos.id_factura,
  -- que hoy queda null para todo), es la única forma correcta de saber
  -- cuánto de cada factura sigue sin pagar. Cuando exista la conciliación
  -- real pago<->factura, esta columna sirve para verificar que el cálculo
  -- propio (facturas - pagos aplicados) da el mismo número.
  saldo_pendiente_odoo numeric(14,2),
  -- Trazabilidad de origen: de qué exportación de Odoo vino esta fila.
  origen text default 'odoo-facturas',
  creado_en timestamptz not null default now()
);
create index if not exists idx_facturas_cliente on facturas(id_cliente);
create unique index if not exists idx_facturas_numero_cliente on facturas(id_cliente, numero_factura);

create table if not exists pagos (
  id_pago text primary key,
  id_factura text references facturas(id_factura),
  id_cliente text not null references clientes(id_cliente),
  fecha_pago date not null,
  monto_pago numeric(14,2) not null,
  moneda_id text not null default 'GTQ',
  estado_aplicacion text not null default 'aplicado' check (estado_aplicacion in ('aplicado','no_aplicado','parcial')),
  referencia_pago text,
  creado_en timestamptz not null default now()
);
create index if not exists idx_pagos_cliente on pagos(id_cliente);
create index if not exists idx_pagos_factura on pagos(id_factura);

create table if not exists notas_credito (
  id_nota_credito text primary key,
  id_factura text references facturas(id_factura),
  id_cliente text not null references clientes(id_cliente),
  fecha_emision date not null,
  monto_nota_credito numeric(14,2) not null,
  moneda_id text not null default 'GTQ',
  motivo text,
  estado_nota_credito text not null default 'pendiente' check (estado_nota_credito in ('aplicada','pendiente','anulada'))
);

create table if not exists disputas (
  id_disputa text primary key,
  id_factura text not null references facturas(id_factura),
  id_cliente text not null references clientes(id_cliente),
  fecha_apertura date not null,
  fecha_resolucion date,
  motivo_disputa text,
  monto_disputado numeric(14,2) not null,
  estado_disputa text not null default 'abierta' check (estado_disputa in ('abierta','en_revision','resuelta','rechazada'))
);

-- Tercera fuente: el aging YA CALCULADO por Odoo (reporte "Vencido por
-- cobrar" / Aged Receivable), por cliente y por tramo. NO es materia prima
-- para armar facturas/pagos — es la respuesta correcta contra la que se
-- compara lo que nuestro propio cálculo produce desde facturas+pagos.
-- Sirve para verificación permanente: si un cliente no cuadra, esta tabla
-- dice cuál y por cuánto.
create table if not exists saldos_odoo (
  id bigint generated always as identity primary key,
  id_cliente text references clientes(id_cliente),
  nombre_cliente_odoo text not null, -- tal cual viene de Odoo, por si el cliente aun no existe en `clientes`
  fecha_corte date not null,
  tramo text not null check (tramo in ('actual','1-30','31-60','61-90','91-120','older','total')),
  monto numeric(14,2) not null,
  origen text default 'odoo-vencido-por-cobrar',
  creado_en timestamptz not null default now()
);
create index if not exists idx_saldos_odoo_cliente on saldos_odoo(id_cliente, fecha_corte);
-- Sin esto, cada recarga de "Vencido por cobrar" DUPLICA filas: la PK de
-- esta tabla es el `id` autogenerado, que nunca coincide entre corridas, así
-- que "merge-duplicates" no tiene con qué detectar que una fila ya existe.
-- Con este índice, subirEnLotes(..., { onConflict: "id_cliente,tramo,fecha_corte" })
-- sí puede actualizar en vez de acumular filas repetidas para el mismo corte.
create unique index if not exists idx_saldos_odoo_upsert on saldos_odoo(id_cliente, tramo, fecha_corte);

-- RLS: cerrado por defecto. Sin política = nadie entra, ni con la
-- publishable key. Las políticas se agregan cuando se decida cómo se va a
-- leer esto desde la app (ver nota de exposición pública más abajo).
alter table clientes enable row level security;
alter table condiciones_pago enable row level security;
alter table facturas enable row level security;
alter table pagos enable row level security;
alter table notas_credito enable row level security;
alter table disputas enable row level security;
alter table saldos_odoo enable row level security;
