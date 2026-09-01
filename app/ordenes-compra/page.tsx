import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaOrdenesCompra() {
  return <ModuloPendienteComercial titulo="Órdenes de compra" descripcion="La recomendación de compra conectará demanda observada con disponibilidad y rotación." agentes={["Demanda observada", "Quiebres y riesgo", "Rotación", "Sugerencia de compra"]} fuente="Órdenes de compra, existencias, movimientos de inventario y política de reposición por SKU." />;
}
