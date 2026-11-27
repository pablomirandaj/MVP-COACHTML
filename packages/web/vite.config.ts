import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@fcs/engine": src("../engine/src/index.ts"),
      "@fcs/render": src("../render/src/index.ts"),
      "@fcs/assistant": src("../assistant/src/index.ts"),
    },
  },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
  build: mode === "artifact"
    // Página de Claude: un único script clásico (sin módulos ni trozos) que se incrusta en el HTML.
    ? { outDir: "dist-artifact", emptyOutDir: true, sourcemap: false, cssCodeSplit: false, assetsInlineLimit: 100_000_000, modulePreload: false,
        rollupOptions: { input: src("artifact.html"), output: { format: "iife", inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "[name][extname]" } } }
    : { outDir: "dist", sourcemap: true },
}));
