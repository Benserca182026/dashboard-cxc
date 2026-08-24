import type { Metadata } from "next";
import "./globals.css";
import { ProveedorApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { AvisoPreliminar } from "@/components/AvisoPreliminar";
import { fuenteReferencia } from "@/lib/fuente";

export const metadata: Metadata = {
  title: "Dashboard CxC — Prototipo (datos ficticios)",
  description:
    "Prototipo de dashboard de cuentas por cobrar con datos 100% ficticios. Fórmulas pendientes de validación por Finanzas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${fuenteReferencia.variable} piel-referencia`}>
        <ProveedorApp>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
              <div className="mx-auto max-w-6xl space-y-5">
                <AvisoPreliminar />
                {children}
              </div>
            </main>
          </div>
        </ProveedorApp>
      </body>
    </html>
  );
}
