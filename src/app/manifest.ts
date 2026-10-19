import type { MetadataRoute } from "next";
import { APP_NAME, BRAND_COLORS } from "@/lib/constants";
import { fr } from "@/i18n/fr";

/** Manifeste de l'application web (icônes du kit Pyramide, couleurs nuit et or). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: fr.meta.description,
    lang: "fr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: BRAND_COLORS.nuit,
    theme_color: BRAND_COLORS.nuit,
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
