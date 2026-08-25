"use client";

// Puerta de entrada animada (Paso 11 · rediseño).
//
// HONESTIDAD ANTES QUE ESTÉTICA: esto NO es autenticación. No hay servidor, no
// hay contraseña que verificar, no hay sesión. Es una puerta de demostración, y
// la pantalla lo dice en voz alta en vez de fingir seguridad que no existe.
// Cualquier valor entra. El día que haya auth real, este archivo se reemplaza
// entero — no se "endurece".
//
// La animación no es decoración: dibuja la cadena Inventario → Ventas → Cobro,
// que es la tesis del producto. Quien entra ya vio de qué se trata.

import { useRouter } from "next/navigation";
import { useState } from "react";

const PASOS = [
  { modulo: "Inventario", hecho: "Entra mercancía a bodega", punto: "#0d9488" },
  { modulo: "Ventas", hecho: "Se vende y se factura", punto: "#4f46e5" },
  { modulo: "Cobranza", hecho: "Se cobra — o se atrasa", punto: "#d97706" },
];

function Conector({ retardo }: { retardo: number }) {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden className="shrink-0 self-center">
      <path
        d="M2 12 C 12 12, 22 12, 32 12"
        fill="none"
        stroke="#c9cede"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="linea-dibujada"
        style={{ animationDelay: `${retardo}ms` }}
      />
      <circle cx="32" cy="12" r="2.5" fill="#c9cede" className="entrada-suave" style={{ animationDelay: `${retardo + 600}ms` }} />
    </svg>
  );
}

export default function PaginaLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("demo@ficticio.local");
  const [saliendo, setSaliendo] = useState(false);

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    setSaliendo(true);
    // La espera es la animación de salida, no una verificación.
    setTimeout(() => router.push("/"), 460);
  }

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-auto px-5 py-10 ${saliendo ? "salida-puerta" : ""}`}
      style={{
        background:
          "radial-gradient(900px 600px at 12% -10%, #ffffff 0%, transparent 60%), radial-gradient(700px 500px at 88% 0%, #eef1f6 0%, transparent 55%), #f4f5f7",
      }}
    >
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* Izquierda — la cadena se dibuja sola: la tesis antes que el formulario */}
        <section>
          <p className="etiqueta-fase entrada-suave uppercase">
            <span className="mr-1.5 opacity-50">◆</span> Prototipo · datos ficticios
          </p>
          <h1
            className="entrada-suave mt-2 text-4xl font-bold leading-tight text-tinta"
            style={{ animationDelay: "90ms" }}
          >
            Dashboard CxC
          </h1>
          <p
            className="entrada-suave mt-3 max-w-md text-sm leading-relaxed text-tintaSuave"
            style={{ animationDelay: "180ms" }}
          >
            Tres módulos, una sola cadena. La existencia, el total vendido y el saldo por
            cobrar no son campos que alguien teclea: se derivan de los mismos hechos.
          </p>

          <ol className="mt-9 flex flex-nowrap items-stretch">
            {PASOS.map((p, i) => (
              <li key={p.modulo} className="flex items-stretch">
                <div
                  className="entrada-suave flex w-[152px] shrink-0 flex-col"
                  style={{ animationDelay: `${300 + i * 320}ms` }}
                >
                  <div className="tarjeta-flotante flex h-full flex-col gap-2 px-4 py-3.5">
                    <span
                      aria-hidden
                      className="latido h-2 w-2 rounded-pastilla"
                      style={{ background: p.punto, animationDelay: `${i * 500}ms` }}
                    />
                    <p className="text-xs leading-snug text-tinta">{p.hecho}</p>
                  </div>
                  {/* Etiqueta DEBAJO del bloque, como en la referencia */}
                  <p className="etiqueta-fase mt-2 px-1">{p.modulo}</p>
                </div>
                {i < PASOS.length - 1 && <Conector retardo={480 + i * 320} />}
              </li>
            ))}
          </ol>
        </section>

        {/* Derecha — la puerta. Translúcida, flotante, con un solo negro. */}
        <form
          onSubmit={entrar}
          className="tarjeta-flotante entrada-suave p-8"
          style={{ animationDelay: "240ms" }}
        >
          <p className="etiqueta-fase uppercase">
            <span className="mr-1.5 opacity-50">→</span> Entrada
          </p>
          <h2 className="mt-1.5 text-xl font-bold text-tinta">Abrir el prototipo</h2>

          {/* El aviso va ARRIBA del formulario, no escondido al pie. */}
          <p className="mt-4 rounded-tarjeta border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900 backdrop-blur">
            <b>Esto no es un inicio de sesión real.</b> No hay servidor, ni contraseña que
            verificar, ni sesión que proteger. Es una puerta de demostración: cualquier
            valor entra. No escribas acá credenciales de ninguna cuenta tuya.
          </p>

          <label className="etiqueta-fase mt-6 block" htmlFor="usuario">
            Usuario de demostración
          </label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-pastilla border border-white/90 bg-white/70 px-4 py-2.5 text-sm text-tinta shadow-flotante outline-none transition focus:ring-2 focus:ring-tinta/20"
          />

          <label className="etiqueta-fase mt-4 block" htmlFor="clave">
            Clave (ignorada — no se envía ni se guarda)
          </label>
          <input
            id="clave"
            type="password"
            defaultValue="········"
            autoComplete="off"
            className="mt-1.5 w-full rounded-pastilla border border-white/90 bg-white/70 px-4 py-2.5 text-sm text-tintaSuave shadow-flotante outline-none transition focus:ring-2 focus:ring-tinta/20"
          />

          <button
            type="submit"
            className="pastilla-activa mt-7 w-full px-5 py-3 text-sm font-semibold transition hover:opacity-90"
          >
            Entrar al prototipo
          </button>

          <p className="mt-4 text-center text-[11px] text-etapa">
            Todos los datos son ficticios. Ninguna fórmula está aprobada por Finanzas.
          </p>
        </form>
      </div>
    </div>
  );
}
