import { miniappManifest } from "@heybox/hb-sdk/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [miniappManifest()],
  // Vite 8 compiles automatic JSX from tsconfig without a React refresh plugin.
  // The SDK restores gated scripts after its handshake; no refresh globals are needed.
  oxc: { jsx: { refresh: false } },
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: "assets/[hash][extname]",
        chunkFileNames: (chunk) =>
          chunk.name.startsWith("country-")
            ? `assets/${chunk.name.split(".")[0].replace("country-", "c-")}-[hash].js`
            : chunk.name.startsWith("vehicle-facts-")
              ? `assets/${chunk.name.split(".")[0].replace("vehicle-facts-", "v-")}-[hash].js`
              : "assets/[name]-[hash].js",
      },
    },
  },
});
