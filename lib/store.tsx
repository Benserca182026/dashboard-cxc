"use client";

// Estado global del prototipo: dataset activo (demo o CSV importado), fecha de
// corte compartida entre módulos, y gestiones de cobranza (persistidas SOLO en
// localStorage del navegador — sin base de datos, sin APIs externas).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Dataset,
  GestionCobranza,
  Moneda,
  MotivoSinTipoCambio,
  TipoCambio,
} from "./types";
import { Cifra } from "./types";
import { fmtMoneda } from "./calculos";
import { datosDemo, FECHA_CORTE_DEFAULT, gestionesSemilla } from "./datos";
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "./datosReales";
import { TIPO_CAMBIO_REFERENCIA } from "./tipo-cambio";

const CLAVE_GESTIONES = "cxc-prototipo-gestiones-ficticias";

// ── MONEDA: el quetzal es el hecho, el dólar es una vista ───────────────────
//
// DEPENDE DE (R7): que el Frente 1 confirme en docs/hallazgos-odoo-en-vivo.md
// si el export de Odoo puede entregar un tipo de cambio con FUENTE y FECHA
// (res.currency.rate del propio Odoo, o la tasa de referencia del Banguat).
//
// LAS DOS SALIDAS ESTÁN CONSTRUIDAS, y cuál rige lo decide este único valor:
//
//   · NULL  (hoy)  → el control de moneda se muestra DESHABILITADO y explica
//                    qué falta. La vista en dólares es inalcanzable: no hay
//                    forma de llegar a ella desde la interfaz.
//   · una tasa     → el control se habilita solo, y mientras la vista en
//                    dólares esté activa la pantalla muestra valor, fuente y
//                    fecha de la tasa usada.
//
// HABILITACIÓN TEMPORAL PARA ESTA COPIA LOCAL: se usa el tipo de cambio de
// referencia vigente publicado por el Banco de Guatemala. La fecha y la
// fuente quedan visibles en pantalla mientras la vista USD esté activa.
//
// PROHIBIDO poner acá una tasa "razonable" de memoria (7.7, 7.8, la que sea).
// Una tasa sin fuente y sin fecha convierte montos reales con un número
// inventado — que es el bug original de este proyecto (quetzales rotulados
// como dólares) disfrazado de mejora.
const TIPO_CAMBIO: TipoCambio | null = TIPO_CAMBIO_REFERENCIA;

// RAMA R7 — RESUELTA el 2026-08-24 por el Frente 1, y resolvió hacia ESTA
// salida: docs/hallazgos-odoo-en-vivo.md, sección «2. ¿Hay tipo de cambio
// GTQ/USD?» → «NO en disco. Y para CxC no hace falta.»
//
//   · En las 3.207 facturas del export de account.move, "Total firmado" y
//     "Total en divisa firmado" son IDÉNTICOS fila por fila: la cartera entera
//     está en una sola moneda y no hay ninguna conversión en juego para CxC.
//   · Ninguna tasa aparece en ningún archivo en disco. `res.currency` nunca se
//     leyó, así que ni siquiera consta si Odoo tiene USD configurado.
//   · Queda una contradicción DECLARADA y sin resolver: el lado ventas muestra
//     indicios de dos símbolos de moneda, mientras que el lado facturas es
//     monomoneda. Sólo Odoo vivo la desempata.
//
// La otra salida (control habilitado) está construida y probada igual: vive en
// components/ControlMoneda.tsx y se enciende sola en cuanto este valor deje de
// ser null. Que hoy no haga falta para CxC no la vuelve inútil — la vuelve no
// urgente.
const MOTIVO_SIN_TIPO_CAMBIO: MotivoSinTipoCambio = {
  queFalta:
    "Un tipo de cambio con valor, fuente y fecha. El Frente 1 lo buscó el 2026-08-24 y no existe: ninguna tasa aparece en ningún archivo en disco, y res.currency nunca se leyó, así que ni siquiera consta si Odoo tiene el dólar configurado.",
  consecuencia:
    "Sin tasa no hay conversión posible. Se deja la opción deshabilitada en vez de convertir con un número de memoria: un monto real dividido por una tasa inventada se ve exactamente igual que uno correcto, y ése es el primer bug que tuvo este proyecto. Para CxC además no se pierde nada: en las 3.207 facturas el importe en divisa y el de compañía son idénticos fila por fila, o sea que la cartera ya está entera en una sola moneda.",
  comoSeLlena:
    "Pidiendo res.currency y res.currency.rate a Odoo vivo con search_read (la máquina para hacerlo está descrita en el boletín) y declarando el resultado en TIPO_CAMBIO, en lib/store.tsx. Hace falta antes para ventas que para CxC: ahí el export muestra dos símbolos de moneda distintos y esa contradicción sigue abierta.",
};

/** La moneda en que están los HECHOS de este dataset.
 *
 *  No es una preferencia: es lo que dice el origen. El dataset real de Odoo
 *  (Benserca 18) está en quetzales; el demo ficticio está denominado en
 *  dólares. Por eso sobre el demo no hay conversión que ofrecer — ya está en
 *  la moneda de destino, y convertirlo a sí mismo no es una vista, es ruido. */
const monedaDeRegistro = (d: Dataset): Moneda => (d.fuente === "odoo-real" ? "GTQ" : "USD");

interface EstadoApp {
  dataset: Dataset;
  cargando: boolean;
  /** Si la carga real de Odoo/Supabase falló, el motivo — el dataset ya cayó a demo-ficticio. */
  errorDatosReales: string | null;
  fechaCorte: string;
  setFechaCorte: (f: string) => void;
  /** La moneda de los hechos de este dataset. No se elige: la dicta el origen. */
  monedaRegistro: Moneda;
  /** La moneda que se está PINTANDO. Arranca y vuelve siempre a la de registro. */
  monedaVista: Moneda;
  /** Pedir una vista. Pedir "USD" sin tasa declarada NO hace nada. */
  setMonedaVista: (m: Moneda) => void;
  /** La tasa en uso, o null. Cuando la vista es en dólares, va a pantalla. */
  tipoCambio: TipoCambio | null;
  /** Si no se puede ver en dólares, POR QUÉ. */
  motivoSinTipoCambio: MotivoSinTipoCambio;
  /** ¿Está disponible la vista derivada? */
  puedeVerEnDolares: boolean;
  /**
   * EL ÚNICO formateador de dinero de la aplicación.
   *
   * Recibe SIEMPRE un monto en la moneda de registro —todo se calcula ahí— y
   * convierte, si corresponde, únicamente al pintar. Ningún cálculo, umbral,
   * tolerancia ni comparación pasa por acá: esta función es el último paso
   * antes del pixel.
   */
  fmt: (montoEnMonedaDeRegistro: number) => string;
  reemplazarDataset: (d: Dataset) => void;
  volverADemo: () => void;
  gestiones: GestionCobranza[];
  agregarGestion: (g: GestionCobranza) => void;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorApp({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(datosDemo);
  const [cargando, setCargando] = useState(true);
  const [errorDatosReales, setErrorDatosReales] = useState<string | null>(null);
  const [fechaCorte, setFechaCorte] = useState(FECHA_CORTE_DEFAULT);
  // Lo que el usuario PIDIÓ ver. Lo que se ve de verdad se deriva más abajo:
  // así el quetzal no depende de que nadie se acuerde de reponerlo.
  const [monedaPedida, setMonedaPedida] = useState<Moneda>("GTQ");
  // Sólo las gestiones que registró el usuario. La semilla de demo NO vive
  // acá: se agrega derivada más abajo, y sólo cuando corresponde. Ver el
  // comentario de `gestiones`.
  const [gestionesUsuario, setGestionesUsuario] = useState<GestionCobranza[]>([]);

  // Carga inicial: datos REALES de Benserca 18 desde Supabase. Si falla (sin
  // red, Supabase caído, etc.) se queda en el dataset demo-ficticio y se
  // declara el error — nunca se muestra un dataset real a medias ni se
  // inventa una carga exitosa.
  useEffect(() => {
    let vigente = true;
    cargarDatasetReal()
      .then((real) => {
        if (!vigente) return;
        setDataset(real);
        setFechaCorte(FECHA_CORTE_DATOS_REALES);
        setCargando(false);
      })
      .catch((e) => {
        if (!vigente) return;
        setErrorDatosReales(e instanceof Error ? e.message : "No se pudo cargar el dataset real.");
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Gestiones agregadas por el usuario: persistencia local únicamente.
  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE_GESTIONES);
      if (crudo) {
        const guardadas = JSON.parse(crudo) as GestionCobranza[];
        // Sin re-inyectar la semilla: acá sólo entra lo que grabó el usuario.
        setGestionesUsuario(guardadas);
      }
    } catch {
      // localStorage corrupto/inaccesible: se sigue sin gestiones guardadas.
    }
  }, []);

  // La semilla de demo (lib/datos.ts) apunta a CLI-004 y CLI-002, clientes que
  // SÓLO existen en el dataset demo-ficticio. Sobre el dataset real de Odoo
  // esos ids no resuelven a ningún cliente de los 372, y la Bitácora terminaba
  // mostrando "CLI-004" como si fuera el nombre de un cliente, con el KPI "más
  // gestionado" señalando a ese fantasma.
  //
  // Se resuelve DERIVANDO la lista en vez de inicializar el estado con la
  // semilla. Así es correcto en los dos momentos que importan, sin depender
  // del orden de carga: en el primer render el dataset todavía es el demo (y
  // la semilla es verdadera ahí), y cuando el useEffect asíncrono trae el
  // dataset real la semilla desaparece sola, sin ningún paso de limpieza que
  // pudiera olvidarse.
  //
  // La condición es POSITIVA (`=== "demo-ficticio"`) y no la negación de
  // "odoo-real" a propósito: un dataset "csv-importado" tampoco contiene
  // CLI-002 ni CLI-004, así que sufre exactamente el mismo defecto. Sólo el
  // dataset que trae esos clientes muestra gestiones sobre esos clientes.
  const gestiones = useMemo(
    () =>
      dataset.fuente === "demo-ficticio"
        ? [...gestionesSemilla, ...gestionesUsuario]
        : gestionesUsuario,
    [dataset.fuente, gestionesUsuario]
  );

  const agregarGestion = useCallback((g: GestionCobranza) => {
    setGestionesUsuario((prev) => {
      const nuevas = [...prev, g];
      try {
        // El filtro se conserva por defensa: si alguna vez entrara una fila
        // marcada "sistema_demo", no debe llegar a localStorage.
        const soloUsuario = nuevas.filter((x) => x.creado_por !== "sistema_demo");
        window.localStorage.setItem(CLAVE_GESTIONES, JSON.stringify(soloUsuario));
      } catch {
        // sin persistencia disponible: la gestión vive solo en memoria.
      }
      return nuevas;
    });
  }, []);

  // ── La vista de moneda, derivada — nunca un estado que pueda quedar mal ──
  const monedaRegistro = monedaDeRegistro(dataset);
  const puedeVerEnDolares = monedaRegistro === "GTQ" && TIPO_CAMBIO !== null;
  // EL QUETZAL ES EL PREDETERMINADO SIEMPRE, y esta línea es la que lo
  // garantiza: la vista en dólares exige que se la haya pedido Y que sea
  // posible. Si la tasa desaparece, o si se carga un dataset que ya está en
  // dólares, la vista vuelve sola a la moneda de registro. No hay ningún
  // useEffect de limpieza que pudiera olvidarse ni orden de carga que importe.
  const monedaVista: Moneda = monedaPedida === "USD" && puedeVerEnDolares ? "USD" : monedaRegistro;

  const setMonedaVista = useCallback((m: Moneda) => {
    // Pedir dólares sin tasa no hace nada. La opción además se pinta
    // deshabilitada, así que esto es el segundo cerrojo, no el primero.
    if (m === "USD" && TIPO_CAMBIO === null) return;
    setMonedaPedida(m);
  }, []);

  const fmt = useCallback(
    (monto: number) => {
      if (monedaVista === monedaRegistro || TIPO_CAMBIO === null) {
        return fmtMoneda(monto, monedaRegistro);
      }
      // Capa "conversion": el número deja de ser un hecho y pasa a ser una
      // lectura. `Cifra.enDolares` es la única puerta, y exige la tasa entera.
      return fmtMoneda(Cifra.enDolares(monto, TIPO_CAMBIO).valorParaMostrar(), "USD");
    },
    [monedaVista, monedaRegistro]
  );

  const reemplazarDataset = useCallback((d: Dataset) => setDataset(d), []);
  const volverADemo = useCallback(() => setDataset(datosDemo), []);

  const valor = useMemo(
    () => ({
      dataset,
      cargando,
      errorDatosReales,
      fechaCorte,
      setFechaCorte,
      monedaRegistro,
      monedaVista,
      setMonedaVista,
      tipoCambio: TIPO_CAMBIO,
      motivoSinTipoCambio: MOTIVO_SIN_TIPO_CAMBIO,
      puedeVerEnDolares,
      fmt,
      reemplazarDataset,
      volverADemo,
      gestiones,
      agregarGestion,
    }),
    [
      dataset,
      cargando,
      errorDatosReales,
      fechaCorte,
      monedaRegistro,
      monedaVista,
      setMonedaVista,
      puedeVerEnDolares,
      fmt,
      reemplazarDataset,
      volverADemo,
      gestiones,
      agregarGestion,
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): EstadoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useApp debe usarse dentro de <ProveedorApp>");
  return ctx;
}
