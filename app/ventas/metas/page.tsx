import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaMetas() {
  return <ModuloPendienteComercial titulo="Metas comerciales" descripcion="El dashboard medirá avance, proyección y desviaciones sin convertir proyecciones en hechos." agentes={["Meta acumulada", "Avance actual", "Proyección", "Desviación y alertas"]} fuente="Metas aprobadas por vendedor, empresa, región y período; reglas de prorrateo y calendario comercial." />;
}
