import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// `base` se ajusta en CI para GitHub Pages vía BASE_PATH (p. ej. "/yomu/").
// En local queda en "/" para no alterar la URL del dev server.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "icon.svg",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],
      manifest: {
        name: "読む — Yomu",
        short_name: "Yomu",
        description: "Tutor de lectura de japonés: lee, resalta y memoriza.",
        lang: "es",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#faf8f3",
        theme_color: "#faf8f3",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // Precachea solo el shell de la app + el seed; NO el diccionario kuromoji (96 MB).
        globPatterns: ["**/*.{js,css,html,svg,json}"],
        globIgnores: ["**/dict/**"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`.replace(/\/{2,}/g, "/"),
        runtimeCaching: [
          {
            // Diccionario IPADIC de kuromoji: se cachea al primer uso (offline luego).
            urlPattern: /\/dict\/.*\.dat$/,
            handler: "CacheFirst",
            options: {
              cacheName: "kuromoji-dict",
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Motor y datos de idioma de Tesseract.js (OCR), servidos por CDN.
            urlPattern:
              /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "tesseract",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // El SW no se activa en dev para no interferir con el localhost que miras.
      devOptions: { enabled: false },
    }),
  ],
});
