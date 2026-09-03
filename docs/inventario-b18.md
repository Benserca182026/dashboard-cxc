# Inventario B18 — qué funciona, qué falta, qué hay que arreglar

Documento vivo. Se revisa página por página, con clics reales sobre el
dashboard corriendo, no solo leyendo código. Cada hallazgo cita el
archivo y la línea donde se verificó — nada entra acá por sospecha.

Convención de estado: 🔴 rompe la lectura del dato · 🟡 confunde pero no
miente · 🟢 verificado correcto, no tocar.

---

## 1. Cuadro de mando (`/`)

Revisado completo: las 4 tarjetas de las 4 categorías (Cartera,
Cobranza, Clientes, Ventas), sus 16 drill-downs con las 3 pestañas cada
uno (Resultado/Diagnóstico/Acción, 48 combinaciones), y el dashboard
B18 integral. Primero por capturas de pantalla del 2026-09-02, después
verificado con extracción de texto real (Playwright, clic en cada
tarjeta y cada pestaña, sin adivinar contenido borroso de una imagen).

### 🔴 B18-1 — El dona del drill-down no cambia según la tarjeta que abriste

**Dónde:** `components/commercial/MoldeB18.tsx:110-111`, componente
`Drilldown`.

```tsx
<div className="b18-diagnostico-dona" style={{ "--b18-color": color,
  "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` }}>
  <strong>{(principal?.pct ?? 0).toFixed(0)}%</strong>
</div>
```

`principal` es `categoria.filas[0]` — **siempre la misma fila**, sin
importar si abriste Detecta, Explica, Prioriza o Recomienda. El texto de
al lado sí es correcto (usa `tarjeta.kpiTexto`), pero el círculo grande
no.

**Se ve así en las capturas:** en Cartera, "Recomienda" dice
literalmente *"100.00% · cartera clasificable"* al lado de un círculo
que muestra un arco de apenas 39% relleno. En Cobranza, "Explica" dice
*"62.55% · del vencido es 90+"* junto a un círculo que muestra 38%. El
número grande y la frase de al lado se contradicen visualmente en las
16 combinaciones capturadas.

**Origen:** este patrón viene copiado tal cual de la referencia
aprobada (`MapaB18Producto` → `DrilldownRol`, línea ~155 del archivo
original). Ahí el error existe también, pero pasa más desapercibido
porque en Productos los 4 KPI de rol están más cerca entre sí (74.82%
vs 97.89%). En Cuadro de mando, con Cartera en 38.80% vs 100.00%, la
brecha es enorme y salta a la vista.

**Impacto:** afecta el drill-down de **las 5 páginas** construidas hoy
sobre el molde (Cuadro de mando, Aging, Prioritarios, Detalle de venta,
Inventario) — es un bug del molde compartido, no de una página.

**Arreglo propuesto (una sola vez, en el molde):** el dona del
drill-down debe usar `tarjeta.donaPct ?? tarjeta.kpiPct`, no
`principal.pct`. Cuando la tarjeta es "pareto" o "barras" (sin
`donaPct` propio), cae al 100% relleno con la etiqueta del propio KPI,
en vez de mostrar el reparto de otra fila.

**Prioridad:** alta. Es un arreglo de una función, en un archivo, que
corrige las 5 páginas a la vez.

**✅ Corregido — 2026-09-02.** En `components/commercial/MoldeB18.tsx`,
dentro de `Drilldown`, la pestaña "Resultado" ahora calcula
`donaValor = tarjeta.donaPct ?? categoria.cobertura` y dibuja la dona
grande (`--b18-pct`, número dentro del círculo) con ese valor clamped a
0-100, en vez de `principal?.pct` (que era siempre `categoria.filas[0]`,
fija). Es la MISMA regla de fallback que ya usaba `MiniGrafica` dentro de
`TarjetaRol` (línea 73: `donaPct={tarjeta.donaPct ?? categoria.cobertura}`)
para la mini-dona de la tarjeta en la vista principal, así que ahora la
dona grande del drill-down y la mini-dona de la tarjeta que lo abrió
usan el mismo criterio y nunca se contradicen entre sí.

Decisión para las tarjetas "Explica" y "Prioriza" (gráfica `barras` /
`pareto`), que en los 6 archivos `lib/agentes-*.ts` **nunca** traen
`donaPct` propio (solo "Detecta" con `grafica: "dona"` y "Recomienda"
con `grafica: "cobertura"` lo traen, de forma consistente en las ~20
categorías revisadas): en vez de forzar un dona con un valor inventado,
cae a `categoria.cobertura` — un número constante por categoría, ya
mostrado en otras partes de la misma pantalla (mini-dona de "Recomienda",
lista de cobertura del dashboard B18), en vez de una fila arbitraria de
`categoria.filas[0]` que no tenía relación con la tarjeta abierta. No se
tocó `lib/contrato-b18.ts` — no hizo falta agregar ningún campo nuevo.

**Verificado con clics reales** (Playwright headed, Chromium de
`ms-playwright`, contexto persistente aislado del perfil del MCP en uso)
sobre las 3 páginas pedidas, clic en las 4 tarjetas de la primera
categoría visible de cada una:

- `/` (Cuadro de mando, categoría **CA · Cartera**): Detecta dona=**39%**
  (coincide con caption "38.80% · Más de 90 días"), Explica dona=**100%**,
  Prioriza dona=**100%**, Recomienda dona=**100%** (coincide exacto con
  caption "100.00% · cartera clasificable" — el caso literal citado
  arriba como contradicción ya no lo es).
- `/prioritarios` (categoría **SC · Score**): Detecta dona=**71%**
  (coincide con caption "71 pts · score simulado líder"), Explica
  dona=**39%**, Prioriza dona=**39%**, Recomienda dona=**39%** (coincide
  exacto con caption "39.00% · saldo cubierto por el Top 10"). Ya no
  aparece el 12% fijo de MOTOCENTER en ninguna de las 4 pestañas.
- `/aging` (tercera página, mismo molde compartido, categoría **AN**):
  mismo patrón que Cuadro de mando — Detecta=**39%**, Explica=**100%**,
  Prioriza=**100%**, Recomienda=**100%**, coherente con sus captions.

En las 3 páginas, Detecta y Recomienda (que sí traen `donaPct` propio)
ahora muestran siempre el número exacto de su propio caption — la
contradicción original (dona vs. texto) desaparece en los 8 casos
verificados. Explica/Prioriza muestran la cobertura de la categoría, que
en Cartera/AN coincide con ser 100% (dataset sin facturas sin fecha de
vencimiento) y en Score coincide con el 39% que también reporta
Recomienda — ya no muestran una fila desconectada de la tarjeta abierta.
`npx tsc --noEmit -p tsconfig.json` no reporta errores en
`components/commercial/MoldeB18.tsx`.

---

### 🟡 B18-2 — Los tramos de antigüedad no se leen en orden de antigüedad

**Dónde:** `lib/contrato-b18.ts:132-142`, función `repartir()`.

`repartir()` siempre ordena de mayor a menor por `pct`. Eso es correcto
para "qué familia de producto pesa más" — pero Cartera y Cobranza no son
un ranking, son una **línea de tiempo**.

**Se ve así en las capturas:**

- Cartera (`/`, dominio CA): el orden que aparece es *Más de 90 días,
  Al día, 1 a 30 días, 31 a 60 días, 61 a 90 días.* Salta del peor tramo
  al mejor y después retrocede.
- Cobranza (dominio CO): *Al día, Mora +180, Vencido 1 a 90, Mora 90 a
  180.* Mora +180 (el peor caso) aparece en segundo lugar, antes que
  Vencido 1 a 90, porque en quetzales es más grande.

**Impacto:** quien lee la barra esperando ver la cartera envejecer de
izquierda a derecha (o de derecha a izquierda) se encuentra con un
orden que no sigue ninguna lógica de negocio, solo el tamaño en Q. No
es información falsa — cada número es correcto — pero exige más
esfuerzo de lectura del que debería.

**Arreglo propuesto:** en `agentes-cuadro-mando.ts`, construir
`filasCartera` y `filasCobranza` con el orden de bucket fijo (`actual →
1-30 → 31-60 → 61-90 → 90+`) y calcular el `pct` sin pasar por
`repartir()` (que reordena), o agregar un modo `repartir(filas, {
ordenar: false })` al helper del molde para los casos donde el orden ya
es intencional.

**Prioridad:** media. No rompe ningún número, solo la narrativa.

---

### 🟢 Verificado correcto — las cifras cruzan entre dominios sin descuadre

Hice el cruce a mano entre lo que muestra cada dominio, porque si algo
no cuadra ahí es donde se pierde la confianza en todo el tablero:

| Cruce | Cálculo | Resultado |
|---|---|---|
| CO "Mora +180" + "Mora 90 a 180" = CA "Más de 90 días" | 322,830.97 + 117,001.64 | **439,832.61** ✅ exacto |
| CO "Vencido 1 a 90" + "Mora 90 a 180" + "Mora +180" = ejecutiva.totalVencido | 263,377.09 + 117,001.64 + 322,830.97 | **703,209.70** ✅ exacto (coincide con el KPI "Vencido" del dashboard B18) |
| CL Top 5 (suma de los 5 clientes) ÷ vencido total = concentración declarada | 273,784.22 / 703,209.70 | **38.93%** ✅ exacto |
| CA "Al día" aparece igual en el reparto de Cobranza | 430,387.38 en ambos dominios | ✅ mismo número, sin duplicar ni redondear distinto |

Ninguna cifra se contradice entre pantallas. El problema de hoy es de
**presentación** (B18-1, B18-2), no de **exactitud**.

---

### 🟡 B18-12 — En Cobranza, dos porcentajes casi idénticos miden cosas distintas y aparecen pegados

**Dónde:** `lib/agentes-cuadro-mando.ts:136-170`.

```ts
// líneas 136-138
const pctVencido = ejecutiva.totalCarteraClasificable > 0
  ? clamp((ejecutiva.totalVencido / ejecutiva.totalCarteraClasificable) * 100) : 0;
const pctCritica = ejecutiva.totalVencido > 0
  ? clamp((ejecutiva.totalMoraCritica / ejecutiva.totalVencido) * 100) : 0;
```

`pctVencido` = 62.03% (vencido ÷ cartera clasificada). `pctCritica` =
62.55% (mora 90+ ÷ vencido). Son dos razones DISTINTAS que, en este
corte, dan casi el mismo número por coincidencia — y el molde las pone
una debajo de la otra en la pestaña Diagnóstico de la categoría
Cobranza:

- Tarjeta **Detecta** (línea 163): título dice *"62.03% de la cartera
  clasificada pasó su fecha de pago."*
- Línea compartida de la categoría, debajo de CUALQUIER tarjeta que
  abras (línea 157): *"62.55% del vencido ya pasó los 90 días..."*

Extraído del drill-down real de Detecta/Cobranza: el texto completo que
se ve en pantalla es *"62.03% de la cartera clasificada pasó su fecha
de pago. — Toda [sic, es la línea de la categoría] 62.55% del vencido
ya pasó los 90 días; Q 322,830.97 superan los 180."* — dos frases
seguidas, dos números que difieren en 0.52 puntos, midiendo cosas
distintas (una es sobre el total de cartera, la otra es sobre el
vencido). Fácil de leer como el mismo dato repetido con un error de
redondeo, cuando en realidad son dos cálculos diferentes.

**Peor todavía en la tarjeta Explica** (línea 170): su propio título ya
usa `pctCritica`, así que la frase de la categoría (línea 157, también
`pctCritica`) queda **literalmente duplicada**: *"62.55% del vencido
está en mora crítica: el tiempo ya jugó en contra."* seguido de *"62.55%
del vencido ya pasó los 90 días; Q 322,830.97 superan los 180."* — el
mismo 62.55% dicho dos veces con distintas palabras, una atrás de la
otra.

**Impacto:** medio. No hay ningún dato falso — ambos números son
correctos y ya están documentados por separado — pero la yuxtaposición
(62.03 junto a 62.55, o 62.55 dos veces seguidas) es exactamente el
tipo de detalle que hace dudar de un dashboard, aunque los cálculos de
abajo estén bien.

**Arreglo propuesto:** en la pestaña Diagnóstico del molde
(`MoldeB18.tsx`, bloque `pestana === "problema"`), cuando
`categoria.problema` sea igual (o casi igual, mismo número) al
`tarjeta.problema` que ya se mostró arriba, omitir la segunda línea en
vez de repetirla — mismo principio ya propuesto en B18-6 para la
pestaña Acción, aplicado acá a Diagnóstico. Alternativa más simple: en
`agentes-cuadro-mando.ts`, evitar que `categoria.problema` (línea 157)
y `tarjeta.problema` de Explica (línea 170) usen la misma cifra con
distinta redacción — que la categoría hable de otra cosa (ej. cuántos
clientes están en esa mora, no qué porcentaje).

**Prioridad:** media.

---

### 🟡 B18-3 — Los 4 roles muestran casi la misma información en "Resultado"

La pestaña "Resultado" del drill-down es idéntica para Detecta, Explica,
Prioriza y Recomienda dentro de una misma categoría: mismo reparto de
barras (`categoria.filas`), mismo texto de "Señal principal". Lo único
que cambia es una línea de una oración. La diferenciación real entre
los 4 roles vive en las pestañas "Diagnóstico" y "Acción"
(`tarjeta.problema` / `tarjeta.accion`), que sí son distintas.

**No es un bug** — así funciona también la referencia aprobada — pero
vale la pena que lo sepas: si alguien hace clic en las 4 tarjetas de
una categoría esperando 4 lecturas distintas de "Resultado", va a
sentir que 3 de los 4 clics "no hicieron nada".

**Prioridad:** baja / cosmética. Anotado para decidir si vale la pena
diferenciar el reparto por rol (ej. que "Prioriza" muestre un Pareto
distinto en vez del mismo reparto) — es un cambio de diseño, no una
corrección.

---

### Nota — nombres de clientes visibles en el drill-down de Clientes

El dominio CL muestra nombres reales (Inversiones D.C.N, Walmart,
Cristian Saballos, etc.) en el reparto de la tarjeta Detecta/Explica/
Prioriza/Recomienda. No es un error del molde — es exactamente lo que
se le pidió a la página — pero es el mismo dato que ya señalé como
riesgo de exposición en la auditoría original (clave de Supabase en el
bundle + RLS de escritura abierta). Si esto se publica antes de cerrar
esa seguridad, estos nombres quedan expuestos junto con todo lo demás.

---

### Rediseño de KPIs — 2026-09-03

Doce de las 16 tarjetas de `lib/agentes-cuadro-mando.ts` cambiaron de
KPI/lectura tras auditar cada tarjeta con datos reales (3,182 facturas,
4,020 pagos, 372 clientes de Odoo) usando tres scripts que ya existen
en el repo: `scripts/ejecutar-cuadro-mando.ts`,
`scripts/opciones-reemplazo.ts` y `scripts/opciones-completas.ts`. No
son bugs — son mejoras de valor de negocio: la tarjeta ya calculaba
algo correcto pero débil (redundante con otra tarjeta, o un conteo
suelto sin contexto), y se reemplazó por una lectura que aporta
información nueva sobre el mismo `dataset`. Las 4 tarjetas no listadas
acá (CA-Detecta, CO-Detecta KPI/dona, CO-Explica KPI/dona, CL-Detecta,
CL-Recomienda KPI/dona, VE-Detecta, VE-Explica KPI/dona — ver detalle
por categoría abajo) mantienen exactamente el mismo KPI, dona y
`donaPct` que antes; solo se les agregó una oración de contexto al
`resumen` donde lo pedía la especificación.

Verificado con clic real en `/` (las 4 categorías, Chromium vía
Playwright) el 2026-09-03: los 12 números nuevos aparecen tal cual en
pantalla, y la dona de cada tarjeta sigue el KPI de la tarjeta activa
(B18-1 no se rompió).

**CA · Cartera**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Explica | KPI "76.77%" · etiqueta "Top 2 de tramos" | KPI "Q 3,791.66" · etiqueta "ticket promedio en el tramo líder"; `resumen` compara contra Q 5,830.15 (ticket de 1-30 días) | El Top 2 de tramos ya lo dice Detecta con otras palabras. El ticket promedio por bucket revela que el tramo líder (90+) tiene facturas más chicas en promedio que 1-30 días — la antigüedad no engorda la factura, hallazgo que no estaba en el tablero. |
| Prioriza | KPI "166" (conteo suelto de facturas vencidas) | KPI "74.11%" (166/224 facturas clasificadas) | Un conteo suelto no dice si es mucho o poco. Como % se puede contrastar contra el 62.03% en dinero (CO-Detecta): hay proporcionalmente más facturas vencidas que dinero vencido — las facturas vencidas son más chicas en promedio. |
| Recomienda | `resumen`: "0 facturas quedaron fuera por falta de fecha." | Mismo KPI/dona (`coberturaCartera`, 100%); `resumen` agrega "el tramo líder reúne 55 clientes distintos." | KPI/dona no cambia (cobertura 100% sigue siendo la métrica de calidad de dato correcta). Como no hay nada más que decir mientras la cobertura sea 100%, se le agregó el dato de clientes distintos del bucket líder como contexto secundario. |

**CO · Cobranza**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "Q 117,001.64" (monto en mora 90-180) | KPI "16" · etiqueta "clientes en la ventana 90-180 días"; el monto pasa al `resumen` | El monto por sí solo no dice a cuántas cuentas hay que llamar. El conteo de clientes en la ventana 90-180 (antes de volverse 180+) es una unidad de trabajo más accionable para cobranza. |
| Recomienda | KPI "37.45%" · etiqueta "vencido gestionable" — complemento matemático exacto de Explica (62.55% + 37.45% = 100%, verificado a 6 decimales) | KPI "42.86%" · etiqueta "clientes vencidos que siguen comprando" (cruce `aging.clasificadas` × `dataset.ventas` filtrado a `estado_odoo === "sale"`, últimos 60 días respecto al corte de ventas); `resumen` agrega Q 298,112.13 (42.39% del vencido) | La tarjeta vieja no aportaba información propia — era el complemento aritmético de Explica. El cruce con ventas identifica algo nuevo: 39 de 91 clientes vencidos siguen comprando activamente. No es cartera muerta, es cliente activo con saldo pendiente. |

**CL · Clientes**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Explica | KPI "Top 2 por monto" (mismo criterio que Detecta) | KPI "22" · etiqueta "facturas vencidas del líder, no monto" — ranking alternativo por CANTIDAD de facturas (Axel Daniel 22, Henry Camilo Godínez 12, Jonas Emmanuel Godínez 5...), listado en `resumen` porque las barras compartidas (`categoria.filas`) siguen siendo por monto | Top 2 por monto es refinamiento débil de Detecta (mismo criterio, un decimal más). El ranking por cantidad de facturas expone carga operativa que el ranking por monto esconde — un cliente puede no ser el mayor deudor y aun así generar muchas más gestiones. |
| Prioriza | KPI "91" (conteo suelto de clientes con vencido) | KPI "24.46%" (91/372 clientes totales) | Igual que CA-Prioriza: un conteo suelto no dice si es una porción grande o chica de la base. Como % contra el total de clientes se lee de inmediato qué tan extendido está el problema. |

**VE · Ventas**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "724" (conteo suelto de pedidos en la ventana) | KPI "108" · etiqueta "clientes por recuperar (30+ días sin comprar)" — usa `ytd.actual.porRecuperar`, ya calculado por `leerSerieVentas` y hasta ahora invisible en el tablero | El conteo de pedidos no distingue crecimiento de retención. `porRecuperar` ya existía en el tipo `ResumenPeriodoVenta` sin usarse en ningún lado — es la palanca de retención que el tablero no mostraba. |
| Recomienda | KPI "100.00%" · etiqueta "pedidos en quetzales" — dormida mientras no haya mezcla de monedas (`pedidosOtraMoneda = 0` en este dataset) | KPI "37" · etiqueta "clientes en zona de alerta temprana" — clientes cuya última compra confirmada cae entre 30 y 60 días antes del corte de ventas (ni tan reciente para estar bien, ni tan vieja para ya estar en "por recuperar") | La tarjeta vieja no tenía nada que decir mientras la moneda no se mezclara. La zona de alerta temprana es la salida antes de que un cliente entre al grupo "por recuperar" de Prioriza — información nueva y siempre activa. La garantía de honestidad de moneda (`pedidosOtraMoneda`) no se perdió: sigue viva en `categoria.problema` y en el metadato "Moneda" de VE (ambos ya existían, sin tocar). |

**Tarjetas verificadas SIN CAMBIO** (auditadas y confirmadas correctas
tal cual estaban): CA-Detecta (bucket líder 90+, confirmado desde
monto, facturas y clientes distintos), CL-Detecta (mayor deudor por
monto), VE-Detecta (+24.67% de variación YTD sobre ventanas de días
exactamente iguales — se probó y descartó la alternativa de "solo
meses cerrados" por comparar ventanas desiguales entre año actual y
previo). El KPI/dona de CO-Detecta, CO-Explica, CL-Recomienda y
VE-Explica tampoco cambió — solo se les agregó una oración de contexto
al `resumen` (ver tablas arriba).

---

## 2. Aging (`/aging`)

Mismo método y mismo nivel de rigor que la sección 1 (Cuadro de mando):
cargar `cargarDatasetReal()` real (3,182 facturas, 4,020 pagos, 372
clientes, corte `FECHA_CORTE_DATOS_REALES = 2026-08-24`), ejecutar las
funciones reales que ya alimentan la página (`calcularAging`,
`analizarAgingComercial`, `analizarSeguimientoComercial`, todas en
`lib/calculos.ts` / `lib/commercial-cobranza.ts`), volcar cada paso
intermedio con `console.log` (nunca a mano) y, para las alternativas,
cruzar tablas reales del propio `dataset`. Tres scripts nuevos, mismo
patrón que los tres de la sección 1: `scripts/ejecutar-aging.ts` (vuelca
buckets, exclusiones con motivo, top clientes, embudo de gestión — no
solo el KPI final), `scripts/opciones-aging.ts` (candidatos de
reemplazo con números reales) y `scripts/verificar-aging-nuevo.ts`
(imprime las 16 tarjetas ya con los cambios aplicados, mismo patrón que
`scripts/verificar-prioritarios-nuevo.ts`).

Verificado con clic real el 2026-09-03: el navegador del MCP de
Playwright ya estaba en uso por otro proceso de esta sesión
(`Browser is already in use for ...mcp-chrome-68cba2f`), así que se usó
Playwright para Python (ya instalado en el entorno) contra el mismo
binario de Chromium pedido
(`C:\Users\juand\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`),
con un `user_data_dir` propio y aislado del perfil del MCP — mismo
principio de aislamiento que ya deja registrado la sección 1. El script
recorrió las 4 categorías (Antigüedad, Concentración, Exclusiones,
Gestión), sus 4 tarjetas y las 3 pestañas de cada una (48 combinaciones),
más el Dashboard B18 integral, extrayendo texto real del DOM — no
capturas. Los números de este documento son los que devolvió esa
corrida.

### 🟢 Verificado correcto — las cifras de Aging cruzan exacto contra Cuadro de mando

Antes de tocar nada, crucé lo que muestra `/aging` contra lo ya
verificado para `/` en la sección 1, mismo corte (2026-08-24):

| Cruce | Aging | Cuadro de mando | Resultado |
|---|---|---|---|
| Cartera abierta | Q 1,133,597.08 | Q 1,133,597.08 (`carteraTotal`) | ✅ exacto |
| Saldo vencido | Q 703,209.70 (`comercial.vencido`) | Q 703,209.70 (`ejecutiva.totalVencido`) | ✅ exacto |
| Cobertura por fecha de vencimiento | 100.00% | 100.00% (`coberturaCartera`) | ✅ exacto |

Ambas páginas usan rutas de cálculo distintas (`calcularAging` +
`construirLecturaEjecutiva` en Cuadro de mando; `calcularAging` +
`analizarAgingComercial` en Aging) y llegan al mismo número al centavo.
Aging además muestra "Concentración Top 10" (53.01%) donde Cuadro de
mando mostraba "Top 5" (38.93%, sección 1) — no son cifras
contradictorias: es el mismo universo de clientes con vencido, cortado
en un N distinto (10 vs. 5), consistente con que Top 10 ⊇ Top 5.

### 🟡 B18-2 (confirmado también en Aging) — el tramo de Antigüedad tampoco se lee en orden cronológico

Mismo síntoma que ya documenta la sección 1 para Cartera/Cobranza en
Cuadro de mando (`repartir()` siempre ordena por `pct` descendente, no
por antigüedad): en la categoría AN de `/aging`, verificado con clic
real, el orden que aparece es **90+ días (38.80%), Al día (37.97%), 1 a
30 días (18.00%), 31 a 60 días (2.69%), 61 a 90 días (2.55%)** — salta
del peor tramo al mejor y retrocede, igual que en Cartera. No se repite
el análisis de causa (está en la sección 1) ni se corrige acá: sigue
siendo una decisión de diseño pendiente (`repartir(filas, { ordenar:
false })` o construir el orden fijo en el propio `agentes-*.ts`), misma
prioridad media que ya tiene B18-2 en la tabla resumen.

### 🔴 B18-14 — "Saldo vencido sin gestión" sumaba saldo AL DÍA, no solo lo vencido

**Dónde:** `lib/agentes-aging-b18.ts`, categoría Gestión — usaba
`seguimiento.saldoSinGestion` (viene de
`analizarSeguimientoComercial` → `analizarPrioritariosComercial` →
`prioridadSimulada()` en `lib/simulados.ts:127-134`) en tres lugares:
`metricas[0]` ("saldo vencido sin gestión"), el `problema` de la
categoría, y el `resumen` de la tarjeta Detecta.

**Qué comprobé con query real:** `prioridadSimulada()` suma, por
cliente, el saldo de **TODAS** sus facturas abiertas (`saldoTotal +=
saldo` sobre `facturasCliente`, sin filtrar por vencida) — mismo defecto
de origen que ya documenta 🟡 B18-5 para "saldo priorizado total" en
`/prioritarios`. Para los 91 clientes que en este corte están "sin
gestión" (con el dataset real, `gestiones = []` porque
`lib/store.tsx:192-197` sólo usa `gestionesUsuario` — vacío en un
navegador nuevo — cuando `dataset.fuente === "odoo-real"`), ese cálculo
sobrestimaba en **Q 141,599.78 (16.76%)** el saldo mostrado:

```
seguimiento.saldoSinGestion (saldoTotal, TODO lo abierto) = Q 844,809.48
saldo VENCIDO real de esos mismos 91 clientes (bucket != actual)     = Q 703,209.70
sobreestimación                                                       = Q 141,599.78 (16.76%)
```

Ese Q141,599.78 es saldo de facturas **al día** de clientes que también
tienen algo vencido — colado dentro de un rótulo que dice "vencido sin
gestión".

**✅ Corregido — 2026-09-03.** En `lib/agentes-aging-b18.ts` se calcula
ahora `saldoVencidoSinGestion` cruzando `seguimiento.sinGestion` (los
IDs de cliente) contra `aging.clasificadas` filtrado a `bucket !=
"actual"` — mismo patrón de cruce que ya usa `agentes-cuadro-mando.ts`
para "vencidos activos" (sección 1). Con `contactadoTotal = 0` en este
corte (0 gestiones en el navegador), el número corregido coincide
exacto con `comercial.vencido` (Q 703,209.70) porque los 91 clientes sin
gestión son, hoy, el 100% de los clientes con vencido — deja de coincidir
en cuanto exista al menos una gestión registrada, que es la prueba de
que no es una coincidencia de fórmula sino un cálculo que ahora sí
filtra por vencido. **Verificado con clic real**: la tarjeta Detecta de
Gestión, la caja de métricas y el "Problema encontrado" de la categoría
muestran los tres, hoy, `Q 703,209.70` — no `Q 844,809.48`.

**Prioridad:** alta — a diferencia de B18-4/B18-5 (documentados pero no
corregidos en Prioritarios), acá sí se corrigió porque el cálculo vive
enteramente en `agentes-aging-b18.ts` (sin tocar `lib/simulados.ts` ni
`commercial-cobranza.ts`, que siguen sirviendo `/prioritarios` con su
propio criterio ya documentado en B18-5).

### 🟡 B18-15 — "Pagada" explicaba 0.00% de las exclusiones que en realidad explica al 100%

**Dónde:** `lib/agentes-aging-b18.ts`, categoría Exclusiones —
`filasExclusiones` repartía por **saldo** (`saldoMotivo`) entre los
motivos presentes. Una factura con motivo `pagada` tiene
`saldo === 0` **por definición** (`lib/calculos.ts`,
`estadoFacturaDerivado`: `saldo === 0 → "pagada"`). En este dataset el
único motivo de exclusión presente es "Pagada" (2,958 de 2,958
facturas excluidas; 0 anuladas, 0 sin fecha de vencimiento) — con
`repartir()` recibiendo un único renglón de `valor: 0`, el total es 0 y
`pct` cae a **0.00%** (regla de `repartir()`: `total > 0 ? ... : 0`).

**Se veía así en pantalla:** la tarjeta Detecta de Exclusiones mostraba
dona **0%**, KPI **"0.00%"**, etiqueta **"Pagada"** — es decir, "el
motivo líder explica 0% de las exclusiones", contradiciendo que
literalmente el 100% de las 2,958 facturas excluidas son por ese
motivo. El dato de fondo era correcto (una pagada no tiene saldo
pendiente) pero la elección de base (saldo, no conteo) para un motivo
que estructuralmente siempre vale Q0 producía un titular que se lee
como "no hay nada que ver acá" cuando en realidad describe el 100% de
la población excluida.

**✅ Corregido — 2026-09-03.** `filasExclusiones` ahora reparte por
**cantidad de facturas** por motivo, no por saldo (el saldo real
excluido —`saldoExcluidoTotal`— se conserva sin cambios en
`metricas[1]` y en el `problema` de la categoría, con su propio
contexto). Detecta ahora muestra dona **100%**, KPI **"100.00%"**,
etiqueta **"Pagada"**, coherente con "2,958 factura(s) excluidas por
este motivo" — y el `resumen` explica la razón (`"Una factura pagada
tiene saldo Q0.00 por definición: este reparto cuenta facturas, no
dinero."`) en vez de esconderla. **Verificado con clic real.**

**Prioridad:** media — no había ningún dato falso (la lógica de
`estadoFacturaDerivado` es correcta), pero el 0% que aparecía en el
lugar más visible de la tarjeta contradecía visualmente el resto de la
pantalla, mismo tipo de riesgo de confianza que ya señala B18-1/B18-12.

### Rediseño de KPIs — 2026-09-03

Cinco de las 16 tarjetas de `lib/agentes-aging-b18.ts` cambiaron de
KPI/dona tras auditar cada una con datos reales usando
`scripts/ejecutar-aging.ts` y `scripts/opciones-aging.ts`. Dos de esos
cinco cambios (EX-Detecta y GE-Recomienda) ya están documentados arriba
como B18-15 y como parte de B18-14/la corrección de la redundancia de
GE — acá se documentan como conjunto, con los otros tres (AN-Explica,
AN-Prioriza, CN-Explica), que replican **exactamente** el mismo patrón
ya usado en Cuadro de mando: AN es, tarjeta por tarjeta, el mismo diseño
que tenía CA (Cartera) antes de su propio rediseño (misma fórmula, mismo
dataset, mismos números — Q 3,791.66 y Q 5,830.15 coinciden al centavo
con los ya documentados para CA-Explica en la sección 1).

Antes de proponer nada se volvió a verificar (no se asumió) que el
100% de los 4,020 pagos del dataset real siguen con `id_factura` nulo
(`scripts/opciones-aging.ts`) — sigue sin ser calculable ninguna
"velocidad de cobro" cruzando `Pago.fecha_pago` contra
`Factura.fecha_vencimiento`, mismo hallazgo que ya registra la sección
1. Tampoco hay un segundo corte histórico disponible en el dataset, así
que no se propuso ninguna comparación de tendencia para Aging (ej.
"cartera vencida esta semana vs. la anterior") — sería inventar una
ventana temporal que el dataset no tiene.

**AN · Antigüedad**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Explica | KPI "76.77%" · etiqueta "Top 2 tramos" | KPI "Q 3,791.66" · etiqueta "ticket promedio en el tramo líder"; `resumen` compara contra Q 5,830.15 (ticket de 1-30 días) | Mismo defecto que CA-Explica en Cuadro de mando: "Top 2 de tramos" ya lo dice Detecta con otras palabras. El ticket promedio revela que el tramo líder (90+) tiene facturas más chicas en promedio que 1-30 días. |
| Prioriza | KPI "166" (conteo suelto de facturas vencidas) | KPI "74.11%" (166/224 facturas clasificadas) | Un conteo suelto no dice si es mucho o poco. Como ratio se lee de inmediato qué proporción de lo clasificado ya venció. |
| Recomienda | `resumen`: "0 facturas quedaron fuera por falta de fecha." | Mismo KPI/dona (`coberturaAntiguedad`, 100%); `resumen` agrega "el tramo líder (90+ días) reúne 55 clientes distintos." | KPI/dona no cambia (100% de cobertura sigue siendo la métrica correcta). Se agrega el dato de clientes distintos del bucket líder como contexto, igual que CA-Recomienda en Cuadro de mando. |

**CN · Concentración**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Explica | KPI "17.99%" · etiqueta "Top 2 del vencido" (mismo criterio que Detecta, por monto) | KPI "22" · etiqueta "facturas vencidas del líder, no monto" — ranking por CANTIDAD de facturas (Axel Daniel 22, Henry Camilo Godínez 12, Jonas Emmanuel Godínez 5...) | Top 2 por monto es refinamiento débil de Detecta. El líder por cantidad de facturas (Axel Daniel, 22) NO es el mayor deudor por monto (Inversiones D.C.N) — expone carga operativa que el ranking por saldo esconde. |
| Recomienda | KPI "53.01%" · etiqueta "explicado por el Top 10" | Mismo KPI/dona; `resumen` agrega "10 de 91 clientes (10.99%) explican esto; en Top 20 sube a 68.68% del vencido." | KPI/dona no cambia (Top 10 sigue siendo la métrica correcta). Se agrega el tamaño del universo y el Top 20 como contexto, igual que CL-Recomienda en Cuadro de mando agregó el dato de Top 10. |

**EX · Exclusiones**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Detecta | KPI "0.00%" · etiqueta "Pagada" (reparto por saldo, ver B18-15) | KPI "100.00%" · etiqueta "Pagada" (reparto por cantidad de facturas) | Ver B18-15: un motivo que estructuralmente vale Q0 (facturas pagadas) no puede repartirse por saldo sin producir un 0% engañoso. |
| Explica | KPI "1" (`motivosPresentes.length`, conteo trivial: siempre 1-3, no cambia con el negocio) | KPI "Q 6,032.66" · etiqueta "ticket promedio de factura pagada"; `resumen` compara contra Q 6,613.41 de las abiertas (-8.78%) | Un conteo de "cuántos motivos distintos hay" no dice nada útil. El ticket promedio de lo pagado contra lo abierto revela si el tamaño de la factura se relaciona con que se cobre — acá, las pagadas son ligeramente más chicas (-8.78%). |

**GE · Gestión**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Detecta (resumen) + categoría (`problema`, `metricas`) | Q 844,809.48 · "saldo vencido sin gestión" (en realidad saldo TOTAL abierto de esos clientes, ver B18-14) | Q 703,209.70 (saldo VENCIDO real) | Ver B18-14: corrección de exactitud, no de valor de negocio — el número anterior mezclaba saldo al día con saldo vencido. |
| Recomienda | KPI "0.00%" · etiqueta "vencido con gestión registrada" — complemento matemático exacto de Detecta (100% − 0% = 100%, mismo patrón que CO-Recomienda en Cuadro de mando antes de su rediseño) | KPI "55" · etiqueta "clientes sin gestión ya en mora crítica (90+)" — cruce entre `seguimiento.sinGestion` y `aging.clasificadas` filtrado a bucket 90+ | La tarjeta vieja no aportaba información propia: es la misma cifra que Detecta, sólo dicha al revés. El cruce con mora crítica muestra que 60.44% (55 de 91) de la cola sin trabajar ya es urgente — información nueva y accionable que hoy no se ve en ningún otro lado de la página. |

**Tarjetas verificadas SIN CAMBIO** (auditadas y confirmadas correctas
tal cual estaban, con razón explícita): **AN-Detecta** (bucket líder
90+, confirmado desde monto, facturas y clientes distintos — mismo
criterio que CA-Detecta, sin cambio en Cuadro de mando). **CN-Detecta**
(mayor deudor por monto, Inversiones D.C.N — mismo criterio que
CL-Detecta). **CN-Prioriza** (31 clientes concentran el 80% del
vencido — Pareto real por acumulación ordenada, ya confirmado "lógica
sana, sin bug encontrado" en la revisión de `/prioritarios`, sección 3).
**EX-Prioriza** (saldo sin fecha de vencimiento, Q 0.00 — es la única
red de seguridad de dinero real no capturado que tiene esta página; que
hoy valga Q0 es la mejor lectura posible, no una tarjeta dormida:
mostrar Q0 en vez de inventar una acción es la disciplina correcta).
**EX-Recomienda** (7.04% de las facturas del dataset permanece dentro
del aging — universo y cálculo ya correctos, sin redundancia con
ninguna otra tarjeta de la página). **GE-Explica** y **GE-Prioriza** (0
clientes con promesa documentada, 0 promesas vencidas — honesto reflejo
del estado real de `localStorage` en un navegador sin gestiones
guardadas para el dataset real; mismo criterio que ya reconfirma B18-7
para `/prioritarios`, no hace falta repetir el análisis).

Verificado con clic real en `/aging` (las 4 categorías, Chromium vía
Playwright para Python) el 2026-09-03: los números nuevos aparecen tal
cual en pantalla — incluidos los dos corregidos por B18-14 y B18-15 — y
la dona de cada tarjeta sigue el KPI de la tarjeta activa (B18-1 sigue
sin romperse: se comprobó dona=39% en AN-Detecta contra caption
"38.80%", dona=100% en AN-Explica/Prioriza —sin `donaPct` propio, cae a
`categoria.cobertura`—, dona=100% en AN-Recomienda contra "100.00%",
dona=9% en CN-Detecta contra "9.33%", dona=100%/7% en EX-Detecta/otras
contra sus captions, y dona=100%/0%/0%/60% en las 4 tarjetas de GE
contra "100.00%" / "0" / "0" / "55" respectivamente).

---

## 3. Clientes prioritarios (`/prioritarios`)

Revisado: la vista principal (4 tarjetas de la categoría Score), los 4
drill-downs de Score, y el dashboard B18 integral de Prioritarios.
Capturas del 2026-09-02.

### 🔴 B18-1 (confirmado también acá) — el dona fijo en 12%

Mismo componente compartido (`MoldeB18.tsx:110-111`), mismo síntoma: en
las 4 pestañas del drill-down de Score el dona muestra **12%** fijo (el
`pct` de MOTOCENTER dentro del reparto de `categoria.filas`, que es la
participación del líder dentro del *score* del Top 10 — no dentro del
saldo). El caption de al lado sí cambia correctamente por tarjeta (71
pts / 22.75% / Q 442,105.55 / 39.00%). No hace falta repetir el análisis
de causa — está en la sección 1 — pero queda registrado que el bug
afecta a `/prioritarios` con la misma firma exacta.

**✅ Corregido — 2026-09-02.** Mismo arreglo que en la sección 1 (molde
compartido, un solo cambio en `components/commercial/MoldeB18.tsx`).
Verificado con clic real en las 4 tarjetas de Score, `/prioritarios`: el
12% fijo de MOTOCENTER ya no aparece. Ahora Detecta muestra dona=**71%**
(coincide con "71 pts · score simulado líder"), Explica dona=**39%**,
Prioriza dona=**39%**, Recomienda dona=**39%** (coincide exacto con
"39.00% · saldo cubierto por el Top 10"). Detalle completo del cambio y
de la decisión para Explica/Prioriza (sin `donaPct` propio → cae a
`categoria.cobertura`) en la sección 1.

---

### 🔴 B18-4 — "Mora crítica 90+" mide dos cosas distintas en Cuadro de mando y en Prioritarios

**Dónde:**
- `lib/commercial-ejecutivo.ts:77-95` (`construirLecturaEjecutiva`, usada por Cuadro de mando vía `app/page.tsx` → `lib/agentes-cuadro-mando.ts`).
- `lib/agentes-prioritarios-b18.ts:284-286` y `lib/simulados.ts:120-151` (`prioridadSimulada`, usada por Prioritarios vía `lib/commercial-cobranza.ts:analizarPrioritariosComercial`).

**Cuadro de mando** clasifica **por factura**: `calcularAging()`
(`lib/calculos.ts:139-184`) recorre cada factura individual, la ubica en
un bucket con `bucketDeDias()` (`lib/calculos.ts:99-105`, ≥91 días →
`"90+"`), y `totalMoraCritica` suma el saldo de **solo las facturas que,
individualmente, ya pasaron los 90 días**:

```ts
// lib/commercial-ejecutivo.ts:77-85
for (const fila of aging.clasificadas) {
  if (fila.bucket === "actual") continue;
  ...
  if (fila.bucket === "90+") {
    sumarCliente(criticoPorCliente, id, nombre, fila.saldo);
  }
}
```

**Prioritarios** clasifica **por cliente**: `prioridadSimulada()`
recorre las facturas de cada cliente y se queda con el **máximo** de
días de atraso entre todas ellas, pero el saldo que arrastra es la
**suma total de saldo abierto del cliente** (todas sus facturas, no solo
la más vieja):

```ts
// lib/simulados.ts:127-139
let saldoTotal = 0;
let diasMax = 0;
...
for (const f of facturasCliente) {
  ...
  const saldo = saldoPendiente(f, dataset.pagos, dataset.notasCredito);
  saldoTotal += saldo;                         // TODO el saldo del cliente
  if (f.fecha_vencimiento) {
    const dias = diasAtraso(fechaCorte, f.fecha_vencimiento);
    if (dias > diasMax) diasMax = dias;         // el MÁXIMO de sus facturas
  }
}
```

`lib/agentes-prioritarios-b18.ts:284-286` toma ese `dias` (=`diasMax`
del cliente) y ese `saldo` (=`saldoTotal` del cliente) tal cual llegan:

```ts
const moraCritica = filas.filter((f) => f.dias > 90);
const saldoCritico = moraCritica.reduce((s, f) => s + f.saldo, 0);
```

**Consecuencia concreta:** un cliente con una factura de Q1,000 vencida
hace 95 días y otra factura de Q3,000 vencida hace 10 días (o sin
vencer) aporta **Q1,000** a "Mora crítica 90+" en Cuadro de mando (solo
la factura que de verdad tiene 90+ días), pero aporta **Q4,000**
(su saldo total) a "Mora crítica 90+" en Prioritarios, porque una sola
factura vieja arrastra todo el saldo del cliente al bucket más grave.
Esto explica por qué Prioritarios (Q 636,675.19) es más alto que Cuadro
de mando (Q 439,832.61, ver cruce verificado en la sección 1) — no es
redondeo ni una población distinta de clientes, es una definición de
"90+" distinta: **por factura** vs. **por cliente (contagio del
máximo)**.

El propio archivo ya lo confiesa, pero solo en la pestaña "Diagnóstico"
de la tarjeta Explica de Antigüedad, no en el KPI:

> `lib/agentes-prioritarios-b18.ts:315` — "Los tramos agrupan por días
> de atraso máximo del cliente, no por factura individual."

Esa aclaración no llega al KPI "MORA CRÍTICA 90+" del dashboard B18
integral (captura 6) ni a la tarjeta Detecta/Prioriza/Recomienda de
Antigüedad — ahí el rótulo es idéntico, palabra por palabra, al de
Cuadro de mando, sin ninguna nota que diga "esto no es lo mismo que ves
en el Cuadro de mando".

**Impacto:** alto. Dos pantallas del mismo dashboard, mismo nombre de
KPI ("Mora crítica 90+"), mismo formato de moneda, cifras que difieren
en casi Q 200,000 (45% más alto en Prioritarios) sin que nada en pantalla
avise que son dos métricas distintas. Cualquiera que compare las dos
páginas de buena fe va a pensar que una de las dos está mal.

**Arreglo propuesto:** no es forzar que las dos cifras cuadren (las dos
definiciones son legítimas y responden preguntas distintas: "¿cuánta
plata está vencida hace 90+ días?" vs. "¿cuánto saldo tienen los
clientes que ya tienen ALGO vencido hace 90+ días?"). Lo que hay que
arreglar es el rótulo: renombrar el KPI de Prioritarios a algo como
"Saldo de clientes en mora crítica 90+" (o agregar la aclaración "por
cliente, no por factura" directamente al lado del número, no solo en el
drill-down), para que no compita visualmente con el mismo nombre exacto
que usa Cuadro de mando para una cosa distinta.

**Prioridad:** alta.

---

### 🟡 B18-5 — "Saldo priorizado total" no está priorizado: es el 100% de la cartera con saldo

**Dónde:** `lib/simulados.ts:120-151` (`prioridadSimulada`) y
`lib/agentes-prioritarios-b18.ts:57-59`.

`prioridadSimulada()` recorre **todos** los clientes del dataset
(`lib/simulados.ts:123`, `for (const cliente of dataset.clientes)`), sin
ningún filtro previo de "candidato a priorizar". El único criterio de
entrada a la lista es tener saldo abierto positivo:

```ts
// lib/simulados.ts:141
if (saldoTotal <= 0) continue;
```

No hay corte por score mínimo, por días mínimos de atraso, ni por
ningún criterio de negocio — **todo cliente con cualquier saldo
pendiente entra a la worklist y recibe un score**. El propio
comentario del archivo lo confirma sin querer: `lib/simulados.ts:64`
dice *"Sobre los datos reales de Benserca 18 (**111 cuentas**, corte
2026-08-20)..."* — el mismo 111 que aparece como "CUENTAS PRIORIZADAS"
en la captura 6. Es decir: el 100% de las cuentas del dataset con saldo
está "priorizado".

Por eso `Q 1,133,597.08` (saldo priorizado total) coincide **exacto,
hasta el centavo**, con `aging.totalClasificado` (cartera clasificada
de Cuadro de mando): no es que compartan un filtro de priorización —
es que ninguno de los dos filtra nada más allá de "factura no pagada,
no anulada, con fecha de vencimiento":

- `lib/simulados.ts:130-134` suma el saldo de **toda** factura no
  pagada/anulada del cliente, sin exigir `fecha_vencimiento`.
- `lib/calculos.ts:160-177` (`calcularAging`) excluye de
  `totalClasificado` las facturas sin `fecha_vencimiento`
  (`saldoNoClasificable`, línea 166).

Estos dos universos solo coinciden en Q hasta el centavo porque en este
dataset **no hay ninguna factura sin fecha de vencimiento** — evidencia
ya registrada en este mismo documento: la tarjeta "Recomienda" de
Cartera en Cuadro de mando muestra *"100.00% · cartera clasificable"*
(línea 36 de este archivo, sección 1), y `lib/agentes-cuadro-mando.ts:107`
expone ese mismo `ejecutiva.sinFechaVencimiento` como el conteo que
explicaría cualquier diferencia — que en esta captura es cero. Si algún
día aparece una factura sin fecha de vencimiento, las dos cifras
dejarían de coincidir (Prioritarios seguiría sumándola, Cuadro de mando
la excluiría), y ahí se notaría que nunca hubo un filtro compartido real
— fue coincidencia del dataset actual.

**Impacto:** medio. No es un error de cálculo — la suma es correcta y
consistente internamente — pero la palabra "priorizados" en el rótulo
del KPI y en el eyebrow ("COBRANZA · WORKLIST SIMULADA") sugiere una
preselección que en los hechos no existe: cualquier cliente con Q1 de
saldo abierto ya cuenta como "priorizado". Alguien que lea "111 cuentas
priorizadas" puede asumir que 111 es un subconjunto recortado de una
cartera más grande — y no lo es, es toda la cartera con deuda.

**Arreglo propuesto:** o se agrega un filtro real de priorización (ej.
score mínimo, o al menos excluir clientes al día / 0 días de atraso de
la cuenta de "priorizados"), o se ajusta el texto para no insinuar una
preselección: algo como "Cuentas con saldo abierto (100% de la
cartera)" en vez de "Cuentas priorizadas", dejando "priorizadas"
reservado para el Top 10 por score, que sí es un subconjunto real.

**Prioridad:** media.

---

### 🟡 B18-6 — La tarjeta "Recomienda" repite la misma cifra y el mismo concepto dos veces en la misma oración

**Dónde:** `components/commercial/MoldeB18.tsx:116` (plantilla del
caption del drill-down) combinado con
`lib/agentes-prioritarios-b18.ts:113-114` (tarjeta `recomienda` de
Score) y `:81` (`coberturaEtiqueta` de la categoría Score).

El caption del drill-down siempre se arma así:

```tsx
// MoldeB18.tsx:116
<span>{tarjeta.kpiTexto} · {tarjeta.etiqueta} · {pctB18(categoria.cobertura)} {categoria.coberturaEtiqueta}</span>
```

Es decir: KPI propio de la tarjeta + cobertura de la categoría, uno
después del otro, sin importar si son el mismo número. En Score, la
tarjeta `recomienda` está definida así:

```ts
// lib/agentes-prioritarios-b18.ts:113-114
{ id: "recomienda", grafica: "cobertura", donaPct: coberturaScore,
  kpiTexto: pctB18(coberturaScore), etiqueta: "saldo cubierto por el Top 10", ... }
```

`categoria.cobertura` de Score también **es** `coberturaScore` (línea
80: `cobertura: coberturaScore`). Como `tarjeta.kpiTexto` y
`pctB18(categoria.cobertura)` son literalmente el mismo cálculo
(`coberturaScore`), la oración queda: *"39.00% · saldo cubierto por el
Top 10 · 39.00% del saldo priorizado total queda cubierto por el Top 10
del score simulado"* — el mismo número y casi el mismo concepto,
repetidos.

Esto no es exclusivo de Score: el mismo patrón (`donaPct`/`kpiTexto` de
la tarjeta `recomienda` = `categoria.cobertura` de esa misma categoría)
se repite en las otras 3 categorías de esta página —
`lib/agentes-prioritarios-b18.ts:187-193` (Gestión), `:256-261`
(Concentración) y `:326-331` (Antigüedad) — así que las 4 tarjetas
"Recomienda" de `/prioritarios` van a leerse con esta misma redundancia,
solo que capturada en pantalla únicamente para Score.

**Impacto:** bajo/cosmético. No hay dato falso — ambas mitades de la
oración dicen lo mismo con distintas palabras — pero es ruido de
lectura, y el patrón sugiere que el diseño de la tarjeta "Recomienda"
no consideró que su propio KPI ya *es* la cobertura de la categoría.

**Arreglo propuesto:** en el molde, cuando `tarjeta.donaPct === categoria.cobertura`
(caso "recomienda" con gráfica `cobertura`), omitir la segunda mitad del
caption (`pctB18(categoria.cobertura) {categoria.coberturaEtiqueta}`) y
dejar solo `tarjeta.kpiTexto · tarjeta.etiqueta`, ya que ahí no aporta
información nueva.

**Prioridad:** baja.

---

### 🟡 B18-7 — "0.00% de gestión" no dice que las gestiones viven solo en este navegador

**Dónde:** `lib/agentes-prioritarios-b18.ts:195-202` (metadatos de la
categoría Gestión) y `lib/store.tsx:4-5,28,164,192-207`.

Las gestiones de cobranza (`GestionCobranza`) se guardan **solo en
`localStorage` del navegador** (`lib/store.tsx:28`, clave
`cxc-prototipo-gestiones-ficticias`) — no hay base de datos ni API. Peor
aún: para el dataset real (`odoo-real`), la lista de gestiones usadas es
**exclusivamente** `gestionesUsuario` (lo que este navegador guardó),
sin ninguna semilla de demo:

```ts
// lib/store.tsx:192-197
const gestiones = useMemo(
  () =>
    dataset.fuente === "demo-ficticio"
      ? [...gestionesSemilla, ...gestionesUsuario]
      : gestionesUsuario,
  [dataset.fuente, gestionesUsuario]
);
```

Es decir: "111 de 111 cuentas priorizadas no tienen gestión de cobranza
registrada" (captura 6, tarjeta GE-Gestión) puede significar
literalmente "nadie ha gestionado nunca nada" **o** puede significar
"este navegador, en esta sesión, no tiene ninguna gestión guardada" —
son lecturas muy distintas y el dashboard no distingue cuál es.

Revisé el metadato "Límite" de la categoría Gestión
(`lib/agentes-prioritarios-b18.ts:201`) buscando esa aclaración:

```ts
{ termino: "Límite", valor: "No mide si el contacto fue efectivo, sólo si existe un registro de gestión previo; no forma parte del score simulado." },
```

**No la contiene.** Habla de si el contacto fue efectivo, no de dónde
vive el dato ni de que es por-navegador. Tampoco aparece en "Fuente" ni
en "Capa" de esa misma categoría (líneas 196-197). No encontré ninguna
mención de `localStorage` / "por navegador" en ningún metadato de
`/prioritarios`.

**Impacto:** medio. Un 0.00% de gestión es una cifra alarmante si se
lee como "cobranza no ha hecho nada" cuando en realidad puede ser un
artefacto de sesión/navegador nuevo. Sin la aclaración, el KPI invita a
una conclusión equivocada sobre el trabajo del equipo de cobranza.

**Arreglo propuesto:** agregar al metadato "Límite" (o a "Fuente") de
la categoría Gestión una línea explícita: algo como "Las gestiones se
guardan solo en este navegador (localStorage), no en una base de datos
compartida — un 0% acá puede significar que este navegador no tiene
gestiones guardadas, no que nadie haya gestionado nunca estas cuentas."

**Prioridad:** media.

---

### Nota — nombres de personas expuestos junto a nombres de negocio

Igual que en el dominio CL de Cuadro de mando, la categoría Score
muestra nombres de persona entre paréntesis junto al nombre comercial:
"MOTOCENTER.COM (LEONEL PUAC)", "FLORES MOTORS (Herberth Flores)". Es
el mismo campo `nombre_cliente` del dataset, el mismo riesgo de
exposición ya anotado en la sección 1 — no hace falta repetir el
análisis, solo dejar constancia de que también aparece en
`/prioritarios`.

---

### 🟡 B18-8 — El rótulo "PROBLEMA ENCONTRADO" no distingue cuando no hay ningún problema

**Dónde:** `components/commercial/MoldeB18.tsx`, componente `Drilldown`,
pestaña `problema` — `<small>Problema encontrado</small>` es un rótulo
fijo, igual en las 4 tarjetas de las 4 categorías, sin condición.

**Se ve así en las capturas (Cartera → Recomienda, pestaña Diagnóstico):**
el encabezado destacado dice *"PROBLEMA ENCONTRADO"*, y el contenido
debajo dice *"La cartera está completamente clasificada al corte"* +
*"0 facturas quedaron fuera por falta de fecha."* — es decir, la mejor
lectura posible del dominio (cobertura 100%), presentada bajo un rótulo
que anuncia una alarma. Mismo patrón esperable en cualquier otra
categoría/página que llegue a cobertura 100% u otro estado "limpio".

**Impacto:** medio. No hay ningún dato falso, pero el título contradice
al cuerpo del texto — quien lee rápido (un rótulo en mayúsculas, en
color) puede alarmarse antes de leer que en realidad no hay nada mal.

**Nota adicional relacionada, misma pestaña:** el campo "Impacto
observado" de la tarjeta Explica en Cartera dice *"Tres bandas muestran
cómo se reparte la antigüedad"* — describe el gráfico, no un hecho. La
misma pestaña en Detecta sí da un hecho real (*"Q439,832.61
concentrados en este tramo"*). La calidad del texto no es pareja entre
los 4 roles.

**Prioridad:** media. Es una decisión de redacción/diseño (rótulo
condicional vs. rótulo neutro vs. dejarlo como está), pendiente de
confirmar el criterio antes de tocar el molde — no se debe implementar
sin acordar antes cuál de las opciones se usa, porque afecta a las 5
páginas por igual.

---

### 🟡 B18-9 — La acción recomendada no siempre reacciona al estado real del dato

**Dónde:** `lib/agentes-cuadro-mando.ts`, tarjeta `recomienda` de la
categoría Cartera (`accion`).

**Se ve así en la captura (Cartera → Recomienda, pestaña Acción):** el
texto dice *"Completar la fecha de vencimiento en el origen; el tablero
no la inventa."* — pero la misma categoría ya declara `cobertura: 100%`
y *"0 facturas quedaron fuera por falta de fecha"* en su propio
Diagnóstico. La acción sugiere resolver un hueco que, en este corte, no
existe.

**Impacto:** medio. No es un dato falso — es una recomendación estática
que no se ajusta cuando el problema que describe ya no está presente.
Alguien que solo lee la pestaña Acción (sin pasar por Diagnóstico) se
va con una tarea que no aplica hoy.

**Prioridad:** media. Igual que B18-8, es una decisión de contenido
(texto condicional según cobertura vs. dejar el texto como política
general aplicable a futuro) pendiente de confirmar antes de tocar el
código — afecta el patrón de escritura de `accion` en los 6 archivos
`lib/agentes-*.ts`, no solo Cartera.

---

### Mapa completo — los 4 agentes × 4 categorías de Prioritarios

Pedido explícito: no quedarse en el KPI de la vista principal, sino entrar
a los 16 pares categoría×tarjeta (Score, Gestión, Concentración,
Antigüedad) y a sus 3 pestañas de drill-down. Cubrí **Score completo**
(vista principal + drill-down de Detecta) y **Gestión vista principal**
con capturas reales del 2026-09-02, cruzadas línea por línea contra
`lib/agentes-prioritarios-b18.ts:71-342`. Para **Concentración** y
**Antigüedad** no tengo captura todavía — lo de abajo sale de leer el
código (`lib/agentes-prioritarios-b18.ts:205-342`), no de verlo en
pantalla; lo marco explícito donde corresponde, tal como pide la
metodología.

**🟢 Score — verificado exacto, con matemática propia.** Las capturas de
la vista principal (4 tarjetas + reporte central + las 6 filas de
metadatos) y del drill-down de Detecta coinciden, campo por campo, con
`lib/agentes-prioritarios-b18.ts:71-128`: "71 pts" (`lider.score`),
"MOTOCENTER.COM (LEONEL PUAC) · Q 18,607.60 · 1110 días de atraso"
(`tarjeta.resumen` de Detecta), "Q 442,105.55" y "111" en las métricas
centrales, y las 6 filas Fuente/Capa/Corte/Moneda/Cobertura/Límite
calcan `metadatos` literal. Fui más allá: reconstruí el score a mano
desde `lib/simulados.ts:160-166` con los datos crudos de la captura
(saldo Q18,607.60, 1110 días) y los techos que el propio código declara
en `SUPUESTOS_SCORING` (línea 64: percentil 95 = Q39,637.50 de saldo,
1,164 días de atraso, sobre el dataset real de 111 cuentas):

```
nSaldo = min(18607.60 / 39637.50, 1) = 0.4695
nDias  = min(1110 / 1164, 1)         = 0.9536
score  = round((0.4695·0.5 + 0.9536·0.5) · 100) = round(71.155) = 71
```

Da **71 exacto** — el score no solo "se ve bien", la fórmula documentada
reproduce el número mostrado con los mismos insumos que aparecen en
pantalla. No hay nada que arreglar en Score; queda como referencia de
que el patrón de verificación funciona.

**🟢 Gestión — vista principal verificada exacta, reconfirma B18-5 y
B18-7.** Las 4 tarjetas, los 3 recuadros de métricas, "Siguiente
validación" y los 6 metadatos de la captura de Gestión coinciden con
`lib/agentes-prioritarios-b18.ts:142-203` (`liderSinGestion`,
`coberturaGestion`, `saldoSin`). El mismo "Q 1,133,597.08 · 111 cuentas"
que ya aparece documentado en B18-5 como "100% de la cartera con saldo,
no un subconjunto priorizado" aparece de nuevo acá como `saldoTotal` /
`filas.length`, y el "0.00% saldo con responsable asignado · 0 cuentas
con gestión" reconfirma B18-7 (gestiones que viven solo en
`localStorage` de este navegador) — ninguna cifra nueva contradice lo ya
documentado.

---

### 🟡 B18-10 — El caption del drill-down mezcla dos datos sin relación en una sola oración

**Dónde:** `components/commercial/MoldeB18.tsx:127`, componente
`Drilldown`, pestaña "Resultado":

```tsx
<span>{tarjeta.kpiTexto} · {tarjeta.etiqueta} · {pctB18(categoria.cobertura)} {categoria.coberturaEtiqueta}</span>
```

**Se ve así en la captura** (Score → Detecta, pestaña Resultado): *"71
pts · score simulado líder · 39.00% del saldo priorizado total queda
cubierto por el Top 10 del score simulado"*. "71 pts" es el score del
líder (MOTOCENTER) — el tema propio de la tarjeta Detecta. "39.00%" es
`categoria.cobertura`, un dato completamente distinto (cuánto saldo del
grupo priorizado cubre el Top 10) que no tiene relación con "quién es el
líder". La plantilla los concatena con el mismo separador "·" que ya
usa entre "71 pts" y "score simulado líder" (que sí son parte de la
misma idea), así que no hay ninguna señal visual de que la segunda mitad
de la frase es un dato aparte.

**Impacto:** medio/bajo. No es un dato falso — cada mitad de la frase es
correcta por separado — pero el patrón invita a leer "39.00%" como si
describiera al líder o a su score, cuando describe a la categoría
entera. Afecta a las tarjetas Detecta, Explica y Prioriza de las 4
categorías de Prioritarios (12 combinaciones) y, por el mismo
componente compartido, a Cuadro de mando, Aging, Detalle de venta e
Inventario. La tarjeta Recomienda no sufre esto porque ahí
`tarjeta.donaPct` y `categoria.cobertura` casi siempre son el mismo
número — ese caso ya está documentado aparte en 🟡 B18-6, con el que
esta tarjeta comparte la misma línea de origen (`MoldeB18.tsx:127` es la
misma plantilla que produce ambos síntomas).

**Arreglo propuesto:** separar la frase en dos elementos con jerarquía
visual distinta en vez de una sola `<span>`: mantener `{tarjeta.kpiTexto}
· {tarjeta.etiqueta}` como el texto principal (ya identifica de qué
habla esta tarjeta) y mover `{pctB18(categoria.cobertura)}
{categoria.coberturaEtiqueta}` a un elemento secundario aparte (por
ejemplo un `<small>` en la línea de abajo, con un rótulo fijo delante
como "Cobertura de la categoría:"), igual que ya propone B18-6 omitir
esa segunda mitad cuando es redundante con el propio KPI de la tarjeta
(`tarjeta.donaPct === categoria.cobertura`). Es el mismo cambio en el
mismo archivo/línea el que resuelve B18-6 y B18-10 a la vez.

**Prioridad:** baja — cosmético, mismo nivel que B18-6.

---

### 🟡 B18-11 — "Concentración Top 5" existe en dos páginas con universos distintos, mismo nombre

**Dónde:**
- `lib/agentes-cuadro-mando.ts:199-224` (dominio CL de Cuadro de mando):
  `concentracionTop5` se calcula sobre `filasClientes` = clientes **con
  saldo vencido** (`ejecutiva.oportunidades`), y su `pct` es cada cliente
  como proporción del **vencido total**. El propio código lo etiqueta
  bien: `senal: "Top 5 concentra X% del vencido"`,
  `coberturaEtiqueta: "del vencido explicado por el Top 5"`, y trae su
  propio contador `clientesConVencido` (línea 220) como universo.
- `lib/agentes-prioritarios-b18.ts:206-223` (categoría CN de
  Prioritarios): `coberturaConcentracion` se calcula sobre **las 111
  cuentas priorizadas** (todo el dataset con saldo abierto, según ya
  documenta 🟡 B18-5 — no solo las que tienen algo vencido), y el `pct`
  es cada cliente como proporción del **saldo total abierto** del grupo
  (`saldoTotal`, que incluye cuentas al día). Etiqueta: `senal: "Top 5
  por saldo concentra X% del saldo priorizado"`.

**Por qué importa:** las dos páginas muestran una tarjeta llamada, en la
práctica, "Concentración Top 5" con un formato idéntico (dona + %), pero
sobre poblaciones y denominadores distintos — uno es "de lo vencido",
el otro es "de todo el saldo abierto del universo priorizado (~100% de
la cartera, por B18-5)". Es el mismo patrón de riesgo que ya destapó
🔴 B18-4 (mismo nombre de KPI, definiciones distintas, cifras que no
deberían compararse pero invitan a hacerlo) — con la diferencia de que
acá **sí** hay una palabra distinta en cada rótulo visible ("del
vencido" vs. "del saldo priorizado"), así que la ambigüedad es menor que
en B18-4 y por eso lo marco 🟡, no 🔴.

**No pude confirmar la magnitud de la diferencia en pantalla** — no
tengo una captura de la categoría Concentración de `/prioritarios` para
leer su cifra real y compararla con el 38.93% de concentración Top 5 ya
verificado para Cuadro de mando (sección 1 de este documento). Lo que sí
confirmé en el código es que las dos cifras usan universos distintos por
construcción, así que es matemáticamente esperable que no coincidan
salvo coincidencia — igual que pasó con B18-4 y con B18-5. Hace falta
una captura de `/prioritarios` → categoría Concentración para poner el
número real al lado del 38.93% y confirmar cuánto se separan.

**Arreglo propuesto:** no forzar que las dos cifras cuadren (miden cosas
distintas legítimamente). Renombrar el rótulo de la categoría CN de
Prioritarios de "Concentración" a algo que declare su universo en el
nombre visible, no solo en el texto de apoyo — por ejemplo "Concentración
del saldo priorizado" en el riel lateral y en `senal`
(`lib/agentes-prioritarios-b18.ts:219`, ya dice "del saldo priorizado" en
el texto pero el rótulo corto de la categoría, `nombre: "Concentración"`
en la línea 218, no lo hace) — mismo criterio de arreglo que B18-4 aplicó
a "Mora crítica 90+".

**Prioridad:** media — pendiente confirmar la magnitud real con una
captura antes de decidir si sube a alta.

---

### Referencia de datos — Concentración (CN) y Antigüedad (AT), solo verificado en código

No hay captura de estas dos categorías todavía. Lo siguiente sale de
`lib/agentes-prioritarios-b18.ts:205-342` y no se confirmó en pantalla —
tratarlo como mapa de dónde sale cada dato, no como hallazgo cerrado.

| Categoría | Tarjeta | Qué muestra | Fuente exacta | Nota |
|---|---|---|---|---|
| CN Concentración | Detecta | Mayor saldo individual del grupo priorizado | `agentes-prioritarios-b18.ts:232-240`, `mayorSaldo = porSaldo[0]` | Ordena por saldo, no por score — un cliente grande y puntual puede aparecer aquí sin ser un riesgo real (el propio `accion` de la tarjeta ya lo advierte, línea 240) |
| CN Concentración | Explica | Top 2 del Top 5 por saldo | `:243-248`, `top2Concentracion` | Mismo patrón de "reparto de barras casi igual entre roles" ya anotado en 🟡 B18-3 |
| CN Concentración | Prioriza | Cuentas necesarias para el 80% del saldo priorizado | `:41-49` (`cuentasParaObjetivo`) y `:211,251` | Pareto real, calculado por acumulación ordenada — lógica sana, sin bug encontrado |
| CN Concentración | Recomienda | % del saldo priorizado explicado por el Top 5 | `:257-261`, `coberturaConcentracion` | Es la cifra en juego para 🟡 B18-11 — mismo nombre corto ("Concentración") que Cuadro de mando, universo distinto |
| AT Antigüedad | Detecta | Tramo de antigüedad (por días de atraso **máximo del cliente**, no por factura) que más saldo concentra | `:274-283`, `bucketDias()` | Comparte la causa raíz de 🔴 B18-4 (clasificación por cliente, no por factura) — ya está documentada ahí, no repito el hallazgo |
| AT Antigüedad | Explica | Top 2 tramos de antigüedad | `:312-318` | El propio texto (`resumen`, línea 315) ya avisa: "Los tramos agrupan por días de atraso máximo del cliente, no por factura individual" — la aclaración SÍ está presente acá, a diferencia de lo que señala B18-4 para el KPI del dashboard integral |
| AT Antigüedad | Prioriza | Cuentas y saldo en mora crítica 90+ (dentro del grupo priorizado) | `:319-325`, `moraCritica`, `saldoCritico` | Es el mismo `saldoCritico` que compara B18-4 contra Cuadro de mando |
| AT Antigüedad | Recomienda | % del saldo priorizado en mora crítica | `:326-332`, `coberturaAntiguedad` | — |

**🟢 Nota positiva, vale preservarla al tocar B18-2:** el bucket "Al día o
sin fecha (0)" (`bucketDias()`, línea 33) junta a propósito "cliente al
día" y "cliente sin fecha de vencimiento registrada" en un mismo rótulo,
porque `diasMaxAtraso` (`lib/simulados.ts:136-139`) solo se calcula sobre
facturas que sí tienen `fecha_vencimiento` — un cliente cuyas facturas
carecen todas de esa fecha queda con `diasMax = 0` por defecto,
indistinguible de uno realmente al día. En vez de esconder esa
ambigüedad, el nombre del bucket la declara, y el metadato "Límite" de
la categoría (`agentes-prioritarios-b18.ts:340`) la repite en texto
llano. Es exactamente la disciplina que pide la regla de fondo del
proyecto (ningún dato se presenta como más preciso de lo que es) — si se
reordenan los tramos por 🟡 B18-2, este rótulo y esta nota no se deben
perder ni simplificar.

---

### Confirmado con clics reales — Concentración (CN) y Antigüedad (AT), 2026-09-03

La sección anterior quedó marcada "solo verificado en código". Se corrió
`scripts/ejecutar-prioritarios.ts` contra el dataset real (Odoo →
Supabase, 111 cuentas priorizadas, corte 2026-08-24) y se confirmó cada
número con clic real en `/prioritarios` (Playwright, Chromium headless de
`ms-playwright`, las 4 tarjetas de CN y de AT):

- **CN Concentración:** Top 5 por saldo = WALMART (Q 137,823.76), NUEVOS
  ALMACENES-CEMACO (Q 85,009.64), NOVEX (Q 72,362.45), INVERSIONES D.C.N
  (Q 65,579.50), CRISTIAN SABALLOS (Q 55,098.00) → suma Q 415,873.35 =
  **36.69%** del saldo priorizado total (Q 1,133,597.08) — la cifra que
  🟡 B18-11 dejó pendiente de confirmar. Contra el 38.93% de Cuadro de
  mando (Top 5 sobre el vencido, sección 1), la diferencia real es de
  2.24 puntos: universos distintos, como B18-11 ya anticipaba por código,
  ahora con la magnitud real medida (no es una diferencia dramática, pero
  tampoco cero — no cambia la prioridad "media" que B18-11 ya tenía).
  `cuentasPara80` (cuentas para el 80% del saldo priorizado) = **37 de
  111**, confirmado tanto por script como en pantalla (tarjeta
  Detecta/`metricas`). Pareto real, sin bug encontrado, tal como
  anticipaba la tabla de código.
- **AT Antigüedad:** bucket líder "Más de 90 días" = Q 636,675.19 en 55
  cuentas = **56.16%** del saldo priorizado — exactamente el mismo número
  que `coberturaAntiguedad` (verificación algebraica a 8 decimales en el
  Rediseño de KPIs, más abajo). Reparto completo por tramo, confirmado
  con `scripts/ejecutar-prioritarios.ts` y con clic real: Más de 90 días
  Q 636,675.19 (55 cuentas), Al día o sin fecha (0) Q 288,787.60 (20
  cuentas), 1 a 30 días Q 155,480.35 (25 cuentas), 31 a 60 días
  Q 32,183.60 (6 cuentas), 61 a 90 días Q 20,470.34 (5 cuentas). Mediana
  de atraso del grupo completo: 84 días (`comercial.medianaDias`).

Con esto, las dos categorías quedan en el mismo nivel de verificación que
Score y Gestión: dato real, corrido contra el dataset real, confirmado en
pantalla — ya no "mapa de código sin confirmar".

---

### Rediseño de KPIs — 2026-09-03

Mismo método y mismo nivel de rigor que la sección 1 (Cuadro de mando):
se corrió `scripts/ejecutar-prioritarios.ts` (cada valor intermedio de
las 4 categorías) y `scripts/opciones-prioritarios.ts` (candidatos de
reemplazo, con números reales) contra el dataset real (111 cuentas
priorizadas, corte 2026-08-24), y se auditó cada una de las 16 tarjetas
por valor de negocio, no por corrección de texto. El resultado final se
confirmó ejecutando `lib/agentes-prioritarios-b18.ts` de verdad
(`scripts/verificar-prioritarios-nuevo.ts`) y con clic real en
`/prioritarios` (Playwright, Chromium headless, las 4 categorías × 4
tarjetas + el dashboard B18 integral) — los valores extraídos de pantalla
coinciden, número por número, con lo que produce la función.

**Hallazgo de partida — dos duplicados exactos, no solo "cercanos" como
B18-12 en Cuadro de mando:**

1. `AT-Detecta` (bucket "Más de 90 días", `bucketLider.pct`) y
   `AT-Recomienda` (`coberturaAntiguedad`, antes del rediseño) eran el
   **mismo número hasta el octavo decimal** (56.16415226%): `bucketDias()`
   clasifica "Más de 90 días" con el mismo corte (`dias > 90`) que usa
   `moraCritica`, así que ambos suman exactamente el mismo saldo sobre el
   mismo denominador. No es una coincidencia del corte de datos — es la
   misma cuenta contada dos veces con dos nombres distintos.
2. `GE-Explica` (`coberturaGestion`, "saldo con gestión") y
   `GE-Recomienda` (`coberturaGestion`, "saldo con responsable asignado",
   antes del rediseño) usaban literalmente la misma variable — 0.00% en
   este corte, porque las 111 cuentas del dataset real no tienen ninguna
   gestión guardada en este navegador (🟡 B18-7).

A esos dos se suman cuatro tarjetas que duplicaban, número y etiqueta casi
literal, algo que ya se mostraba en el widget de `metricas` de su propia
categoría (mismo patrón que ya encontró Cuadro de mando en
`CA-Prioriza`/`CL-Prioriza`): `SC-Prioriza` (saldo del Top 10, ya en
`metricas`), `GE-Prioriza` (cuentas sin gestión, ya en `metricas`),
`CN-Prioriza` (cuentas para el 80%, ya en `metricas`) y `AT-Prioriza`
(cuentas en mora crítica, ya en `metricas`).

**Comparación inválida descartada, verificada antes de proponerla:** se
evaluó usar "días desde la última gestión" como alternativa para
`GE-Recomienda`, pero con 0 gestiones reales guardadas hoy (🟡 B18-7,
`gestiones: []` fuera del navegador) no hay ninguna fecha de la cual
partir — no es calculable, igual que "velocidad histórica de cobro" se
descartó en Cuadro de mando por los pagos sin `id_factura` (se volvió a
verificar antes de descartarla de nuevo acá: sigue siendo 0 de 4,020
pagos con `id_factura`). Tampoco se usó ningún cruce "sin gestión" más
fino (ej. Top 10 sin gestión) como KPI de `GE-Recomienda`, porque con
`coberturaGestion = 0%` **cualquier** subconjunto de "sin gestión" da
matemáticamente 100% sin gestión — no es información nueva, es la misma
cifra de base reformulada, y hubiera sido el mismo tipo de comparación
inválida (ventana distinta, mismo resultado garantizado de antemano) que
se descartó en Cuadro de mando para "solo meses cerrados". Se usó en
cambio la distribución de `accionSugerida` (regla determinista de
`lib/simulados.ts:96-104`, independiente de `localStorage`) para
`GE-Recomienda`, y el cruce Top 10-por-score para `GE-Prioriza` (ahí sí
aporta: nombra a las 10 cuentas de mayor prioridad, no repite el 0%
genérico).

**SC · Score**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "Q 442,105.55" · etiqueta "saldo del Top 10" — duplicaba exacto el segundo ítem del widget `metricas` de la misma categoría | KPI "101" · etiqueta "cuentas fuera del Top 10"; `resumen` agrega Q 691,491.53 (61.00%) | El saldo del Top 10 ya se veía en `metricas` sin necesidad de repetirlo en la tarjeta. "101 cuentas fuera de la vista" es un número que hoy no aparece en ningún otro lugar de la pantalla — dice cuánta worklist real queda invisible detrás del Top 10. |
| Recomienda | Mismo KPI/dona (`coberturaScore`, 39.00%); sin comparación | Mismo KPI/dona sin cambio; `resumen` agrega que el Top 10 por saldo puro cubriría 49.99% | KPI/dona no cambia porque `coberturaScore` es la métrica que de verdad define la categoría (mismo criterio que CL-Recomienda en Cuadro de mando). El contraste contra un ranking puro por dinero muestra que el score, al pesar también días de atraso, deja fuera saldo grande. |

**GE · Gestión**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "111" (conteo suelto de cuentas sin gestión, ya mostrado igual en `metricas`) | KPI "10" · etiqueta "cuentas del Top 10 por score sin gestión"; `resumen` nombra el saldo (Q 442,105.55) de esas 10 | El total genérico ya estaba en `metricas`. Acotar la pregunta a "¿y las 10 más prioritarias?" convierte un número plano en una lista de trabajo concreta — ni una de las cuentas top del score tiene seguimiento. |
| Recomienda | KPI "0.00%" (`coberturaGestion`) · etiqueta "saldo con responsable asignado" — literalmente el mismo número y casi el mismo texto que Explica, verificado como la misma variable, no una coincidencia | KPI "18.02%" · etiqueta "no necesita ninguna acción hoy (regla determinista)"; `resumen` reparte el resto: 55 "evaluar escalamiento", 25 "enviar recordatorio", 11 "llamar al cliente" | `coberturaGestion` ya la mostraba Explica; repetirla en Recomienda no agregaba nada. La distribución de `accionSugerida` es un dato real que ya calculaba `lib/simulados.ts` y no se mostraba en ningún lado — y es independiente de `localStorage`, así que no depende de qué navegador abre la página. |

**CN · Concentración**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "37" (cuentas para el 80%, ya mostrado igual en `metricas`) | KPI "4/5" · etiqueta "del Top 5 por saldo coincide con el Top 10 por score"; `resumen` nombra a NOVEX (score 50, Q 72,362.45) como la excepción | El conteo para el 80% ya estaba en `metricas`. El cruce con Score muestra algo que ninguna otra tarjeta decía: NOVEX es el 3er saldo más grande del grupo priorizado, pero el score (que también pesa días de atraso) no lo mete en su Top 10. |
| Recomienda | Mismo KPI/dona (`coberturaConcentracion`, 36.69%); sin comparación | Mismo KPI/dona sin cambio; `resumen` agrega que en Top 10 sube a 49.99% | Mismo criterio que CL-Recomienda en Cuadro de mando: KPI/dona se mantiene porque es la métrica que define la categoría; se agrega el contraste Top 5→Top 10 como contexto, mismo patrón ya usado en Cuadro de mando. |

**AT · Antigüedad**

| Tarjeta | Antes | Después | Por qué |
|---|---|---|---|
| Prioriza | KPI "55" (cuentas en mora crítica, ya mostrado igual en `metricas`) | KPI "49.55%" (55/111) · etiqueta "de las cuentas priorizadas está en mora crítica (90+)" | Mismo patrón que CA-Prioriza/CL-Prioriza en Cuadro de mando: un conteo suelto no dice si es mucho o poco; como % contra el total priorizado se lee de inmediato qué tan extendida está la mora crítica. |
| Recomienda | KPI "56.16%" (`coberturaAntiguedad`) · etiqueta "saldo en mora crítica" — duplicado exacto de Detecta, verificado a 8 decimales (`scripts/opciones-prioritarios.ts`) | KPI "81.82%" · etiqueta "de la mora crítica no está en el Top 10 por score"; `resumen` da el detalle: 10 de 55 cuentas sí están en el Top 10 (Q 442,105.55), las otras 45 (Q 194,569.64) no | El bucket "Más de 90 días" (Detecta) y `coberturaAntiguedad` (Recomienda) eran, por construcción, exactamente el mismo saldo sobre el mismo denominador — no dos lecturas distintas, la misma. El cruce contra el Top 10 por score sí aporta algo nuevo: la mayoría de la mora crítica (81.82%) no está siendo priorizada por el score, porque el score también pesa el saldo y estas cuentas no siempre son las de mayor saldo. |

**Tarjetas verificadas SIN CAMBIO** (auditadas y confirmadas correctas
tal cual estaban, mismo criterio que en Cuadro de mando — información
propia, no redundante con ninguna tarjeta vecina ni con el widget de
`metricas`): SC-Detecta (líder por score, reconstruido a mano en la
sección "Score — verificado exacto" de más arriba), SC-Explica (Top 2
del score del Top 10 — mide reparto del score, no de dinero), GE-Detecta
(score de la cuenta líder sin gestión), GE-Explica (saldo con/sin
gestión — el reparto base de la categoría), CN-Detecta (mayor saldo
individual), CN-Explica (Top 2 del Top 5 por saldo), AT-Detecta (bucket
líder por antigüedad) y AT-Explica (Top 2 tramos, con la aclaración de
"días de atraso máximo del cliente" que ya traía). El KPI/dona de
SC-Recomienda y CN-Recomienda tampoco cambió — sólo se les agregó una
oración de contexto al `resumen` (ver tablas arriba), mismo criterio que
CL-Recomienda y CA-Recomienda en Cuadro de mando.

En total: **6 de 16 tarjetas cambiaron de KPI/dona** (SC-Prioriza,
GE-Prioriza, GE-Recomienda, CN-Prioriza, AT-Prioriza, AT-Recomienda),
**2 mantuvieron el KPI/dona y sólo sumaron contexto al `resumen`**
(SC-Recomienda, CN-Recomienda), y **8 quedaron exactamente iguales**. El
`problema` a nivel de categoría también se actualizó en las 4 categorías
para reflejar el hallazgo más fuerte de cada una (mismo criterio que en
Cuadro de mando, donde el `problema` de Cobranza se actualizó tras el
cambio de Recomienda): SC menciona ahora las 101 cuentas fuera del Top
10, GE menciona que ni el Top 10 por score tiene gestión, CN menciona el
solape Top 5 saldo/Top 10 score, y AT menciona cuánta mora crítica no
está en el Top 10 por score.

No se tocó `components/commercial/MoldeB18.tsx` ni `lib/contrato-b18.ts`.
El bug del dona fijo (B18-1) sigue corregido: verificado de nuevo con
clic real en las 4 categorías × 4 tarjetas de `/prioritarios` — en las 16
combinaciones la dona del drill-down coincide con el `donaPct` propio de
la tarjeta activa cuando lo tiene (Detecta y Recomienda) o con
`categoria.cobertura` cuando no (Explica y Prioriza), nunca con una fila
fija ajena a la tarjeta abierta. `npx tsc --noEmit -p tsconfig.json` no
reporta errores en `lib/agentes-prioritarios-b18.ts`.

---

## 4. Canales y tipo de cliente (`/ventas/canales`)

Revisado con **queries reales contra Supabase** (no solo lectura de
código): se corrió `cargarDatasetReal()` (`lib/datosReales.ts`) en vivo,
el mismo fetch que hace el navegador, y se inspeccionaron las columnas
reales que devuelven las tablas `clientes` y `ventas`. 2026-09-02.

### 🟢 Verificado correcto — no existe el campo canal, ni en el código ni en la base

`lib/agentes-canales-b18.ts` declara que ninguna de las 4 categorías
(Participación, Crecimiento, Ticket, Riesgo) tiene fuente de datos:
todo dice "Sin dato" y `cobertura: 0`. El comentario del archivo dice
que esto se verificó "con grep sobre `lib/types.ts` y
`lib/datosReales.ts`" — lo volví a verificar, pero contra la base real,
no contra el código:

```
Claves reales de un registro de "clientes": id_cliente, nombre_cliente,
  identificacion_fiscal, estado_cliente, condiciones_pago_default_id,
  fecha_creacion
Claves reales de un registro de "ventas": id_venta, id_cliente,
  fecha_venta, moneda_id, total_referencia, estado_odoo
```

Ningún campo de canal, tipo de cliente, segmento, ni nada parecido.
Esta página es el ejemplo más limpio de la regla de fondo del proyecto
("ningún dato se inventa, si falta se dice explícito") funcionando
exactamente como debería — no hay ningún hallazgo que corregir acá. Si
algún día se agrega el campo en Odoo y se importa, este archivo es el
único lugar que hay que tocar para activar la página (ya deja los 4
`categoriaSinFuente(...)` armados con las preguntas correctas, solo
falta la fuente).

### 💡 Propuesta de ingeniería — qué KPI construir con los datos reales que SÍ existen, sin esperar el campo "canal"

Pedido explícito: ya que no hay "canal" oficial, proponer qué se puede
construir hoy respetando exclusivamente datos reales — nunca fabricar
un canal que no existe. Antes de proponer nada, verifiqué con query cuál
de los campos candidatos tiene información real detrás:

**Descartado, verificado con query:** `condiciones_pago_default_id`
(el único campo de `Cliente` que podría insinuar un "tipo de cliente")
está **null en el 100% de los 372 clientes** — cero variedad, cero
información. No lo propongo porque sería fabricar una segmentación
sobre un campo vacío; sería exactamente el tipo de número inventado que
la regla de fondo del proyecto prohíbe.

**Sí sostenido por datos reales — tres segmentaciones que NO son
"canal" (y hay que dejarlo clarísimo en el rótulo, para no repetir el
patrón de B18-4/B18-11 de dos cosas distintas con el mismo nombre), pero
sí son información real y útil que hoy no se muestra en ningún lado del
dashboard:**

1. **Segmento por volumen histórico (ABC/Pareto de clientes).**
   Fuente: `leerVentasReales(dataset).clientes` (`lib/lecturas-ventas-reales.ts:53-108`,
   ya calcula `valor` acumulado por cliente). Clasificar en A (los que
   completan el 80% del histórico acumulado, mismo criterio de
   `cuentasParaObjetivo` que ya usa `agentes-prioritarios-b18.ts:41-49`),
   B (siguiente tramo hasta 95%) y C (el resto). Es una segmentación de
   *tamaño comercial*, no de canal — pero es real, ya está la fórmula
   escrita en el proyecto (reusar, no reinventar) y hoy no se muestra en
   ninguna pantalla de Ventas.
2. **Antigüedad de relación.** Fuente: `Cliente.fecha_creacion`
   (100% de los 372 clientes con dato real, verificado por query, rango
   2022-08-08 a 2026-08-19). Agrupar en tramos (nuevo <6 meses, en
   desarrollo 6-24 meses, consolidado >24 meses) contra la fecha de
   corte. Dato real, campo ya poblado, cálculo trivial (`diasAtraso`-style
   resta de fechas que ya existe en `lib/calculos.ts`).
3. **Recurrencia.** Fuente: `clienteFila.pedidos` (ya calculado en
   `leerVentasReales`). Comprador único (1 pedido histórico) vs.
   recurrente (2+). Dato real, cero cálculo nuevo — es literalmente un
   campo que ya existe, solo que hoy no se expone como categoría propia.

**Cuando el campo canal SÍ llegue de Odoo** — no antes —, las 4
categorías ya escritas en `agentes-canales-b18.ts` se activan con este
mecanismo concreto (para que quede claro que no es magia, es ingeniería
ya diseñada, solo bloqueada por falta de la columna):
Participación = `repartir()` de venta confirmada agrupada por canal
(mismo patrón que ya usa `repartir()` en todo el molde); Crecimiento =
mismo mecanismo de `periodoComparable()` (`lecturas-ventas-reales.ts:39-51`)
pero particionado por canal en vez de global; Ticket = promedio
`valor/pedidos` por canal, mismo cálculo que ya hace `leerVentasReales`
por cliente; Riesgo/concentración = cruzar `analizarAgingComercial()`
(vencido por cliente) con el canal de cada cliente. Ninguna fórmula
nueva — son las que ya existen en el proyecto, solo particionadas por
un campo que hoy no está.

---

## 5. Detalle de venta (`/ventas/detalle`)

Revisado con **queries reales contra Supabase**: se corrió
`leerVentasReales()`, `detalleVenta()` y `construirDetalleVentaB18()`
(las mismas funciones que usa la página) contra el dataset real
completo — 372 clientes, 3,189 ventas confirmadas, 23,732 líneas de
venta, 751 productos — y se recalcularon a mano varios números para
confirmarlos contra lo que el código produce. 2026-09-02.

### 🟢 Verificado correcto — los últimos 10 pedidos y sus 4 tarjetas coinciden con la base real

Corrí `construirDetalleVentaB18()` real: la página lista los últimos 10
pedidos confirmados (`estado_odoo === "sale"`), del más reciente al más
viejo. Al 2026-08-19 (fecha de la venta confirmada más reciente en la
base), esos 10 son VTA-S03700, S03699, S03694, S03687, S03681, S03656,
S03646, S03678, S03658, S03650. Para el primero (VTA-S03700, WALMART,
2026-08-19) las 4 tarjetas que arma el código son exactamente:

- Detecta: **Q 20,150.19** "total confirmado Odoo" (dona 100%)
- Explica: **5 líneas**, "SKU en el pedido" (las 5 líneas resolvieron a producto — cobertura 100%)
- Prioriza: **Q 21,033.60** "composición a precio de lista"
- Recomienda: **0.77%** "de su historial acumulado"

El último número lo recalculé a mano por fuera del código: WALMART
acumula **Q 2,613,933.77** en **146 pedidos** históricos
(`lectura.clientes`, calculado sumando `total_referencia` de sus 146
ventas confirmadas). `20,150.19 / 2,613,933.77 × 100 = 0.770876%` →
coincide exacto con el 0.77% mostrado. La fórmula de `pesoDelPedido`
(`agentes-detalle-venta-b18.ts:64`) es correcta.

### 🟢 Verificado con query real — la advertencia "nunca sumar estas dos magnitudes" está bien fundada, no es solo teórica

El archivo advierte que `total_referencia` (con IVA y descuento) y la
composición de líneas (`cantidad × precio_unitario`, sin IVA ni
descuento) son magnitudes distintas que no se deben sumar. Medí qué tan
distintas son en la práctica, sobre los 3,189 pedidos confirmados:

- Composición mayor que el total confirmado: **2,999 pedidos** (el
  descuento aplicado pesa más que el 12% de IVA que sí trae el total).
- Empatados exactos: **190 pedidos**.
- Composición menor que el total: **0 pedidos** — los 9 que en un
  primer cálculo salieron "menores" resultaron ser el mismo empate,
  desalineado por acumulación de punto flotante al sumar `cantidad ×
  precio_unitario` línea por línea; con redondeo a centavos las 9
  cuadran exacto contra el total. Lo dejo anotado porque es exactamente
  el tipo de falso hallazgo que esta metodología pide descartar antes
  de escribirlo como bug.
- Agregado histórico completo: **Q 26,159,040.47** de composición contra
  **Q 19,292,422.91** de total confirmado — coincide, al centavo visible,
  con la cifra que el propio comentario de
  `lib/lecturas-ventas-reales.ts:157` ya declaraba ("Q26.16M contra
  Q19.29M"). El comentario no es una cifra vieja del código: sigue
  siendo cierta contra la base de hoy.

No hay nada que corregir acá — es una confirmación de que la separación
de las dos magnitudes en tarjetas distintas (Detecta vs. Prioriza) es
necesaria y está bien aplicada, no una precaución de sobra.

### 🟡 B18-13 — Un pedido sin `total_referencia` se mostraría como "Q 0.00", no como "Sin dato"

**Dónde:** `lib/agentes-detalle-venta-b18.ts:54`:

```ts
const totalConfirmado = venta.total_referencia?.valorParaMostrar() ?? 0;
```

y el mismo patrón en `lib/lecturas-ventas-reales.ts:36`
(`montoOdoo = (venta) => venta.total_referencia?.valorParaMostrar() ?? 0`).

**Qué comprobé con query real:** hoy, de los 3,189 pedidos confirmados,
**ninguno** tiene `total_referencia === null`
(`lib/datosReales.ts:324`: sólo entran a `ventas` los pedidos con
`estado_odoo === "sale"`, y ese import trae `total_odoo_referencia` casi
siempre poblado). El `?? 0` nunca se activa hoy — no es un bug que esté
pasando ahora mismo.

**Por qué igual lo anoto:** el `?? 0` es alcanzable por diseño — el
tipo de `venta.total_referencia` es nullable
(`v.total_odoo_referencia === null ? null : Cifra.hecho(...)`,
`lib/datosReales.ts:323-324`) precisamente porque Odoo puede no traer
ese campo en algún pedido. Si eso pasara en un import futuro, la
tarjeta Detecta mostraría **"Q 0.00"** — un número con apariencia de
medición real — en vez de "Sin dato", que es la convención que el
propio proyecto usa en toda otra parte (por ejemplo, la página de
Canales completa, sección 4 de este documento) para declarar que algo
no se pudo calcular. Un pedido real con un hueco de dato quedaría
indistinguible de un pedido que genuinamente se facturó en Q0.

**Impacto:** bajo hoy (0 casos reales), pero es el mismo tipo de riesgo
que la regla de fondo del proyecto existe para prevenir: un `??`
silencioso que convierte "no sé" en un número que parece un hecho.

**Arreglo propuesto:** en `agentes-detalle-venta-b18.ts`, donde se arma
`totalConfirmado` (línea 54) y la tarjeta Detecta (línea 94), distinguir
el caso `venta.total_referencia === null` y usar `kpiTexto: "Sin dato"`
con `donaPct: 0` en vez de `fmt(0)`, igual que ya hace
`agentes-canales-b18.ts` para toda su página. Mismo criterio para
`montoOdoo()` en `lecturas-ventas-reales.ts`, que alimenta también los
totales agregados de `/ventas/clientes` — ahí un pedido nulo hoy se
suma como Q0 dentro del total histórico sin ninguna nota, silenciosamente.

**Prioridad:** baja — preventivo, no hay ningún caso real corrompido en
el dataset actual (verificado con query, no supuesto).

### 🟢 Nota — el caso real de moneda distinta a GTQ existe, y está bien manejado, pero no se ve en esta página

Confirmé con query que existe exactamente **1 pedido** en toda la base
con moneda distinta de GTQ: `VTA-S00013`, 2022-09-19, **USD $453.39**.
El metadato "Moneda" de cada tarjeta (`agentes-detalle-venta-b18.ts:139`)
sí lo contempla (`"X — distinta de la moneda de registro"`), pero como
la página solo lista los **últimos 10** pedidos y ese caso es de 2022 (el
dataset llega hasta 2026-08-19), nunca aparece hoy en pantalla — no es
un hallazgo, es una nota de por qué no lo vas a ver si revisás la
página ahora mismo.

### 🟢 Nota — la cobertura de líneas está en 100% real, no solo declarado

`agentes-detalle-venta-b18.ts` incluye una salvedad ("Límite: Líneas sin
producto encontrado en el catálogo se excluyen de la composición; no se
estiman") para el caso de una línea de venta que apunte a un
`id_producto` que no existe en `productos`. Con query real sobre las
23,732 líneas de venta de TODO el dataset (no solo los 10 pedidos
listados): **0 líneas** apuntan a un producto inexistente. La
salvedad es código defensivo que hoy nunca se activa — está bien que
exista, no hace falta tocarla, solo queda registrado que el 100% de
cobertura que ves en cualquier pedido no es casualidad de los 10
listados, es así en todo el histórico.

### 💡 Propuesta de ingeniería — KPIs nuevos que sí se pueden construir hoy, con datos reales, y que hoy no se muestran

Las 4 tarjetas actuales (total confirmado, SKU del pedido, composición,
historial del cliente) no agotan lo que el dataset real permite. Antes
de proponer cada uno, lo corrí con query real para confirmar que el
campo detrás tiene datos de verdad — dos ideas obvias se descartaron
así:

**Descartado, verificado con query:** cruzar el pedido con su factura
para mostrar "estado de cobro de este pedido específico" (pagado/
vencido/vigente). `facturas.id_venta` existe como columna, pero
**0 de 3,182 facturas** tienen ese campo poblado — el vínculo factura↔pedido
no existe en la práctica en este snapshot. Proponerlo hoy sería inventar
una relación que la base no tiene. Queda anotado como el dato que
haría falta importar de Odoo para poder construir esta tarjeta en el
futuro.

**Sí sostenido por datos reales — 4 KPIs nuevos, con la fórmula exacta
y el número real de ejemplo que ya verifiqué (pedido VTA-S03700,
WALMART, 2026-08-19):**

1. **Margen bruto del pedido.** Fuente: `linea.precio_unitario` (el
   precio real de la línea, NO `producto.precio_unitario` — verifiqué
   por query que ese campo del catálogo está en **0 en el 100% de los
   751 productos**, es un campo muerto que no hay que usar para nada) menos
   `producto.costo_unitario` (poblado y > 0 en 745 de 751 productos,
   99.2%), multiplicado por `linea.cantidad`, sumado por pedido. Con el
   pedido de ejemplo: margen bruto **Q 10,477.80** sobre
   Q 21,033.60 de composición → **49.81%**. Verificado también a escala
   completa: sobre las 23,732 líneas de venta confirmada del histórico
   completo, margen agregado **Q 15,909,460.89** sobre
   Q 26,159,040.47 de composición → **60.82%**, con solo 16 líneas
   (0.07%) sin costo cargado. Sería la quinta tarjeta natural de esta
   página — hoy la composición a precio de lista se muestra pero nunca
   se cruza contra costo.
2. **% de descuento real aplicado.** Fuente: comparar `composicion`
   (sin IVA, sin descuento) contra `totalConfirmado` neto de IVA. El
   propio proyecto ya documenta que `total_referencia` trae el 12% de
   IVA incluido (`lib/lecturas-ventas-reales.ts:151`), así que la
   fórmula es `1 − (totalConfirmado / 1.12) / composicion`. Para el
   pedido de ejemplo: `1 − (20150.19/1.12) / 21033.60 = 14.5%` de
   descuento real sobre precio de lista. Es un ángulo nuevo del mismo
   par de números que ya se muestran por separado (Detecta/Prioriza),
   sin agregar ninguna fuente nueva — solo la resta que hoy no se hace.
3. **Este pedido contra el ticket promedio histórico del cliente.**
   Fuente: `clienteFila.ticket`, ya calculado y cargado en memoria por
   `leerVentasReales` (no hace falta ninguna query nueva). Mostrar
   "este pedido es 12% más alto/bajo que el ticket promedio de este
   cliente" en vez de solo el % de historial acumulado que ya muestra
   Recomienda — es información que ya está en el mismo objeto que hoy
   se usa, solo no se expone.
4. **Días desde el pedido anterior de este mismo cliente (recencia).**
   Fuente: `lectura.ventas` filtrado por `id_cliente`, buscando la venta
   inmediatamente anterior a la actual por fecha. Verificado con el
   pedido de ejemplo: el pedido anterior de WALMART antes de VTA-S03700
   fue VTA-S03699, del mismo día 2026-08-19 — o sea, 0 días de
   diferencia (Walmart puso más de un pedido el mismo día). Útil para
   distinguir un cliente con cadencia regular de uno que reaparece
   después de mucho tiempo, sin ningún dato nuevo, solo ordenando lo que
   ya se carga.

**Nota de calidad de dato para el equipo, no un hallazgo de esta
página:** `producto.precio_unitario` (el precio "de catálogo") está en
cero para el 100% de los 751 productos del dataset real. Ningún cálculo
del proyecto lo usa hoy (se usa siempre `linea.precio_unitario`, el
precio real de cada transacción), así que no rompe nada — pero si
alguien en el futuro propone un KPI que dependa de "precio de catálogo"
sin verificarlo primero con query, se va a encontrar con que ese campo
no tiene ningún dato real detrás.

---

## 6. Inventario (`/inventario`) — pendiente

---

## Resumen de arreglos, por prioridad

| # | Hallazgo | Alcance | Prioridad |
|---|---|---|---|
| B18-1 | Dona del drill-down no sigue a la tarjeta activa | Molde compartido → las 5 páginas (confirmado también en Prioritarios) | Alta — **✅ corregido 2026-09-02**, verificado con clic real en `/`, `/prioritarios` y `/aging` |
| B18-2 | Antigüedad/Cobranza no se ordenan cronológicamente | `agentes-cuadro-mando.ts` — confirmado también en `agentes-aging-b18.ts` (categoría AN), mismo síntoma exacto | Media |
| B18-3 | Los 4 roles repiten el mismo "Resultado" | Diseño heredado de la referencia | Baja — decisión de diseño, no bug |
| B18-4 | "Mora crítica 90+" mide por factura en Cuadro de mando y por cliente (contagio del máximo) en Prioritarios — mismo nombre, ~Q200,000 de diferencia | `lib/commercial-ejecutivo.ts` vs. `lib/simulados.ts` + `lib/agentes-prioritarios-b18.ts` | Alta |
| B18-5 | "Saldo priorizado total" es el 100% de la cartera con saldo, no un subconjunto priorizado | `lib/simulados.ts` (`prioridadSimulada`) | Media |
| B18-6 | La tarjeta "Recomienda" repite el mismo % y concepto dos veces en la misma oración (las 4 categorías de Prioritarios) | `MoldeB18.tsx:116` + `agentes-prioritarios-b18.ts` | Baja |
| B18-7 | "0% de gestión" no aclara que las gestiones viven solo en `localStorage` del navegador | `agentes-prioritarios-b18.ts` (metadatos de Gestión) | Media |
| B18-8 | "PROBLEMA ENCONTRADO" es un rótulo fijo, incluso cuando la lectura es 100% limpia (Cartera → Recomienda) | `MoldeB18.tsx` (rótulo) + calidad de texto dispareja entre roles | Media — pendiente decisión de redacción |
| B18-9 | La acción recomendada no se ajusta cuando el hueco que describe ya no existe (Cartera → Recomienda, cobertura 100%) | `agentes-cuadro-mando.ts` (patrón a revisar en los 6 archivos `lib/agentes-*.ts`) | Media — pendiente decisión de redacción |
| B18-10 | El caption del drill-down mezcla el KPI de la tarjeta con la cobertura de la categoría en una sola oración sin separación visual (Detecta/Explica/Prioriza, las 4 categorías) | `MoldeB18.tsx:127` — mismo origen que B18-6 | Baja |
| B18-11 | "Concentración Top 5" existe en Cuadro de mando (universo: clientes con vencido) y en Prioritarios (universo: las 111 cuentas priorizadas, ~100% de la cartera) con el mismo nombre corto y denominadores distintos — magnitud de la diferencia sin confirmar en pantalla | `agentes-cuadro-mando.ts` (CL) vs. `agentes-prioritarios-b18.ts` (CN) | Media — pendiente de captura para subir o bajar prioridad |
| B18-12 | En Cobranza, "62.03%" (Detecta) y "62.55%" (línea compartida de la categoría, y también título de Explica) miden razones distintas y aparecen pegados o duplicados en Diagnóstico | `agentes-cuadro-mando.ts:136-170` | Media |
| B18-13 | Un pedido sin `total_referencia` se mostraría como "Q 0.00" en vez de "Sin dato" — verificado con query real que hoy no ocurre (0 de 3,189 pedidos) | `agentes-detalle-venta-b18.ts:54,94` + `lecturas-ventas-reales.ts:36` | Baja — preventivo, sin caso real hoy |
| B18-14 | "Saldo vencido sin gestión" (Gestión) sumaba el saldo TOTAL abierto del cliente (incluye facturas al día), no solo lo vencido — sobreestimaba Q141,599.78 (16.76%) | `agentes-aging-b18.ts` (categoría GE) | Alta — **✅ corregido 2026-09-03**, verificado con clic real en `/aging` |
| B18-15 | "Pagada" (único motivo de exclusión presente) mostraba 0.00% del saldo excluido — el reparto usaba saldo, y una factura pagada tiene saldo Q0 por definición, en vez de contar facturas | `agentes-aging-b18.ts` (categoría EX) | Media — **✅ corregido 2026-09-03**, verificado con clic real en `/aging` |

Salvo B18-1, B18-14 y B18-15 (ya corregidos y verificados con clic
real), nada más de esto se ha corregido todavía. Este archivo es el
inventario, no el changelog — se actualiza a "corregido" recién cuando
se verifique en pantalla, con clic real, después del arreglo.

> **Nota al pie (2026-09-03):** el rediseño de KPIs documentado en
> "Rediseño de KPIs — 2026-09-03" (dentro de la sección 1) no corrige
> ninguno de los hallazgos B18-1 a B18-13 de esta tabla — son mejoras de
> valor de negocio, no bugs — y no cambió ninguna fila de esta tabla.
> B18-12 (62.03% vs. 62.55% en Cobranza) sigue vigente tal cual: ambos
> KPIs se mantuvieron sin cambio en el rediseño.

> **Nota al pie (2026-09-03), Prioritarios:** el rediseño de KPIs
> documentado en "Rediseño de KPIs — 2026-09-03" (dentro de la sección 3)
> tampoco corrige ningún hallazgo de esta tabla — B18-4, B18-5, B18-6,
> B18-7, B18-10 y B18-11 siguen exactamente como estaban, con la misma
> prioridad. La única fila que ahora tiene un dato adicional es B18-11:
> "Confirmado con clics reales — Concentración (CN) y Antigüedad (AT)"
> (sección 3) mide la magnitud real de la diferencia (36.69% en
> Prioritarios contra 38.93% en Cuadro de mando, 2.24 puntos) — confirma
> que la diferencia existe y es real, no que se haya resuelto; B18-11
> sigue abierta con prioridad media. El rediseño sí encontró y corrigió
> dos duplicados exactos dentro de `agentes-prioritarios-b18.ts` que no
> tenían número de hallazgo propio (AT-Detecta = AT-Recomienda a 8
> decimales, y GE-Explica = GE-Recomienda por compartir la misma
> variable) — quedan documentados en "Rediseño de KPIs", no en esta
> tabla, porque no afectaban la lectura del dato (ambos números eran
> correctos), sólo la repetían sin aportar nada nuevo.

> **Nota al pie (2026-09-03), Aging:** el rediseño de KPIs documentado
> en "Rediseño de KPIs — 2026-09-03" (dentro de la sección 2) sí agrega
> dos filas nuevas a esta tabla — B18-14 y B18-15 — porque, a diferencia
> de los rediseños de Cuadro de mando y Prioritarios, acá el propio
> proceso de auditar cada tarjeta con datos reales encontró dos casos
> donde el número en pantalla no describía lo que decía describir (no
> sólo tarjetas débiles o redundantes). Ambos se corrigieron directamente
> en `lib/agentes-aging-b18.ts`, sin tocar `MoldeB18.tsx` ni
> `contrato-b18.ts`, y quedan verificados con clic real. B18-2 también se
> confirmó vigente en Aging (categoría AN, mismo síntoma que en Cartera)
> sin corregirse — misma decisión de diseño pendiente que ya tenía en
> Cuadro de mando.
