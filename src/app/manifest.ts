import type { MetadataRoute } from "next";

const manifest = (): MetadataRoute.Manifest => ({
  name: "AgroOps - Gestión de granja",
  short_name: "AgroOps",
  description: "Dashboard para gestión de tareas e incidentes en granja",
  start_url: "/",
  display: "fullscreen",
  orientation: "portrait",
  background_color: "#020617",
  theme_color: "#22c55e",
  lang: "es-ES",
});

export default manifest;

