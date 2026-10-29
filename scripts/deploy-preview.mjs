/** Render preview is separate from the independent wt production Worker. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--dry-run"))
  throw Error("Usage: pnpm run deploy:preview [--dry-run]");
const priceSource = process.env.VITE_WT_PRICE_SOURCE || "production";
if (!["production", "preview"].includes(priceSource))
  throw Error("VITE_WT_PRICE_SOURCE must be production or preview");
const env = {
  ...process.env,
  WT_DEPLOY_TARGET: "preview",
  VITE_WT_CATALOG_SOURCE: "preview",
  VITE_WT_PRICE_SOURCE: priceSource,
  WT_SITE_URL: "https://wt.mrtreasure.cc/",
};
function run(args) {
  const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit", env });
  if (result.status !== 0) throw Error(`Preview command failed: pnpm ${args.join(" ")}`);
}
run(["run", "check"]);
run(["run", "build"]);
run(["exec", "node", "scripts/build-preview-catalog.mjs"]);
if (args.includes("--dry-run")) {
  console.log(
    "Preview checked; no upload. Target: https://render.mrtreasure.cc/war-thunder-trees/",
  );
} else {
  run(["run", "publish"]);
  run([
    "--dir",
    "/vol1/1000/workspace/cloudflare-sites",
    "run",
    "publish:render",
    "--skip-edge-verification",
  ]);
  console.log("Render preview deployed: https://render.mrtreasure.cc/war-thunder-trees/");
}
