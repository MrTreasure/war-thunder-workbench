import { defineConfig } from "@qmuse/vite-config";
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  server: { host: "0.0.0.0", port: 5178, strictPort: true },
});
