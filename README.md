# Prototipo — Dashboard de Cuentas por Cobrar (CxC)

Prototipo funcional construido a partir de la documentación de los Pasos 1-6
(`proyectos/dashboard-cxc/*.md`). **Todos los datos son ficticios** y **ninguna
fórmula está aprobada por Finanzas** — los indicadores simulados (forecast,
DSO, CEI, scoring) lo declaran en pantalla con sus supuestos.

## Separación de referencias (regla del plan maestro)

- **shadcn-admin** → solo referencia visual/UX (sidebar, tarjetas KPI, tablas,
  estados). Implementación propia con Tailwind, sin copiar código.
- **AR Cockpit** → solo referencia funcional de módulos CxC (aging, worklist,
  forecast, import CSV). Lógica reescrita desde cero; los coeficientes/umbrales
  de la demo original se descartaron.

## Módulos

| Ruta | Módulo (Paso 3) |
|---|---|
| `/` | M1 — Resumen de cartera |
| `/aging` | M2 — Aging con fecha de corte configurable (buckets actual/1-30/31-60/61-90/90+) |
| `/prioritarios` | M3 — Clientes prioritarios (score **simulado**) |
| `/forecast` | M4 — Forecast (**solo simulación**, Decisión B) |
| `/seguimiento` | M5 — Seguimiento de cobros (gestiones locales en localStorage, Decisión A) |
| `/datos` | M6 — Carga CSV + reporte de calidad (filas descartadas con motivo) |

## Reglas de negocio implementadas (Pasos 4-6)

- `saldo_pendiente` = monto original − pagos aplicados − notas de crédito
  aplicadas (campo derivado, nunca se ingresa a mano).
- `estado_disputa` es fuente de verdad; `disputada` es resumen derivado y
  excluyente de `abierta`. Una disputa sobre factura ya pagada **no** reabre
  saldo ni cambia el estado.
- Aging: `días de atraso = fecha de corte − fecha de vencimiento`, con fecha de
  corte **siempre explícita** (nunca "hoy" implícito). Facturas sin fecha de
  vencimiento se excluyen y se reportan — jamás se les inventa fecha.
- Import CSV: auto-detección de columnas con mapeo editable, normalización de
  montos EU/US, detección de orden de fecha con override, duplicados
  `(cliente, número de factura)` rechazados con motivo.

## Instalación y ejecución local

```bash
cd proyectos/dashboard-cxc/prototipo
npm install
npm run dev        # http://localhost:3000
```

## Verificación

```bash
npm test           # pruebas de cálculos contra los totales de control de Pasos 5 y 6
npm run lint       # ESLint (next/core-web-vitals)
npm run build      # build de producción
```

Las pruebas validan, entre otros: saldo total $7,700.00 del dataset base
(Paso 5 §5), los 7 bordes exactos de bucket (Paso 6 §3.2), la conciliación del
fixture extendido $7,708.00/$7,709.00 con `DEMO-1014` como única diferencia
(Paso 6 §4), y que una disputa activa sobre una factura pagada no la reintroduce
al aging (Paso 4 §2.1).

## Variables de entorno

Ninguna. El prototipo no se conecta a bases de datos, ERP ni APIs externas; el
CSV importado se procesa 100% en el navegador y las gestiones de cobranza se
guardan solo en `localStorage`.

## Despliegue en Vercel

1. Importar el repositorio en Vercel.
2. **Root Directory:** `proyectos/dashboard-cxc/prototipo`
3. Framework preset: Next.js (auto-detectado). Sin variables de entorno.
4. Deploy.

## Límites conocidos

- Los indicadores DSO/CEI/forecast/scoring usan cifras y pesos ficticios — solo
  demuestran la mecánica visual (los supuestos exactos están en
  `lib/simulados.ts` y visibles en cada pantalla).
- Monomoneda (USD ficticio); `tipos_cambio` del Paso 4 aún no se ejercita.
- M5 no tiene backend: la bitácora vive por navegador (localStorage).
- La convención de bordes de bucket (día 0 → `actual`) es un supuesto propio
  pendiente de confirmar con Finanzas (Paso 6 §8).
