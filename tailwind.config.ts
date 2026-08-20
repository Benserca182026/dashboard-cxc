import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta heredada — se conserva para no romper pantallas existentes.
        fondo: "#f4f5f7",
        tarjeta: "#ffffff",
        borde: "#e4e6ea",
        tinta: "#16181d",
        tintaSuave: "#6b7280",
        acento: "#0f6f66",
        acentoSuave: "#e6f2f0",
        alerta: "#b45309",
        critico: "#b91c1c",
        simulado: "#7c3aed",
        // Estilo de referencia (CRM Customer Journey, RonDesignLab).
        etapa: "#8b93a7",
        conector: "#c9cede",
      },
      borderRadius: { tarjeta: "22px", pastilla: "999px" },
      boxShadow: {
        flotante: "0 2px 4px rgba(22,24,29,.03), 0 12px 32px rgba(22,24,29,.07)",
        flotanteAlta: "0 4px 8px rgba(22,24,29,.05), 0 20px 48px rgba(22,24,29,.12)",
      },
    },
  },
  plugins: [],
};

export default config;
