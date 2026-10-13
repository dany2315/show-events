import type { NextConfig } from "next";

// Fundraising Live est une application entièrement dynamique (sessions, temps réel,
// langue FR/HE lue depuis un cookie pour `lang`/`dir`). On reste donc sur le modèle
// de rendu classique (sans Cache Components / Partial Prefetching).
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "@neondatabase/serverless"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
