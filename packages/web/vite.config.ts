import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fcs/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
      "@fcs/render": fileURLToPath(new URL("../render/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { outDir: "dist", sourcemap: true },
});
