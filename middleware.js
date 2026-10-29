// Acceso con usuario y clave a todo el sitio (incluidos los datos de /data).
// La clave NO va en el código: se configura en Vercel → Settings → Environment Variables:
//   OBSERVATORIO_USUARIO  (por ejemplo: uom)
//   OBSERVATORIO_CLAVE    (la clave que elijas)
// Si OBSERVATORIO_CLAVE no está configurada, el sitio queda abierto como hasta ahora.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const clave = process.env.OBSERVATORIO_CLAVE;
  if (!clave) return; // sin clave configurada: acceso libre
  const usuario = process.env.OBSERVATORIO_USUARIO || "uom";
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const [u, ...resto] = atob(auth.slice(6)).split(":");
      if (u === usuario && resto.join(":") === clave) return; // acceso concedido
    } catch { /* credenciales mal formadas: se vuelve a pedir */ }
  }
  return new Response("Acceso restringido. Ingresá el usuario y la clave del Observatorio Metalúrgico.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Observatorio Metalurgico", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" }
  });
}
