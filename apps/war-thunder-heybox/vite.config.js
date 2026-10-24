import { miniappManifest } from "@heybox/hb-sdk/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react(), miniappManifest()],
});
