// La tipografía de la referencia (RonDesignLab) es una sans redondeada de las
// comerciales — tipo Gilroy/Circular — que no se puede usar sin licencia.
// Plus Jakarta Sans es la equivalente libre más cercana: misma "a" de un piso,
// mismas terminaciones redondeadas, misma sensación cálida en los pesos altos.
//
// Se declara acá y NO en el layout a propósito: por ahora se aplica a un solo
// bloque, para poder compararlo contra el resto de la página sin comprometer
// toda la app a un cambio que todavía no se decidió.
import { Plus_Jakarta_Sans } from "next/font/google";

export const fuenteReferencia = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--fuente-referencia",
  display: "swap",
});
