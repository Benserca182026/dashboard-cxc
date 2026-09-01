import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaComisiones() {
  return <ModuloPendienteComercial titulo="Comisiones comerciales" descripcion="El dashboard explicará venta comisionable, avance contra meta y excepciones." agentes={["Venta comisionable", "Avance contra meta", "Comisión estimada", "Excepciones"]} fuente="Regla de comisión aprobada, vendedor responsable, meta, moneda y ventas confirmadas elegibles." />;
}
