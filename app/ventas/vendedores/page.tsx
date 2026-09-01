import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaVendedores() {
  return <ModuloPendienteComercial titulo="Vendedores" descripcion="El dashboard comparará rendimiento, cartera y continuidad comercial por vendedor." agentes={["Venta acumulada", "Cumplimiento de meta", "Clientes activos", "Recurrencia y cobertura"]} fuente="Responsable comercial en venta confirmada, metas por período y cartera asignada por vendedor." />;
}
