import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* "/" for self-hosting or a custom domain; the GitHub Actions
   workflow sets BASE_PATH="/<repo>/" for project Pages hosting. */
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      /* injectManifest: we ship our own src/sw.js (precache + Web Push
         handlers) instead of the generated worker */
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "LifeEngine",
        short_name: "LifeEngine",
        description: "Gamified motivation HUD with AI mentors",
        theme_color: "#F5F2EA",
        background_color: "#F5F2EA",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"]
      }
    })
  ]
});
