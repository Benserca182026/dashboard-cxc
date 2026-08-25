import type { Metadata } from "next";
import "./globals.css";
import { ProveedorApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { AvisoPreliminar } from "@/components/AvisoPreliminar";
import { fuenteReferencia } from "@/lib/fuente";
import { ProveedorDecisionV2 } from "@/lib/decision-v2-client";

export const metadata: Metadata = {
  title: "EDGE Helmets — Centro de decisiones V2",
  description:
    "Dashboard ejecutivo de ventas, cartera, inventario, clientes y acciones con trazabilidad a Odoo.",
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
          <ProveedorDecisionV2>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-5">
                  <AvisoPreliminar />
                  {children}
                </div>
              </main>
            </div>
          </ProveedorDecisionV2>
        </ProveedorApp>
      </body>
    </html>
  );
}
