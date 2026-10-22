/** Upload only the validated static build. Never upload the source tree. */
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dryRun = process.argv.slice(2).includes("--dry-run");
if (process.argv.slice(2).some((arg) => arg !== "--dry-run"))
  throw Error("Usage: pnpm run deploy:cf [--dry-run]");
function run(args) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WT_SITE_URL: "https://wt.mrtreasure.cc/", WT_DEPLOY_TARGET: "cf" },
  });
  if (result.status !== 0) throw Error(`pnpm ${args.join(" ")} failed`);
}
// A new origin needs explicit API and authorization return-path permission.
if (!dryRun) {
  const origin = "https://wt.mrtreasure.cc";
  const response = await fetch("https://api.mrtreasure.cc/wt-stats/v1/auth/start", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.headers.get("access-control-allow-origin") !== origin)
    throw Error(
      "Cloudflare origin is not enabled in the stats API. Follow docs/deployment-seo.md before publishing.",
    );
  const { randomBytes } = await import("node:crypto");
  const auth = await fetch("https://api.mrtreasure.cc/wt-stats/v1/auth/start", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      challenge: randomBytes(32).toString("base64url"),
      state: randomBytes(24).toString("base64url"),
      returnUrl: origin + "/",
    }),
  });
  if (!auth.ok)
    throw Error(
      "Cloudflare authorization return URL is not enabled. Follow docs/deployment-seo.md before publishing.",
    );
}
run(["run", "check"]);
run(["run", "build"]);
const stage = resolve(root, "artifacts/cf-deploy");
const archive = resolve(root, "artifacts/cf-asset-history");
await mkdir(archive, { recursive: true });
await rm(stage, { recursive: true, force: true });
await cp(resolve(root, "dist"), stage, { recursive: true });
// Keep old immutable assets so tabs from the previous release can finish lazy imports.
await cp(archive, resolve(stage, "assets"), { recursive: true });
await cp(resolve(root, "deploy/cloudflare-headers.txt"), resolve(stage, "_headers"));
const files = await readdir(stage, { recursive: true });
let count = 0;
for (const file of files) {
  const info = await stat(resolve(stage, file));
  if (!info.isFile()) continue;
  count++;
  if (info.size > 25 * 1024 * 1024) throw Error(`Asset exceeds Cloudflare's 25 MiB limit: ${file}`);
  if (/\.(json|map|py|ts|tsx|wat|wasm|env|yml|yaml)$/.test(file))
    throw Error(`Unexpected source/private payload: ${file}`);
}
if (count > 20000)
  throw Error("Free-plan asset limit reached; review old asset retention before deploying");
const html = await readFile(resolve(stage, "index.html"), "utf8");
if (!html.includes('rel="canonical" href="https://wt.mrtreasure.cc/"'))
  throw Error("Wrong canonical site");
run([
  "exec",
  "wrangler",
  "deploy",
  ...(dryRun ? ["--dry-run", "--outdir", "artifacts/cf-dry-run"] : []),
]);
if (!dryRun) {
  await cp(resolve(stage, "assets"), archive, { recursive: true });
  const response = await fetch("https://wt.mrtreasure.cc/", {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const live = await response.text();
  const entry = html.match(
    /<script[^>]+src="([^"]+)"[^>]*type="module"|<script[^>]+type="module"[^>]*src="([^"]+)"/,
  );
  if (!response.ok || !entry || !live.includes(entry[1] || entry[2]))
    throw Error(
      "Upload finished but public entry verification failed; check DNS/deployment before retrying",
    );
  console.log("Verified public deployment: https://wt.mrtreasure.cc/");
}
