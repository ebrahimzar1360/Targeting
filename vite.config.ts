/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import pkg from "./package.json" with { type: "json" };

// `--mode artifact` builds the claude.ai version: one self-contained page (all code, styles and
// fonts inlined, see scripts/make-artifact.mjs), no service worker, no Claude API client.
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  return {
  // Relative base: the build works on GitHub Pages under any repo name, or from any folder.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: artifact
    ? {
        outDir: "dist-artifact",
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        cssCodeSplit: false,
        modulePreload: false,
        chunkSizeWarningLimit: 4000,
        rolldownOptions: { output: { codeSplitting: false } },
      }
    : // The Excel module is large but loaded only on import/export.
      { chunkSizeWarningLimit: 1000 },
  resolve: {
    alias: {
      "@": src("./src"),
      ...(artifact ? { "@anthropic-ai/sdk/helpers/beta/zod": src("./src/platform/sdk-stub.ts"), "@anthropic-ai/sdk": src("./src/platform/sdk-stub.ts") } : {}),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: artifact,
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
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
