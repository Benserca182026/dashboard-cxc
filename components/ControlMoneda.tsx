"use client";

// EL CONTROL DE MONEDA — quetzal por defecto, dólar como vista derivada.
//
// DEPENDE DE (R7): de si existe un tipo de cambio con fuente y fecha. Ese único
// hecho vive en `TIPO_CAMBIO` (lib/store.tsx) y decide cuál de las DOS salidas
// que están construidas acá abajo se pinta:
//
//   SI NO HAY TASA (hoy)  → la opción "Dólares" se muestra DESHABILITADA y
//                           debajo aparece el bloque que explica qué falta, qué
//                           se pierde y cómo se llena. No es un botón que no
//                           responde: es un botón que dice por qué no responde.
//   SI HAY TASA           → la opción se habilita sola, y mientras la vista en
//                           dólares esté activa la pantalla muestra el valor de
//                           la tasa, su fuente y su fecha, SIEMPRE visibles.
//
// SI RESULTA FALSO que hoy no hay tasa, no se cae nada de este archivo: las dos
// ramas ya están escritas y probadas por construcción.
//
// LAS CUATRO REGLAS DURAS, y dónde se cumple cada una:
//
//  1. El quetzal es el predeterminado siempre.
//     → `monedaVista` se DERIVA en lib/store.tsx: la vista en dólares exige
//       haber sido pedida Y ser posible. No hay estado que pueda quedar mal.
//  2. Ninguna conversión sin tipo de cambio declarado (valor, fuente, fecha).
//     → `Cifra.enDolares()` (lib/types.ts) es la única puerta a la capa
//       "conversion" y exige el objeto `TipoCambio` entero.
//  3. Un monto en dólares es una cifra derivada, no un hecho.
//     → capa "conversion" en el TIPO, invariante: no se puede sumar ni comparar
//       contra "hecho" ni contra "composicion". Y se declara en la interfaz,
//       con la banda de abajo.
//  4. El cambio es de vista, nunca de dato.
//     → todo se calcula en quetzales; `fmt()` del store convierte al pintar, y
//       es el último paso antes del pixel.

import { useApp } from "@/lib/store";

const TINTE_SIN_DATO = {
  disco: "#5b7a99",
  fondoPastilla: "rgba(91,122,153,.14)",
  textoPastilla: "#3f5a75",
} as const;

export function ControlMoneda() {
  const {
    monedaRegistro,
    monedaVista,
    setMonedaVista,
    tipoCambio,
    motivoSinTipoCambio,
    puedeVerEnDolares,
  } = useApp();

  // Un dataset que YA está en dólares no tiene vista derivada que ofrecer:
  // convertirlo a sí mismo no es una lectura distinta, es ruido. Se dice, en
  // vez de mostrar un control que no cambia nada.
  const yaEstaEnDolares = monedaRegistro === "USD";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
          Moneda
        </span>
        <div
          role="group"
          aria-label="Moneda de la vista"
          className="inline-flex overflow-hidden rounded-pastilla border border-[rgba(22,24,29,.1)]"
        >
          <BotonMoneda
            activo={monedaVista === "GTQ"}
            deshabilitado={yaEstaEnDolares}
            onClick={() => setMonedaVista("GTQ")}
            titulo={
              yaEstaEnDolares
                ? "Este dataset está denominado en dólares: no hay montos en quetzales que mostrar."
                : "Quetzales — la moneda en que están los hechos"
            }
          >
            Q Quetzales
          </BotonMoneda>
          <BotonMoneda
            activo={monedaVista === "USD"}
            deshabilitado={!puedeVerEnDolares}
            onClick={() => setMonedaVista("USD")}
            titulo={
              yaEstaEnDolares
                ? "Este dataset ya está en dólares."
                : puedeVerEnDolares
                  ? "Dólares — lectura derivada del mismo dinero"
                  : "Sin tipo de cambio declarado: la conversión no está disponible."
            }
          >
            $ Dólares
          </BotonMoneda>
        </div>

        {/* La procedencia del número que se está viendo, siempre a la vista. */}
        {monedaVista === "USD" && tipoCambio && (
          <span
            className="rounded-pastilla px-2 py-1 text-[9.5px] font-semibold leading-none"
            style={{ background: "rgba(194,112,58,.12)", color: "#a4551f" }}
          >
            cifra derivada
          </span>
        )}
      </div>

      {/* SALIDA 1 · hay tasa y la vista en dólares está activa: la tasa, su
          fuente y su fecha quedan en pantalla mientras dure la vista. Un monto
          convertido sin su tasa a la vista es un monto sin procedencia. */}
      {monedaVista === "USD" && tipoCambio && (
        <div className="rounded-[9px] border border-[rgba(194,112,58,.28)] bg-[rgba(194,112,58,.06)] px-2.5 py-2">
          <p className="text-[10px] leading-relaxed text-[#8a5a2b]">
            Los montos en dólares son una <b>lectura derivada</b>, no un hecho: el
            dato está en quetzales y todo se calcula en quetzales. La conversión
            se aplica sólo al mostrar.
          </p>
          <dl className="mt-1.5 space-y-0.5 text-[10.5px] leading-relaxed">
            <div className="flex gap-2">
              <dt className="shrink-0 text-[#a0a2a6]">tasa</dt>
              <dd className="font-mono text-[#6b6f78]">
                Q{tipoCambio.quetzalesPorDolar.toLocaleString("es-GT", {
                  minimumFractionDigits: 5,
                  maximumFractionDigits: 5,
                })}{" "}
                por US$1
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[#a0a2a6]">fuente</dt>
              <dd className="text-[#6b6f78]">{tipoCambio.fuente}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-[#a0a2a6]">fecha</dt>
              <dd className="font-mono text-[#6b6f78]">{tipoCambio.fecha}</dd>
            </div>
            {tipoCambio.enlace && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-[#a0a2a6]">ver</dt>
                <dd>
                  <a className="text-[#a4551f] underline" href={tipoCambio.enlace}>
                    {tipoCambio.enlace}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* SALIDA 2 · no hay tasa: el control deshabilitado EXPLICA qué falta,
          con el mismo vocabulario del estado "sin-dato" de los agentes. Un
          control gris sin motivo se lee como una falla de la aplicación. */}
      {!puedeVerEnDolares && !yaEstaEnDolares && (
        <div
          className="rounded-[9px] border px-2.5 py-2"
          style={{ borderColor: "rgba(91,122,153,.3)", background: TINTE_SIN_DATO.fondoPastilla }}
        >
          <p className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
              style={{ background: TINTE_SIN_DATO.disco }}
            >
              ?
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: TINTE_SIN_DATO.textoPastilla }}
            >
              Vista en dólares no disponible
            </span>
          </p>
          <dl className="mt-1.5 space-y-1.5">
            {(
              [
                ["Qué falta", motivoSinTipoCambio.queFalta],
                ["Qué se pierde", motivoSinTipoCambio.consecuencia],
                ["Cómo se llena", motivoSinTipoCambio.comoSeLlena],
              ] as [string, string][]
            ).map(([rotulo, texto]) => (
              <div key={rotulo}>
                <dt
                  className="text-[8.5px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: TINTE_SIN_DATO.textoPastilla }}
                >
                  {rotulo}
                </dt>
                <dd className="mt-0.5 text-[10px] leading-[1.4] text-[#6b6f78]">{texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {yaEstaEnDolares && (
        <p className="text-[10px] leading-relaxed text-[#a0a2a6]">
          Este dataset (demo ficticio) está denominado en dólares, así que no hay
          conversión que ofrecer. Sobre el dataset real de Odoo, que está en
          quetzales, este control cambia toda la vista de una vez.
        </p>
      )}
    </div>
  );
}

function BotonMoneda({
  activo,
  deshabilitado,
  onClick,
  titulo,
  children,
}: {
  activo: boolean;
  deshabilitado?: boolean;
  onClick: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={activo}
      title={titulo}
      className={`px-2.5 py-1 text-[10.5px] font-semibold transition ${
        activo
          ? "bg-tinta text-white"
          : deshabilitado
            ? "cursor-not-allowed bg-transparent text-[#c6cad2]"
            : "bg-transparent text-[#6b6f78] hover:bg-[rgba(22,24,29,.04)]"
      }`}
    >
      {children}
    </button>
  );
}
