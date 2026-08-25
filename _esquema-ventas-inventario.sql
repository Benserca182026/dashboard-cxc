-- Esquema para datos REALES de Ventas e Inventario (Paso 11 — la cadena).
-- Espejo exacto de lib/types.ts (Producto, Venta, VentaLinea,
-- MovimientoInventario) — mismos nombres de campo que el modelo de la app.
--
-- Mismo proyecto Supabase dedicado que _esquema-cxc-real.sql
-- (jfvmuemyjcdesnoqeaix). Ver _coordinacion-ventas-inventario.md para el
-- contexto de por qué esto vive en archivo aparte del esquema de CxC.
--
-- id_cliente en `ventas` usa DELIBERADAMENTE la misma función
-- idClienteDesdeNombre() de scripts/lib-importacion-odoo.mjs que ya usan
-- importar-facturas-odoo.mjs / importar-pagos-odoo.mjs — así un mismo
-- cliente cae en el mismo id sin importar qué script lo generó. PERO no
-- lleva `references clientes(id_cliente)`: si lleváramos FK, cargar
-- ventas antes que facturas (o un cliente que solo compra, nunca tiene
-- factura todavía) rompería el insert. El join sigue funcionando por
-- valor de id_cliente igual; simplemente no está impuesto por la base.

create table if not exists productos (
  id_producto text primary key,
  sku text not null unique,
  nombre_producto text not null,
  -- Ninguno de los exports de Odoo usados hasta ahora (Stock a mano,
  -- Valoración de stock) trae precio/costo de catálogo — Valoración trae
  -- costo REALIZADO por movimiento, que es otra cosa. Quedan en 0 hasta
  -- que se traiga un export real de Productos/Lista de precios.
  costo_unitario numeric(14,2) not null default 0,
  precio_unitario numeric(14,2) not null default 0,
  -- Regla de reposición de Odoo, no viene en Stock a mano tampoco.
  stock_minimo numeric(14,2) not null default 0,
  origen text default 'odoo-stock-quant',
  creado_en timestamptz not null default now()
);

create table if not exists ventas (
  id_venta text primary key,
  -- Ver nota de arriba: mismo id que clientes.id_cliente por valor, sin FK.
  id_cliente text,
  fecha_venta date not null,
  -- Paso 11 dice "el total NO se guarda, se deriva de las líneas" — pero
  -- todavía no hay líneas cargadas (ver venta_lineas). Se deja el total
  -- de Odoo aparte, marcado como tal, para no fingir que ya se puede
  -- derivar de algo que no existe.
  total_odoo_referencia numeric(14,2),
  -- La columna "Total" de Odoo mezcla monedas en pantalla ($ vs Q), pero
  -- ese símbolo es solo formato visual de Excel — no está en el valor
  -- crudo de la celda. Probado contra el archivo real: no se puede
  -- recuperar. Por eso queda SIEMPRE null en la carga actual — no se
  -- asume "todo GTQ" solo porque es la mayoría (ver importar-ventas-odoo.mjs).
  moneda_id text,
  estado_odoo text,
  origen text default 'odoo-sale-order',
  creado_en timestamptz not null default now()
);
create index if not exists idx_ventas_cliente on ventas(id_cliente);

create table if not exists venta_lineas (
  id_linea text primary key,
  id_venta text not null references ventas(id_venta),
  id_producto text not null references productos(id_producto),
  cantidad numeric(14,2) not null,
  precio_unitario numeric(14,2) not null,
  origen text default 'odoo-sale-order-line',
  creado_en timestamptz not null default now()
);
create index if not exists idx_venta_lineas_venta on venta_lineas(id_venta);
create index if not exists idx_venta_lineas_producto on venta_lineas(id_producto);

create table if not exists movimientos_inventario (
  id_movimiento text primary key,
  id_producto text not null references productos(id_producto),
  fecha date not null,
  tipo text not null check (tipo in ('entrada','salida','ajuste')),
  -- Negativa en salidas, igual que MovimientoInventario.cantidad en la app.
  cantidad numeric(14,2) not null,
  id_venta text,
  -- Ubicación origen/destino tal cual las nombra Odoo (ej. "NAC/Stock",
  -- "Partner Locations/Customers") — el tipo (entrada/salida/ajuste) se
  -- DERIVA de este par en el script de importación; queda el crudo acá
  -- para poder auditar o re-clasificar si la regla de derivación cambia.
  ubicacion_desde text,
  ubicacion_hasta text,
  motivo text,
  origen text default 'odoo-stock-move-line',
  creado_en timestamptz not null default now()
);
create index if not exists idx_movimientos_producto on movimientos_inventario(id_producto, fecha);
create index if not exists idx_movimientos_venta on movimientos_inventario(id_venta);

alter table productos enable row level security;
alter table ventas enable row level security;
alter table venta_lineas enable row level security;
alter table movimientos_inventario enable row level security;

-- Sin políticas todavía = cerrado a todo el mundo, incluida la clave
-- publishable. Ver _rls-temporal-ventas-inventario.sql para la política
-- temporal de carga, mismo criterio y mismas advertencias que
-- _rls-temporal.sql.
