/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  // Relative base: the build works on GitHub Pages under any repo name, or from any folder.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The Excel module is large but loaded only on import/export.
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "هدف‌نگار — هدف‌گذاری به روش ماتریس ساختار طراحی",
        short_name: "هدف‌نگار",
        description: "از چشم‌انداز تا اقدام: ماتریس الزامات، برنامه عملیاتی، KPI، بودجه و بازبینی هفتگی",
        lang: "fa",
        dir: "rtl",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f6f6f4",
        theme_color: "#2a78d6",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: { environment: "node" },
});
