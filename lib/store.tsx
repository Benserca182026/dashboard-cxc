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
  const [gestiones, setGestiones] = useState<GestionCobranza[]>(gestionesSemilla);

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
        setGestiones([...gestionesSemilla, ...guardadas]);
      }
    } catch {
      // localStorage corrupto/inaccesible: se sigue con la semilla.
    }
  }, []);

  const agregarGestion = useCallback((g: GestionCobranza) => {
    setGestiones((prev) => {
      const nuevas = [...prev, g];
      try {
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
