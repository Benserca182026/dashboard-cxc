"use client";

// Los cuatro controles de la esquina superior derecha, al modo de la
// referencia: buscar, correo, notificaciones y la persona que usa el tablero.
//
// Los tres primeros abren una VENTANA GRANDE, con el mismo gesto que ya usan
// los agentes: el fondo se aleja con desenfoque y, en cuanto tocás dentro, el
// desenfoque se va — porque a partir de ahí estás trabajando en la ventana y
// necesitás ver el tablero detrás para contrastar.
//
// QUÉ ES REAL Y QUÉ NO, para que nadie se confunda:
//   · La lupa BUSCA de verdad sobre el dataset cargado y filtra en vivo.
//   · Correo y Avisos muestran el flujo de automatización con sus pasos
//     conectados, pero NO envían nada: no hay servicio de correo detrás. Está
//     declarado dentro de la propia ventana, no escondido en un comentario.

import { useEffect, useMemo, useState } from "react";
import type { Dataset } from "@/lib/types";
import { fmtMoneda } from "@/lib/calculos";

type Panel = "buscar" | "correo" | "avisos" | null;

/** Ventana grande. El velo se desvanece al primer toque dentro: lo que se abre
 *  sale del tablero, así que hay que poder seguir viéndolo mientras se trabaja. */
function Ventana({
  titulo,
  bajada,
  onCerrar,
  children,
}: {
  titulo: string;
  bajada: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const [tocada, setTocada] = useState(false);

  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

  return (
    <div
      className={`entrada-suave fixed inset-0 z-50 grid place-items-center p-6 ${tocada ? "" : "velo-agente"}`}
      onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="ventana-agente flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden"
        onPointerDown={() => setTocada(true)}
      >
        <div className="flex items-start gap-4 border-b border-[rgba(22,24,29,.06)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-tinta">{titulo}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[#8b8f98]">{bajada}</p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 shrink-0 rounded-full px-2 py-1 text-[15px] leading-none text-[#a0a2a6] transition hover:text-tinta"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/** Buscador con filtros. Busca de verdad: clientes y facturas del dataset
 *  cargado, con los filtros aplicándose en vivo sobre el resultado. */
function PanelBuscar({ dataset }: { dataset: Dataset }) {
  const [texto, setTexto] = useState("");
  const [filtros, setFiltros] = useState<string[]>([]);

  const alternar = (f: string) =>
    setFiltros((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const clientesPorId = useMemo(
    () => new Map(dataset.clientes.map((c) => [c.id_cliente, c.nombre_cliente])),
    [dataset.clientes]
  );

  const resultados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    let facturas = dataset.facturas;
    if (filtros.includes("sin-vencimiento")) facturas = facturas.filter((f) => !f.fecha_vencimiento);
    if (filtros.includes("anuladas")) facturas = facturas.filter((f) => f.estado_factura === "anulada");
    if (filtros.includes("grandes")) {
      const orden = [...dataset.facturas].sort((a, b) => b.monto_original - a.monto_original);
      const corte = orden[Math.floor(orden.length * 0.25)]?.monto_original ?? 0;
      facturas = facturas.filter((f) => f.monto_original >= corte);
    }
    if (q) {
      facturas = facturas.filter(
        (f) =>
          f.numero_factura.toLowerCase().includes(q) ||
          (clientesPorId.get(f.id_cliente) ?? "").toLowerCase().includes(q)
      );
    }
    const clientes = q
      ? dataset.clientes.filter((c) => c.nombre_cliente.toLowerCase().includes(q))
      : dataset.clientes;
    return { facturas: facturas.slice(0, 40), clientes: clientes.slice(0, 12), total: facturas.length };
  }, [texto, filtros, dataset, clientesPorId]);

  const FILTROS = [
    { id: "sin-vencimiento", etiqueta: "sin fecha de vencimiento" },
    { id: "anuladas", etiqueta: "anuladas" },
    { id: "grandes", etiqueta: "el 25% más grandes" },
  ];

  return (
    <div className="p-6">
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por cliente o número de factura…"
        className="w-full rounded-[14px] border border-[rgba(22,24,29,.09)] bg-white px-4 py-3 text-[14px] text-tinta outline-none transition focus:border-[rgba(31,46,82,.28)]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-[#8b8f98]">Filtros:</span>
        {FILTROS.map((f) => {
          const activo = filtros.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => alternar(f.id)}
              aria-pressed={activo}
              className="rounded-pastilla px-3 py-1.5 text-[11.5px] font-medium transition"
              style={
                activo
                  ? { background: "#16181d", color: "#fff" }
                  : { background: "rgba(22,24,29,.05)", color: "#5b5e64" }
              }
            >
              {f.etiqueta}
            </button>
          );
        })}
        {filtros.length > 0 && (
          <button onClick={() => setFiltros([])} className="text-[11px] text-[#a0a2a6] underline">
            limpiar
          </button>
        )}
      </div>

      <p className="mt-4 text-[11px] text-[#a0a2a6]">
        {resultados.total} factura(s) coinciden · {resultados.clientes.length} cliente(s)
      </p>

      {resultados.clientes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {resultados.clientes.map((c) => (
            <span
              key={c.id_cliente}
              className="rounded-pastilla bg-[rgba(31,46,82,.06)] px-3 py-1.5 text-[11.5px] text-[#4a4e57]"
            >
              {c.nombre_cliente}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-[14px] border border-[rgba(22,24,29,.07)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[rgba(31,46,82,.04)] text-left text-[10px] uppercase tracking-[0.06em] text-[#8b8f98]">
              <th className="px-3 py-2 font-semibold">Factura</th>
              <th className="px-3 py-2 font-semibold">Cliente</th>
              <th className="px-3 py-2 font-semibold">Vence</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {resultados.facturas.map((f) => (
              <tr key={f.id_factura} className="border-t border-[rgba(22,24,29,.05)]">
                <td className="px-3 py-2 font-medium text-tinta">{f.numero_factura}</td>
                <td className="px-3 py-2 text-[#5b5e64]">{clientesPorId.get(f.id_cliente) ?? "—"}</td>
                <td className="px-3 py-2 text-[#8b8f98]">{f.fecha_vencimiento ?? "sin fecha"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-tinta">
                  {fmtMoneda(f.monto_original)}
                </td>
              </tr>
            ))}
            {resultados.facturas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#a0a2a6]">
                  Nada coincide. No se inventa un resultado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Nodo {
  id: string;
  x: number;
  y: number;
  titulo: string;
  cuerpo: string;
  tipo: "disparador" | "condicion" | "accion" | "salida";
}

/** Lienzo de automatización: pasos conectados, al modo de un editor de flujos.
 *  Es la estructura que va a tener el módulo; hoy describe el flujo, no lo
 *  ejecuta. */
function Lienzo({
  nodos,
  enlaces,
  nota,
}: {
  nodos: Nodo[];
  enlaces: [string, string][];
  nota: string;
}) {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const ANCHO = 230;
  const ALTO = 96;

  const color = (t: Nodo["tipo"]) =>
    t === "disparador" ? "#c2703a" : t === "condicion" ? "#3557d6" : t === "salida" ? "#0f766e" : "#5b5e64";

  return (
    <div className="p-6">
      <div className="lienzo-nodos relative overflow-auto rounded-[16px]" style={{ height: 460 }}>
        <div className="relative" style={{ width: 1090, height: 430 }}>
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {enlaces.map(([a, b]) => {
              const na = porId.get(a);
              const nb = porId.get(b);
              if (!na || !nb) return null;
              const x1 = na.x + ANCHO;
              const y1 = na.y + ALTO / 2;
              const x2 = nb.x;
              const y2 = nb.y + ALTO / 2;
              const dx = Math.max(40, (x2 - x1) / 2);
              return (
                <g key={`${a}-${b}`}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#b9c7dd"
                    strokeWidth="1.4"
                    strokeDasharray="5 5"
                  />
                  <circle cx={x1} cy={y1} r="3.2" fill="#fff" stroke="#b9c7dd" strokeWidth="1.2" />
                  <circle cx={x2} cy={y2} r="3.2" fill="#fff" stroke="#b9c7dd" strokeWidth="1.2" />
                </g>
              );
            })}
          </svg>
          {nodos.map((n) => (
            <div key={n.id} className="nodo-flujo absolute" style={{ left: n.x, top: n.y, width: ANCHO }}>
              <p
                className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: color(n.tipo) }}
              >
                {n.tipo}
              </p>
              <p className="mt-1 text-[12.5px] font-semibold leading-tight text-tinta">{n.titulo}</p>
              <p className="mt-1 text-[10.5px] leading-snug text-[#85878c]">{n.cuerpo}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#a0a2a6]">{nota}</p>
    </div>
  );
}

const FLUJO_CORREO: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Cada lunes, 8:00", cuerpo: "Se dispara por calendario, no por una persona." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Factura cruza 60 días", cuerpo: "Se dispara al cambiar de tramo en el aging." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿Supera el umbral?", cuerpo: "Monto y días de atraso contra los umbrales acordados con Finanzas." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿Hay disputa abierta?", cuerpo: "Si la hay no se reclama: se avisa al responsable de la cuenta." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el mensaje", cuerpo: "Cliente, facturas, saldo, días y fecha de corte, tomados del dato." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Avisar al vendedor", cuerpo: "Con el detalle de la disputa que bloquea el cobro." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Enviar al cliente", cuerpo: "Un envío por cliente y por semana, con copia a cobranzas." },
  ],
  enlaces: [
    ["d1", "c1"],
    ["d2", "c1"],
    ["c1", "c2"],
    ["c1", "a1"],
    ["c2", "s1"],
    ["a1", "s2"],
  ],
};

const FLUJO_AVISOS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular la cartera", cuerpo: "Cada vez que cambia el dato de esta página." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Un tramo lo explica una sola factura?", cuerpo: "El mismo umbral del agente Rastreador: 60% del tramo." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Un cliente pasa del 35%?", cuerpo: "El umbral de concentración del agente Balanza." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Qué cambió, cuánto, desde cuándo, y el enlace a esta vista con su corte." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [
    ["d1", "c1"],
    ["d1", "c2"],
    ["c1", "a1"],
    ["c2", "a1"],
    ["a1", "s1"],
  ],
};

/* Los mismos dos flujos, pero dichos desde el aging: acá el disparador no es
   "la cartera", es la FECHA DE CORTE y el cruce de tramo. La estructura no
   cambia — cambia de qué habla cada nodo, porque un aviso escrito para la
   cartera general no describe lo que esta pantalla mira. */
const FLUJO_CORREO_AGING: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Se mueve la fecha de corte", cuerpo: "El aging se reclasifica entero: los tramos son otros." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Una factura cambia de tramo", cuerpo: "Pasa de 31–60 a 61–90, o de 61–90 a 90+." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿A qué tramo entró?", cuerpo: "Cada tramo tiene su tono de reclamo: no se escribe igual a 1–30 que a 90+." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿Tiene fecha de vencimiento?", cuerpo: "Sin fecha la factura queda FUERA del aging: no se reclama por días que no se pueden calcular." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el reclamo del tramo", cuerpo: "Factura, saldo, días de atraso y la fecha de corte con la que se calcularon." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Pedir la fecha faltante", cuerpo: "Se pide el dato a facturación en vez de inventarle un vencimiento." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Enviar al cliente", cuerpo: "Un aviso por factura que cruzó de tramo, con copia a cobranzas." },
  ],
  enlaces: [
    ["d1", "c1"],
    ["d2", "c1"],
    ["c1", "c2"],
    ["c1", "a1"],
    ["c2", "s1"],
    ["a1", "s2"],
  ],
};

const FLUJO_AVISOS_AGING: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular el aging", cuerpo: "Cada vez que cambia la fecha de corte de esta página." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Un tramo pasa del 50% del vencido?", cuerpo: "El umbral de tramo dominante del argumento de esta página." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Un cliente pasa del 35% del vencido?", cuerpo: "La concentración se mide sobre lo VENCIDO, no sobre la cartera entera." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Cuánto está vencido, desde qué tramo, en quién, y con qué corte se calculó." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [
    ["d1", "c1"],
    ["d1", "c2"],
    ["c1", "a1"],
    ["c2", "a1"],
    ["a1", "s1"],
  ],
};

// ── Los seis módulos nuevos (paso M6 de la reestructuración) ───────────────
// Mismo criterio que aging: el disparador y las condiciones hablan de ESTE
// módulo, no de la cartera general — un aviso de ventas no describe lo mismo
// que uno de inventario. Los umbrales citados son los mismos que ya declaran
// los agentes y los argumentos de cada página (Agentes.tsx / argumento.ts):
// un aviso nunca puede contradecir lo que el tablero muestra.

const FLUJO_CORREO_PRIORITARIOS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "El score cruza el umbral de escalamiento", cuerpo: "Score simulado > 90 (techo ficticio de esta demo)." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Una cuenta entra en disputa", cuerpo: "Se dispara al abrirse una disputa sobre una factura de la cuenta." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿Sigue entre las 3 más urgentes?", cuerpo: "El mismo corte que usa el agente Vigía: top 3 por score." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿Está en disputa?", cuerpo: "Si lo está, no se llama: se rutea a «resolver disputa» (regla del Paso 3)." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el resumen de la cuenta", cuerpo: "Cliente, score, saldo y días de atraso, tomados de la worklist." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Avisar al responsable de la disputa", cuerpo: "Con el detalle de lo que bloquea la llamada." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Avisar al cobrador", cuerpo: "Una alerta por cuenta que entra al podio de urgencia." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c2"], ["c1", "a1"], ["c2", "s1"], ["a1", "s2"]],
};

const FLUJO_AVISOS_PRIORITARIOS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular la worklist", cuerpo: "Cada vez que cambia el score de alguna cuenta." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Un cliente concentra ≥35% del saldo de la worklist?", cuerpo: "El umbral del agente Balanza de este módulo." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Hay cuentas sin ningún día de atraso?", cuerpo: "El umbral del agente Filtro: entraron por saldo, no por atraso." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Qué cambió en el podio de prioridad y por qué." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_CORREO_SEGUIMIENTO: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Pasan 30 días sin ninguna gestión", cuerpo: "Cliente con saldo abierto y cero entradas en la bitácora." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Se registra una gestión", cuerpo: "Al guardar una entrada nueva en la bitácora (estado local del navegador)." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿El cliente sigue con saldo abierto?", cuerpo: "Si ya pagó, no corresponde seguimiento." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿La próxima acción quedó con fecha?", cuerpo: "Sin fecha no hay recordatorio que programar." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el recordatorio", cuerpo: "Cliente, tipo de gestión, resultado y próxima acción, tomados de la bitácora." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Recordatorio de la próxima acción propuesta." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Marcar como pendiente de arranque", cuerpo: "Sin gestión previa: es el vacío que señala la etapa 3 del argumento de esta página." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c1"], ["c1", "s2"], ["c1", "a1"], ["a1", "s1"]],
};

const FLUJO_AVISOS_SEGUIMIENTO: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular la cobertura", cuerpo: "Cada vez que se guarda una gestión nueva en la bitácora." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Sigue habiendo cuentas sin ningún contacto?", cuerpo: "El hallazgo de la etapa 3 del argumento de esta página." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Una disputa lleva más de 30 días abierta?", cuerpo: "El umbral del agente Guardia de este módulo." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Cuánta cobertura hay, sobre quién se concentra, y qué queda pendiente." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_CORREO_VENTAS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Se cierra una venta", cuerpo: "Al registrarse la venta con sus líneas (cantidad × precio)." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Hay un descuadre vendido≠facturado", cuerpo: "Cuando cuadreVentasFacturacion() no cuadra." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿La venta tiene factura asociada?", cuerpo: "Sin ella, la cadena Ventas↔CxC se rompió en ese punto." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿El margen es cero o negativo?", cuerpo: "El umbral del agente Margen de este módulo." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el resumen de la venta", cuerpo: "Cliente, total, margen y factura asociada, tomados de ventasConTotal()." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Avisar a Ventas", cuerpo: "Con el descuadre exacto o la venta sin factura." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Cuando el margen queda en cero o negativo." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c1"], ["c1", "c2"], ["c1", "a1"], ["c2", "s1"], ["a1", "s2"]],
};

const FLUJO_AVISOS_VENTAS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular las ventas", cuerpo: "Cada vez que cambia el dato de esta página." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Hay un descuadre vendido≠facturado?", cuerpo: "El umbral del agente Cuadre: diferencia exacta distinta de cero." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Un cliente concentra ≥35% de lo vendido?", cuerpo: "El umbral del agente Cliente de este módulo." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "El monto exacto del descuadre, o quién concentra lo vendido." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_CORREO_INVENTARIO: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Un producto cruza su stock mínimo", cuerpo: "Cuando existencia ≤ stock_minimo (suma del kardex)." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "Hay una salida sin venta de origen", cuerpo: "Movimiento tipo salida registrado sin id_venta." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿Cuántas unidades faltan?", cuerpo: "stock_minimo − existencia, del producto que cruzó el umbral." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿La salida declara qué venta la produjo?", cuerpo: "El umbral del agente Huérfano de este módulo." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar la alerta de reposición", cuerpo: "SKU, existencia, mínimo y rotación reciente, tomados del kardex." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Avisar a Compras", cuerpo: "Con el SKU y las unidades que faltan para volver al mínimo." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Cuando una salida no declara su venta de origen: posible ajuste sin registrar." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c2"], ["c1", "a1"], ["c2", "s2"], ["a1", "s1"]],
};

const FLUJO_AVISOS_INVENTARIO: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular el inventario", cuerpo: "Cada vez que cambia el kardex de esta página." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Algún producto tiene existencia negativa?", cuerpo: "El umbral del agente Kardex: el kardex no cuadraría." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Cuántos productos están bajo el mínimo?", cuerpo: "El umbral del agente Mínimo de este módulo." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Qué producto y cuántas unidades, tomados del kardex." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_CORREO_FORECAST: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Se recalcula el forecast", cuerpo: "Al cambiar la fecha de corte de esta página." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "La brecha optimista−pesimista crece", cuerpo: "El umbral del agente Brecha: máximo ancho entre escenarios." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿El pesimista excluye saldo disputado?", cuerpo: "El umbral del agente Disputa de este módulo." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿Ya se simuló más de la mitad del cobro base?", cuerpo: "El umbral del agente Meseta: punto de la semana 4." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el resumen del escenario", cuerpo: "Optimista, base y pesimista de la semana, con la etiqueta SIMULACIÓN siempre visible." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Nunca se envía al cliente: es una ilustración del simulacro, no un reclamo real." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_AVISOS_FORECAST: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular el forecast", cuerpo: "Cada vez que cambia la fecha de corte o el dataset." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿Hay saldo disputado que el pesimista no cobra?", cuerpo: "El umbral del agente Disputa de este módulo." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Ya se simuló ≥50% del cobro base en la semana 4?", cuerpo: "El umbral del agente Meseta de este módulo." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Con la etiqueta SIMULACIÓN siempre visible — nunca se presenta como caja real." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

const FLUJO_CORREO_DATOS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 20, tipo: "disparador", titulo: "Se aplica una importación de CSV", cuerpo: "Al confirmar el mapeo de columnas (Paso 2 de esta página)." },
    { id: "d2", x: 20, y: 175, tipo: "disparador", titulo: "El % de filas con problema sube", cuerpo: "Comparado contra la última importación aplicada." },
    { id: "c1", x: 300, y: 98, tipo: "condicion", titulo: "¿La fila tiene fecha de vencimiento?", cuerpo: "El umbral del agente Vencimiento de este módulo." },
    { id: "c2", x: 580, y: 20, tipo: "condicion", titulo: "¿El número de factura está duplicado?", cuerpo: "El umbral del agente Duplicado: mismo cliente, mismo número." },
    { id: "a1", x: 580, y: 195, tipo: "accion", titulo: "Armar el reporte de calidad", cuerpo: "Filas cargadas, descartadas y motivo dominante, tomados del resultado de importación." },
    { id: "s1", x: 840, y: 20, tipo: "salida", titulo: "Pedir la corrección al origen", cuerpo: "Se pide el dato correcto a quien exportó el CSV — nunca se inventa." },
    { id: "s2", x: 840, y: 195, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Con el resumen de calidad del dataset activo." },
  ],
  enlaces: [["d1", "c1"], ["d2", "c1"], ["c1", "c2"], ["c1", "a1"], ["c2", "s1"], ["a1", "s2"]],
};

const FLUJO_AVISOS_DATOS: { nodos: Nodo[]; enlaces: [string, string][] } = {
  nodos: [
    { id: "d1", x: 20, y: 98, tipo: "disparador", titulo: "Al recalcular la calidad del dataset", cuerpo: "Cada vez que se aplica una importación nueva." },
    { id: "c1", x: 300, y: 20, tipo: "condicion", titulo: "¿El % de filas con problema supera el 20%?", cuerpo: "El corte de «usable con reservas» de la conclusión de esta página." },
    { id: "c2", x: 300, y: 175, tipo: "condicion", titulo: "¿Hay clientes en el catálogo sin ninguna factura?", cuerpo: "El umbral del agente Catálogo de este módulo." },
    { id: "a1", x: 580, y: 98, tipo: "accion", titulo: "Redactar el aviso", cuerpo: "Cuántas filas, cuántas con problema, y dónde se concentran." },
    { id: "s1", x: 840, y: 98, tipo: "salida", titulo: "Avisarme a mí", cuerpo: "Sólo a quien mira este tablero. Nada sale de la empresa." },
  ],
  enlaces: [["d1", "c1"], ["d1", "c2"], ["c1", "a1"], ["c2", "a1"], ["a1", "s1"]],
};

/** Qué módulo describe la automatización. `cartera` es el valor por defecto y
 *  deja la página 1 exactamente como estaba. Los seis módulos nuevos entran
 *  con su propio flujo, igual que `aging` ya lo hacía. */
export type ModuloFlujo =
  | "cartera"
  | "aging"
  | "prioritarios"
  | "seguimiento"
  | "ventas"
  | "inventario"
  | "forecast"
  | "datos";

/** Textos de cada ventana, por módulo. `cartera` y `aging` son EXACTAMENTE
 *  los mismos textos que antes tenían los dos ternarios `esAging` — sólo se
 *  cambió DÓNDE viven, no QUÉ dicen, para no alterar `/` ni `/aging`. */
const TEXTOS_MODULO: Record<
  ModuloFlujo,
  {
    bajadaCorreo: string;
    notaCorreo: string;
    tituloAvisos: string;
    bajadaAvisos: string;
    notaAvisos: string;
  }
> = {
  cartera: {
    bajadaCorreo: "Envíos que salen solos cuando el dato cumple una condición. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. Los umbrales son los mismos que usan los agentes de la página, para que un aviso nunca contradiga lo que el tablero muestra.",
    tituloAvisos: "Avisos de esta cartera",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página y cuándo.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes: si el agente encuentra algo, esto avisa. Hoy el flujo está descrito y no ejecuta envíos.",
  },
  aging: {
    bajadaCorreo: "Envíos que salen solos cuando una factura cambia de tramo o se mueve el corte. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. Los tramos y umbrales son los mismos que clasifica esta página, para que un reclamo nunca contradiga el aging que se está mirando.",
    tituloAvisos: "Avisos de este aging",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar el aging cuando cambia el corte.",
    notaAvisos: "Los disparadores son los umbrales del argumento de esta página (tramo dominante 50% del vencido, concentración 35% del vencido). Hoy el flujo está descrito y no ejecuta envíos. 🟡 Umbrales pendientes de validación por Finanzas.",
  },
  prioritarios: {
    bajadaCorreo: "Envíos que saldrían solos cuando una cuenta cambia de urgencia en la worklist. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. El score y sus umbrales son 🟣 simulados, iguales a los que usan los agentes de esta página.",
    tituloAvisos: "Avisos de esta worklist",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página cuando cambia el podio de prioridad.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Balanza y Filtro de este módulo. Hoy el flujo está descrito y no ejecuta envíos.",
  },
  seguimiento: {
    bajadaCorreo: "Envíos que saldrían solos cuando un cliente queda sin gestión o se registra una nueva. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. La bitácora que lo alimenta es 100% local del navegador — nada de esto viaja a un servidor.",
    tituloAvisos: "Avisos de este seguimiento",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página sobre la cobertura de gestión.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Guardia y Bitácora de este módulo. Hoy el flujo está descrito y no ejecuta envíos.",
  },
  ventas: {
    bajadaCorreo: "Envíos que saldrían solos cuando se cierra una venta o aparece un descuadre. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. El cuadre y el margen son los mismos que calculan los agentes de esta página.",
    tituloAvisos: "Avisos de estas ventas",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página sobre el cuadre y el margen.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Cuadre y Cliente de este módulo. Hoy el flujo está descrito y no ejecuta envíos.",
  },
  inventario: {
    bajadaCorreo: "Envíos que saldrían solos cuando un producto cruza su mínimo o aparece una salida huérfana. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. La existencia y el mínimo son los mismos que calculan los agentes de esta página.",
    tituloAvisos: "Avisos de este inventario",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página sobre el kardex.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Kardex y Mínimo de este módulo. Hoy el flujo está descrito y no ejecuta envíos.",
  },
  forecast: {
    bajadaCorreo: "Envíos que saldrían solos cuando cambia el simulacro de cobro. Determinista: reglas fijas, sin IA — y SIEMPRE marcado como simulación.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo, y aunque lo estuviera nunca se enviaría al cliente: ningún número de este módulo es caja real. 🟣 Pendiente de validación por Finanzas.",
    tituloAvisos: "Avisos de este forecast",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página sobre el simulacro.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Disputa y Meseta de este módulo. Hoy el flujo está descrito y no ejecuta envíos. 🟣 Simulación, no dato real.",
  },
  datos: {
    bajadaCorreo: "Envíos que saldrían solos cuando se importa un CSV o empeora la calidad del dataset. Determinista: reglas fijas, sin IA.",
    notaCorreo: "El flujo está definido pero NO conectado a un servicio de correo: hoy describe qué se enviaría, no envía. El archivo nunca sale del navegador — tampoco lo haría este aviso.",
    tituloAvisos: "Avisos de esta calidad de datos",
    bajadaAvisos: "Lo mismo, pero hacia adentro: qué me tiene que avisar esta página sobre el dataset activo.",
    notaAvisos: "Los disparadores son los mismos umbrales de los agentes Vencimiento y Catálogo de este módulo. Hoy el flujo está descrito y no ejecuta envíos.",
  },
};

const FLUJOS_MODULO: Record<
  ModuloFlujo,
  { correo: { nodos: Nodo[]; enlaces: [string, string][] }; avisos: { nodos: Nodo[]; enlaces: [string, string][] } }
> = {
  cartera: { correo: FLUJO_CORREO, avisos: FLUJO_AVISOS },
  aging: { correo: FLUJO_CORREO_AGING, avisos: FLUJO_AVISOS_AGING },
  prioritarios: { correo: FLUJO_CORREO_PRIORITARIOS, avisos: FLUJO_AVISOS_PRIORITARIOS },
  seguimiento: { correo: FLUJO_CORREO_SEGUIMIENTO, avisos: FLUJO_AVISOS_SEGUIMIENTO },
  ventas: { correo: FLUJO_CORREO_VENTAS, avisos: FLUJO_AVISOS_VENTAS },
  inventario: { correo: FLUJO_CORREO_INVENTARIO, avisos: FLUJO_AVISOS_INVENTARIO },
  forecast: { correo: FLUJO_CORREO_FORECAST, avisos: FLUJO_AVISOS_FORECAST },
  datos: { correo: FLUJO_CORREO_DATOS, avisos: FLUJO_AVISOS_DATOS },
};

export function BarraUsuario({
  dataset,
  modulo = "cartera",
}: {
  dataset: Dataset;
  modulo?: ModuloFlujo;
}) {
  const textos = TEXTOS_MODULO[modulo];
  const { correo: flujoCorreo, avisos: flujoAvisos } = FLUJOS_MODULO[modulo];
  const [panel, setPanel] = useState<Panel>(null);
  const clase =
    "grid h-9 w-9 place-items-center rounded-full bg-white/80 text-[13px] text-[#6b6f78] shadow-flotante transition hover:text-tinta";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={() => setPanel("buscar")} title="Buscar y filtrar" aria-label="Buscar y filtrar" className={clase}>
          ⌕
        </button>
        <button
          onClick={() => setPanel("correo")}
          title="Mensajes automáticos"
          aria-label="Mensajes automáticos"
          className={`${clase} relative`}
        >
          ✉
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#c2703a]" />
        </button>
        <button
          onClick={() => setPanel("avisos")}
          title={textos.tituloAvisos}
          aria-label={textos.tituloAvisos}
          className={`${clase} relative`}
        >
          ◔
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#3557d6]" />
        </button>
        <button
          title="Sesión"
          aria-label="Sesión"
          className="grid h-9 w-9 place-items-center rounded-full text-[12px] font-bold text-white shadow-flotante"
          style={{ background: "linear-gradient(150deg,#4a4e57,#20242c)" }}
        >
          JD
        </button>
      </div>

      {panel === "buscar" && (
        <Ventana
          titulo="Buscar y filtrar"
          bajada="Busca sobre los datos cargados en esta vista. Los filtros se acumulan."
          onCerrar={() => setPanel(null)}
        >
          <PanelBuscar dataset={dataset} />
        </Ventana>
      )}

      {panel === "correo" && (
        <Ventana
          titulo="Mensajes automáticos"
          bajada={textos.bajadaCorreo}
          onCerrar={() => setPanel(null)}
        >
          <Lienzo nodos={flujoCorreo.nodos} enlaces={flujoCorreo.enlaces} nota={textos.notaCorreo} />
        </Ventana>
      )}

      {panel === "avisos" && (
        <Ventana titulo={textos.tituloAvisos} bajada={textos.bajadaAvisos} onCerrar={() => setPanel(null)}>
          <Lienzo nodos={flujoAvisos.nodos} enlaces={flujoAvisos.enlaces} nota={textos.notaAvisos} />
        </Ventana>
      )}
    </>
  );
}
