import { defineConfig } from "@qmuse/vite-config";
// The QMuse preset supplies Vite 8's native TS paths, React, Router and Tailwind.
// Keep optimizer caches isolated from other Git worktrees sharing node_modules.
export default defineConfig({
  base: "./",
  cacheDir: "artifacts/cache/vite",
  build: {
    target: "es2022",
    rollupOptions: { output: { chunkFileNames: "assets/[name].[hash].js" } },
  },
  server: { host: "0.0.0.0", port: 5178, strictPort: true },
});
