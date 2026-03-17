import type { MetadataRoute } from "next";

const manifest = (): MetadataRoute.Manifest => ({
  name: "AgroOps - Gestión de granja",
  short_name: "AgroOps",
  description: "Dashboard para gestión de tareas e incidentes en granja",
  start_url: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#020617",
  theme_color: "#22c55e",
  lang: "es-ES",
  icons: [
    {
      src: "/icons/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/icons/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
});

export default manifest;

