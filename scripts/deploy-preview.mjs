/** Render preview is separate from the independent wt production Worker. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--dry-run"))
  throw Error("Usage: pnpm run deploy:preview [--dry-run]");
const env = {
  ...process.env,
  WT_DEPLOY_TARGET: "preview",
  WT_SITE_URL: "https://wt.mrtreasure.cc/",
};
function run(args) {
  const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit", env });
  if (result.status !== 0) throw Error(`Preview command failed: pnpm ${args.join(" ")}`);
}
run(["run", "check"]);
run(["run", "build"]);
if (args.includes("--dry-run")) {
  console.log(
    "Preview checked; no upload. Target: https://render.mrtreasure.cc/war-thunder-trees/",
  );
} else {
  run(["run", "publish"]);
  run(["--dir", "/vol1/1000/workspace/cloudflare-sites", "run", "publish:render"]);
  console.log("Render preview deployed: https://render.mrtreasure.cc/war-thunder-trees/");
}
