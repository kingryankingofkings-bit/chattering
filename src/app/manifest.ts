import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chattering",
    short_name: "Chattering",
    description: "Private adults-only AI companions, roleplay, stories, comics and art.",
    start_url: "/explore",
    display: "standalone",
    background_color: "#0a0710",
    theme_color: "#0a0710",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
