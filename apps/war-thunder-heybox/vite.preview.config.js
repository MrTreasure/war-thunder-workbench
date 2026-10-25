import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "../",
  resolve: {
    alias: [
      {
        find: /^@heybox\/hb-sdk$/,
        replacement: fileURLToPath(new URL("./preview/browser-sdk.ts", import.meta.url)),
      },
    ],
  },
  oxc: { jsx: { refresh: false } },
  plugins: [
    {
      name: "static-acceptance-entry",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html
            .replace("/src/main.tsx", "/preview/main.ts")
            .replace(
              "<title>战雷工作台</title>",
              '<meta name="robots" content="noindex,nofollow"/><title>小程序界面预览 · 战雷工作台</title>',
            );
        },
      },
    },
  ],
  build: {
    outDir: "../../artifacts/heybox-static-preview/site",
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      output: {
        assetFileNames: "assets/heybox-[hash][extname]",
        entryFileNames: "assets/heybox-[name]-[hash].js",
        chunkFileNames: "assets/heybox-[name]-[hash].js",
      },
    },
  },
});
