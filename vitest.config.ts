import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@fcs/engine": fileURLToPath(new URL("./packages/engine/src/index.ts", import.meta.url)),
      "@fcs/render": fileURLToPath(new URL("./packages/render/src/index.ts", import.meta.url)),
    },
  },
  test: { include: ["packages/*/test/**/*.test.ts"] },
});
