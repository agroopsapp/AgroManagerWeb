import { redirect } from "next/navigation";

/** Ruta antigua; `next.config.js` también redirige. Este archivo evita rutas rotas si queda cache antigua. */
export default function PartesMultidiaLegacyRedirectPage() {
  redirect("/dashboard/time-tracking/partes-de-obra");
}
