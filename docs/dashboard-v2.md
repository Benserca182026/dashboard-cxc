# Dashboard V2 — copia aislada

## Base exacta

- Repositorio fuente: `Benserca182026/dashboard-cxc`.
- Commit de producción: `4fe660fa58be857bde7e41836ca1deaa72d091d7`.
- Deployment verificado: `dpl_CPsMmhPqXguamAoKpqNqvvNqeZbH`.
- Rama local de trabajo: `codex/kpis-v2`.
- Corte analítico: Odoo 2026-08-25, aproximadamente 10:00–10:05.

La copia productiva en uso y la otra carpeta local no se modifican.

## Qué incorpora

- 32 KPIs ejecutivos repartidos entre Resumen, Ventas, Aging, Inventario, Forecast, Prioritarios, Seguimiento y Datos.
- Estado explícito por KPI: confirmado, parcial o bloqueado.
- Definición, modelo, filtro y siguiente decisión desplegables.
- Siete acciones priorizadas por impacto con responsable funcional y el hueco de fecha declarado.
- Dieciséis hallazgos de agentes orientados a decisiones comerciales.
- Cobertura de la matriz: 43 completos, 15 parciales y 8 bloqueados.

## Separación de Supabase

La V2 no usa el proyecto hardcodeado de la aplicación heredada para publicar sus KPIs. Busca estas variables independientes:

```text
NEXT_PUBLIC_SUPABASE_V2_URL
NEXT_PUBLIC_SUPABASE_V2_PUBLISHABLE_KEY
```

Si no existen, la interfaz usa `fixtures/dashboard-v2.json`, el snapshot verificado incluido en la copia. Así la página funciona y sigue declarando que Supabase V2 está pendiente.

La migración `supabase/migrations/202608250001_dashboard_v2.sql` crea cuatro tablas:

- `dashboard_snapshots`
- `dashboard_kpis`
- `dashboard_actions`
- `dashboard_agent_insights`

Las cuatro tienen RLS. `anon` y `authenticated` solo pueden leer el snapshot publicado y activo. La escritura se reserva al `service_role`, que nunca se expone al navegador.

## Carga del snapshot

Después de crear el proyecto Supabase V2 y aplicar la migración:

```powershell
$env:SUPABASE_V2_URL='https://PROJECT_REF.supabase.co'
$env:SUPABASE_V2_SERVICE_ROLE_KEY='...'
npm run v2:seed
```

El importador carga primero el snapshot nuevo como borrador, reemplaza sus hijos y solo al final lo publica como activo. Un error intermedio no publica un conjunto a medias.

## Límites que se conservan

- No hay presupuesto/meta aprobada.
- No hay cash bancario.
- No existen marca, marketplaces ni landed costs en la fuente.
- Los límites de crédito, responsables y políticas de inventario tienen cobertura o definición incompleta.
- El detalle operativo heredado todavía lee el Supabase anterior; la franja V2 no lo disfraza ni lo mezcla. La sustitución total requiere poblar el nuevo proyecto con el detalle Odoo y cambiar el adaptador heredado.

## Verificación

```text
npm run test:v2
npm run build
```

La suite heredada mantiene en rojo las pruebas que consultan el Supabase antiguo. Es una deuda de la fuente productiva anterior, no una regresión introducida por la capa V2.
