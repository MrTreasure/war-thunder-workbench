import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

/** Content identity stays stable across identical builds, including platform rebuilds. */
export function appUpdateBuildPlugin(root = process.cwd()) {
  const hash = createHash("sha256");
  function add(file) {
    hash.update(relative(root, file)).update("\0").update(readFileSync(file)).update("\0");
  }
  function visit(path) {
    for (const item of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = resolve(path, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) add(file);
    }
  }
  for (const name of ["src", "public"]) visit(resolve(root, name));
  // Canonical root JSON only. Never traverse data/generated or evidence folders.
  for (const item of readdirSync(resolve(root, "data"), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  ))
    if (item.isFile() && item.name.endsWith(".json")) add(resolve(root, "data", item.name));
  for (const item of readdirSync(resolve(root, "scripts"), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  ))
    if (item.isFile() && /^(?:build-|prepare-).+\.(?:mjs|py)$/.test(item.name))
      add(resolve(root, "scripts", item.name));
  for (const name of [
    "index.html",
    "package.json",
    "pnpm-lock.yaml",
    "vite.config.ts",
    "tsconfig.json",
    "scripts/check-build.mjs",
    "scripts/app-update-build.mjs",
  ])
    add(resolve(root, name));
  // Target-specific configuration can change behavior even with identical sources.
  for (const key of Object.keys(process.env)
    .filter((key) => key.startsWith("VITE_WT_") || key === "WT_DEPLOY_TARGET")
    .sort())
    hash.update(key).update(process.env[key] || "");
  const buildId = hash.digest("hex").slice(0, 24);
  return {
    name: "wt-app-update-build",
    config() {
      return { define: { __WT_BUILD_ID__: JSON.stringify(buildId) } };
    },
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "wt-build-id", content: buildId }, injectTo: "head" }];
    },
  };
}
