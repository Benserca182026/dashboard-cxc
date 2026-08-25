# Diseño de autenticación mínima — Dashboard CxC

Complementa `docs/seguridad-inventario-exposicion.md`, que trae las pruebas.
Nada de acá está aplicado: es el diseño, listo para ejecutarse cuando una
persona elija el modelo de roles (§3).

## 0. La constatación que manda sobre el resto

**Con la base abierta a escritura anónima, conectar credenciales bancarias no se
puede hacer.** No es una recomendación de prudencia: la clave que autoriza
escritura está publicada en un repositorio público de GitHub, y ya se escribieron
3.182 facturas reales con ella. Un depósito de credenciales bancarias en este
proyecto sería legible y alterable por cualquiera que abra el repo. El renglón de
cuentas por cobrar depende de cerrar esto primero.

## 1. Identidad

Supabase Auth con **correo y contraseña**, que ya está habilitado en el proyecto
(`"email": true`). No hace falta proveedor externo.

Dos cosas hay que cambiar **antes** de escribir una sola política:

1. **Cerrar el auto-registro.** Hoy `"disable_signup": false`: cualquiera se crea
   una cuenta. Mientras eso siga así, `to authenticated` es equivalente a `to
   anon` con un paso extra. Se cierra en Authentication → Providers → Email, y
   los usuarios se crean a mano o por invitación.
2. **Rotar la clave publishable** y sacarla del código. Está en un repo público:
   revocarla es parte del arreglo, no un extra. Rotarla sin sacarla del código
   sólo reinicia el reloj.

## 2. Dónde vive el rol

En `raw_app_meta_data` del usuario — **no** en `raw_user_meta_data**.

Distinción que decide la seguridad del modelo: `user_meta_data` es escribible por
el propio usuario vía `supabase.auth.updateUser()`. Si el rol viviera ahí,
cualquiera se ascendería a `admin` desde la consola del navegador.
`app_meta_data` sólo se escribe con la clave de servicio, y viaja firmado dentro
del JWT. Se lee en SQL así:

```sql
create or replace function public.rol_actual()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', 'ninguno')
$$;
```

## 3. Los tres perfiles a elegir — decide una persona, no este documento

El modelo de roles es una decisión de negocio. Van tres opciones plausibles para
que alguien marque una; el resto del diseño no depende de cuál se elija.

**Perfil A — «Todos ven todo, casi nadie escribe»** (2 roles: `lectura`,
`gestion`). El más simple. Sirve si las 372 cuentas las trabaja un equipo chico
sin repartición por cartera. *Descartado como recomendación* porque no responde
«¿el vendedor X puede ver la cartera del vendedor Y?», que en cobranza casi
siempre importa.

**Perfil B — «Cartera propia»** (3 roles: `cobrador`, `supervisor`, `finanzas`).
El cobrador ve sólo sus clientes asignados; el supervisor ve todas las carteras;
finanzas además ve márgenes y costos. Requiere una columna nueva
`clientes.responsable_id`, que **hoy no existe** — el esquema
(`_esquema-cxc-real.sql:9-16`) no tiene campo de responsable, así que esta opción
implica migración y decidir quién es dueño de cada cuenta.

**Perfil C — «Separar leer de mover el dato»** (3 roles: `consulta`, `operacion`,
`admin`). Nadie escribe desde el navegador; sólo los importadores, con clave de
servicio en servidor. *Es el que recomiendo* bajo el criterio de **mínimo cambio
que elimina el riesgo activo**: corta hoy la escritura anónima —que es el daño
real y ya consumado— sin exigir la migración de `responsable_id` ni una decisión
organizativa que nadie ha tomado todavía. B es mejor destino; C se puede aplicar
esta semana y no bloquea llegar a B después.

## 4. Políticas RLS por rol — versión para el Perfil C

Reemplaza a `_rls-temporal.sql` y `_rls-temporal-ventas-inventario.sql`. **No
está ejecutado.** Primero el `drop` simétrico que ya traen esos dos archivos al
pie; después esto:

```sql
-- Nadie anónimo. Ni una tabla, ni una operación.
revoke all on all tables in schema public from anon;

-- Lectura: cualquier rol reconocido. Escritura: ninguno desde el navegador.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','condiciones_pago','facturas','pagos','notas_credito',
    'disputas','saldos_odoo','productos','ventas','venta_lineas',
    'movimientos_inventario'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$
      create policy "lectura_por_rol" on public.%I
        for select to authenticated
        using (public.rol_actual() in ('consulta','operacion','admin'))
    $f$, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
```

Nótese que la política **no dice `to authenticated using (true)`**. Si lo dijera,
y con el auto-registro abierto, cualquiera leería la cartera completa. Filtra por
rol asignado, que sólo se otorga con clave de servicio.

Las cargas desde Odoo pasan a correr con `SUPABASE_SECRET_KEY` en el entorno del
script, nunca en el bundle. RLS no aplica al rol de servicio, así que los
importadores siguen funcionando igual sin ninguna política de escritura.

## 5. Middleware

`middleware.ts` ya está creado en la raíz del proyecto, **desactivado a
propósito**: sin la variable `CXC_AUTH_ACTIVA=1` deja pasar todo, tal como hoy.
Se enciende con esa variable el día que existan usuarios. Está así porque hay
otros dos frentes trabajando en este repositorio ahora mismo y un middleware que
redirija todo a `/login` les rompería el trabajo en curso.

La forma está tomada de `C:\Users\juand\jimmys-planner\middleware.ts`, que ya
resuelve bien el problema. **No** se copió su mecanismo de cookie: allí la cookie
guarda un valor constante y se puede falsificar a mano. Acá se valida el JWT de
Supabase, que va firmado.

## 6. El login se reemplaza entero

`app/login/page.tsx` no se endurece. Lo dice el propio archivo, líneas 8-9:

> «Cualquier valor entra. El día que haya auth real, este archivo se reemplaza
> entero — no se "endurece".»

Es coherente: no hay nada que endurecer, porque no hay verificación que reforzar.
El `entrar()` de la línea 45 hace `setTimeout(() => router.push("/"), 460)` — un
temporizador, no una comprobación. La animación de la cadena
Inventario → Ventas → Cobro (líneas 17-21, 80-101) es lo único que vale la pena
conservar; el formulario y su lógica se tiran.

## 7. Orden de ejecución

1. Rotar la clave publishable y sacarla de los 8 archivos + del comentario de
   `_rls-temporal.sql:6`.
2. Cerrar el auto-registro.
3. Aplicar los `drop` de las políticas temporales y el bloque de §4.
4. Crear los usuarios a mano, con su `rol` en `app_meta_data`.
5. Reemplazar `app/login/page.tsx`.
6. Poner `CXC_AUTH_ACTIVA=1`.
7. Recién ahí, evaluar el banco.

Hasta el paso 6 inclusive, el dashboard sigue expuesto. Los pasos 1-3 son los que
detienen el daño; 4-6 son los que devuelven el acceso a quien corresponde.
