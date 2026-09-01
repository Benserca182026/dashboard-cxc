import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaEmpresaRegion() {
  return <ModuloPendienteComercial titulo="Empresa y región" descripcion="El dashboard comparará operación comercial entre empresas y regiones." agentes={["Ventas", "Crecimiento", "Concentración", "Cumplimiento de meta"]} fuente="Empresa y región normalizadas en ventas confirmadas, más metas comparables por período." />;
}
