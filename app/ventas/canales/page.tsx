import { redirect } from "next/navigation";

/** Los canales se ocultan hasta que Odoo entregue la dimensión Canal.
 * No se conserva una clasificación local que pudiera parecer un hecho. */
export default function PaginaCanalesVentas() {
  redirect("/ventas");
}
