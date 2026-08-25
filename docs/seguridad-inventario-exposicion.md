# Inventario de exposición — Frente 3 (ciberseguridad)

Fecha del levantamiento: **2026-08-24**. Todo lo de acá se comprobó por lectura
de disco o por consulta **GET** (solo lectura) a Supabase. Ninguna clave real se
transcribe: se nombra la variable y el archivo, nunca el valor.

## Resumen por sistema

| Sistema | Ruta | Clave al navegador | Rol `anon` | ¿Auth real? | ¿Datos reales? |
|---|---|---|---|---|---|
| Dashboard CxC | `dashboard-cxc/prototipo` | publishable, **hardcodeada y commiteada** | SELECT+INSERT+UPDATE en 11 tablas | **No** | **Sí — 3.182 facturas, Q19,3 M** |
| FlowForge Visual | `flowforge-visual` | publishable, **hardcodeada y commiteada** | **ALL, incluido DELETE** | **No** | Sí (5 proyectos, 10 tareas) |
| Cotizador EDGE | `edge-cascos/cotizador` | ninguna | no aplica — no hay backend | no aplica | No hay base |
| jimmys-planner | `C:\Users\juand\jimmys-planner` | **ninguna** (clave secreta solo en servidor) | no expuesto | Sí, con reparos | Sí |

## 1. Dashboard CxC — `C:\Users\juand\SAAAS-Marketing\proyectos\dashboard-cxc\prototipo`

**Proyecto Supabase:** `jfvmuemyjcdesnoqeaix`

### Qué clave viaja al navegador
La clave *publishable* NO está en `.env.local`. La única variable de ese archivo
es `VERCEL_OIDC_TOKEN`. La clave está **escrita literalmente en el código
fuente**, en al menos 8 archivos rastreados por git:

- `lib/datosReales.ts:63` (`SUPABASE_ANON_KEY`)
- `lib/verificacionOdoo.ts:16`
- `scripts/importar-{facturas,pagos,saldos,ventas,inventario}-odoo.mjs`
- `scripts/reconciliacion-tmp.mjs:4`
- `verificacion/linea-base.mjs:14`
- `_rls-temporal.sql:6` — **dentro de un comentario**

### El agravante que no estaba en el diagnóstico previo
El repositorio `Benserca182026/dashboard-cxc` es **PÚBLICO**. El archivo que
contiene la clave se descarga sin ninguna credencial:

    curl https://raw.githubusercontent.com/.../main/lib/datosReales.ts  -> HTTP 200

y la clave publicada ahí es **byte a byte la misma** que responde HTTP 200
contra la base. La exposición no requiere que alguien adivine la URL del
dashboard: está indexada en GitHub.

### Permisos del rol anon
`_rls-temporal.sql` + `_rls-temporal-ventas-inventario.sql` conceden a `anon`
SELECT, INSERT y UPDATE. **No conceden DELETE** (no se probó si de hecho lo
concede, y no debe probarse).

Ambos archivos dicen en su encabezado «NO SE EJECUTÓ TODAVÍA». **Eso es falso
hoy**: la adenda de `_rls-temporal.sql` (líneas 83-94) narra un rechazo real de
RLS ocurrido al recargar, y las tablas tienen datos que sólo pudieron entrar con
esas políticas puestas. El comentario quedó desactualizado respecto del hecho.

### Datos reales — comprobado, no supuesto

    clientes                 372
    facturas               3.182
    pagos                  4.020
    saldos_odoo              924
    productos                751
    ventas                 3.234
    venta_lineas          23.869
    movimientos_inventario 10.456
    condiciones_pago / notas_credito / disputas: 0

Agregados: `monto_original` suma **Q19.326.011,61**; `saldo_pendiente_odoo` suma
**Q1.133.597,08**; los pagos suman **Q16.674.466,20**, con fechas de 2022-08-09 a
2026-08-18. Esto es contabilidad real de Benserca 18, no un fixture.

### Quién escribió esos datos
Los importadores usan **únicamente** la clave publishable
(`scripts/lib-importacion-odoo.mjs:329-345` manda `apikey`/`Authorization` con
esa clave). No aparece `service_role` ni `sb_secret` en ningún script. Es decir:
**las 3.182 facturas entraron a la base como rol `anon`.** La escritura anónima
no es una hipótesis sobre la configuración, es un hecho ya ocurrido.

### Autenticación
No hay. `app/login/page.tsx` (6.809 bytes) lo declara en su propio encabezado,
líneas 5-9. `https://dashboard-cxc.vercel.app` responde **HTTP 200 directo**,
sin redirección a `/login`, sirviendo el dashboard.

### Un hallazgo que condiciona todo el diseño de auth
`GET /auth/v1/settings` del proyecto devuelve:

    "email": true , "disable_signup": false

**El auto-registro está abierto.** Cualquier persona puede crearse una cuenta en
este proyecto. Por lo tanto una política RLS escrita `to authenticated` **no
protege nada**: basta registrarse para entrar en ese rol. Las políticas nuevas
deben filtrar por *rol asignado*, nunca por «estar autenticado».

## 2. FlowForge Visual — `C:\Users\juand\SAAAS-Marketing\proyectos\flowforge-visual`

**Proyecto Supabase:** `wvwqeizmxucpdentpkbl`. 13 archivos.

`supabase/schema.sql` (3.070 bytes) es más permisivo que el de CxC: cuatro
políticas `for all to anon, authenticated using (true) with check (true)`
(líneas 47-61) **más** grants explícitos con DELETE (líneas 73-76). Es decir,
borrado anónimo autorizado por dos vías.

La clave está en `app/supabase.js:2`. El proyecto **no tiene `.git` propio**:
está commiteado dentro de `juandroeleven-jpg/SAAAS-Marketing`, que también es
**PÚBLICO** (HTTP 200 anónimo, en `main` y en `master`). No hay ningún archivo de
login, sesión o auth en `app/`.

## 3. Cotizador EDGE — `C:\Users\juand\SAAAS-Marketing\proyectos\edge-cascos\cotizador`

33 archivos de fuente. **No habla con Supabase ni con ninguna base**: el grep de
`supabase|api_key|process.env` sobre la fuente no devuelve una sola línea. Los
precios salen de `lib/calcularPrecio.ts` y `lib/catalogo.ts`, en el bundle. No
hay secreto que filtrar porque no hay backend. **Sin exposición de datos.**

## 4. jimmys-planner — `C:\Users\juand\jimmys-planner`

Es el **único de los cuatro que hace lo correcto** con las claves, y por eso
sirve de modelo.

- `.env.local` contiene `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
  `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`.
- **No hay una sola aparición de `NEXT_PUBLIC_`** en todo el proyecto: ninguna
  clave viaja al navegador.
- La clave secreta se usa sólo en servidor (`lib/supabase.ts:16-19`, consumida
  desde `app/api/tareas/route.ts`).
- Tiene `middleware.ts` (718 bytes) que protege **todas** las rutas.

Reparos reales, que hay que **no** copiar:
1. `app/api/login/route.ts:4-5` define usuario y contraseña como **constantes
   literales en el código fuente**. Son credenciales de verdad, versionadas.
2. La cookie de sesión guarda un **valor constante**, no un token firmado. Quien
   sepa el nombre y el valor de la cookie se la fabrica en el navegador y entra
   sin pasar por el login. El middleware sólo comprueba que la cookie exista.

### Corrección a un hecho de partida
El encargo decía «jimmys-planner NO TIENE GIT: cualquier escritura es
irreversible». **Hoy ya no es cierto**: el repositorio existe, con 1 commit del
**2026-08-24 15:09:50**, mensaje «Estado inicial de jimmys-planner (captura
previa a cualquier cambio)», sin remoto y con el árbol limpio. Alguien tomó la
instantánea de resguardo. Igual no se escribió nada ahí.

### Riesgo aparte, no relacionado con Supabase
`C:\Users\juand\jimmys-planner\.perfil-navegador\` es un **perfil persistente de
navegador** y contiene `Default/Login Data`, `Default/Login Data For Account` y
`Default/Network/Cookies`: sesiones guardadas de sitios reales. Está en
`.gitignore` y git **no rastrea ninguno** de sus archivos — verificado. El riesgo
no es de publicación, es local: cualquier proceso con acceso al disco lee esas
sesiones. Es también la prueba de que el equipo ya opera un navegador con sesión
persistente, lo que importa para el portal bancario.
