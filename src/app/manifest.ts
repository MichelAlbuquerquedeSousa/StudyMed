import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "StudyMed — Planner da faculdade",
    short_name: "StudyMed",
    description: "Planner acadêmico pessoal para a rotina da faculdade de Medicina.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbf8fa",
    theme_color: "#fbf8fa",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/calendario", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tarefas", url: "/tarefas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Provas", url: "/provas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
