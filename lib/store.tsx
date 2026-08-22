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
import type { Dataset, GestionCobranza } from "./types";
import { datosDemo, FECHA_CORTE_DEFAULT, gestionesSemilla } from "./datos";
import { cargarDatasetReal } from "./datosReales";

const CLAVE_GESTIONES = "cxc-prototipo-gestiones-ficticias";

interface EstadoApp {
  dataset: Dataset;
  cargando: boolean;
  /** Si la carga real de Odoo/Supabase falló, el motivo — el dataset ya cayó a demo-ficticio. */
  errorDatosReales: string | null;
  fechaCorte: string;
  setFechaCorte: (f: string) => void;
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
        setFechaCorte(new Date().toISOString().slice(0, 10));
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

  const reemplazarDataset = useCallback((d: Dataset) => setDataset(d), []);
  const volverADemo = useCallback(() => setDataset(datosDemo), []);

  const valor = useMemo(
    () => ({
      dataset,
      cargando,
      errorDatosReales,
      fechaCorte,
      setFechaCorte,
      reemplazarDataset,
      volverADemo,
      gestiones,
      agregarGestion,
    }),
    [dataset, cargando, errorDatosReales, fechaCorte, reemplazarDataset, volverADemo, gestiones, agregarGestion]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): EstadoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useApp debe usarse dentro de <ProveedorApp>");
  return ctx;
}
