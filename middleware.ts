import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Puerta de acceso al dashboard. Ver docs/seguridad-diseno-autenticacion.md §5.
//
// NACE APAGADO, A PROPÓSITO. Sin la variable de entorno CXC_AUTH_ACTIVA=1 este
// middleware deja pasar absolutamente todo, igual que si no existiera. Está así
// por dos razones, y las dos son temporales:
//
//   1. Hoy no hay usuarios creados. Si esto redirigiera a /login sin que exista
//      nadie que pueda pasar el login, el dashboard quedaría inaccesible para
//      todos en vez de accesible para todos — que es cambiar un defecto por
//      otro, no arreglarlo.
//   2. Hay otros frentes trabajando en este repositorio. Un middleware activo
//      les redirige cada ruta mientras desarrollan.
//
// Se enciende con CXC_AUTH_ACTIVA=1 después de los pasos 1-5 del orden de
// ejecución del documento (rotar clave, cerrar auto-registro, aplicar RLS por
// rol, crear usuarios, reemplazar app/login).
//
// HONESTIDAD SOBRE LO QUE ESTE ARCHIVO NO HACE: un middleware protege RUTAS DE
// LA APLICACIÓN. No protege la BASE DE DATOS. Mientras la clave publishable
// autorice lectura y escritura a `anon`, cualquiera hablará con Supabase por
// REST sin pasar jamás por Next.js. Encender esto sin haber cerrado RLS produce
// la apariencia de seguridad y ninguna seguridad. El arreglo real es el §4 del
// documento; esto es el complemento, nunca el sustituto.
// ---------------------------------------------------------------------------

const PROTECCION_ACTIVA = process.env.CXC_AUTH_ACTIVA === "1";

/** Rutas que deben responder aunque no haya sesión. */
const PUBLICAS = ["/login", "/api/auth"];

export function middleware(req: NextRequest) {
  if (!PROTECCION_ACTIVA) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const esPublica = PUBLICAS.some((r) => pathname.startsWith(r));

  // Supabase deja la sesión en una cookie cuyo nombre incluye la referencia del
  // proyecto (sb-<ref>-auth-token). Se busca por forma y no por nombre fijo
  // para que rotar el proyecto no rompa la puerta.
  const tieneSesion = req.cookies
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0);

  if (!tieneSesion && !esPublica) {
    const destino = new URL("/login", req.url);
    // Para volver a donde el usuario quería ir, después de identificarse.
    destino.searchParams.set("volver", pathname);
    return NextResponse.redirect(destino);
  }

  if (tieneSesion && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
