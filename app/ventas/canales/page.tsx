import { ModuloPendienteComercial } from "@/components/commercial/ModuloPendienteComercial";

export default function PaginaCanalesVentas() {
  return <ModuloPendienteComercial titulo="Canales y tipo de cliente" descripcion="El futuro dashboard mostrará el mix entre retail, ecommerce, canal tradicional y tienda grande." agentes={["Participación por canal", "Crecimiento por canal", "Ticket por canal", "Riesgo y concentración"]} fuente="Dimensión Canal/Tipo de cliente en ventas confirmadas de Odoo, con fecha, total confirmado e identificador de pedido." />;
}
