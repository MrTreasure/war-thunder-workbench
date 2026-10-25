import { miniappManifest } from "@heybox/hb-sdk/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react(), miniappManifest()],
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
