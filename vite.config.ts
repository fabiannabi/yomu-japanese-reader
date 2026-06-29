import { defineConfig } from "vite";

// `base` se ajustará en la Fase 6 para GitHub Pages (p. ej. "/yomu/").
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    open: true,
  },
});
