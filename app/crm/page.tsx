import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaCRM() {
  return <ModuloPendienteComercial titulo="CRM comercial" descripcion="La ficha unirá historial, frecuencia, productos y oportunidad para cada cliente." agentes={["Historial comercial", "Frecuencia", "Productos comprados", "Oportunidad y riesgo"]} fuente="Actividades CRM, responsable, etapa, fecha de próximo contacto y vínculo con cliente y pedidos." />;
}
