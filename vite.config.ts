import { defineConfig } from "vite";
import Icons from "unplugin-icons/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    Icons({ compiler: "raw" }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "note",
        short_name: "note",
        description: "Лёгкий офлайн-блокнот",
        lang: "ru",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0e0e10",
        theme_color: "#0e0e10",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        navigateFallback: "index.html"
      }
    })
  ],
  build: {
    target: "es2022",
    cssMinify: true,
    modulePreload: { polyfill: false }
  }
});
