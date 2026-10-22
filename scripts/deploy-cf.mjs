import { setDefaultResultOrder } from "node:dns";
/** Upload only the validated static build. Never upload the source tree. */
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

setDefaultResultOrder("ipv4first");
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
const runtime = process.env.WT_CF_RUNTIME || "/vol1/1000/appdata/war-thunder-trees/cloudflare";
const stage = resolve(runtime, "staging");
const archive = resolve(runtime, "asset-history");
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
const deploymentConfig = JSON.parse(await readFile(resolve(root, "wrangler.jsonc"), "utf8"));
if (
  deploymentConfig.name !== "war-thunder-workbench" ||
  deploymentConfig.routes?.length !== 1 ||
  deploymentConfig.routes[0].pattern !== "wt.mrtreasure.cc" ||
  deploymentConfig.routes[0].custom_domain !== true
)
  throw Error("Production deployment must bind only wt.mrtreasure.cc to its independent Worker");
deploymentConfig.assets.directory = stage;
const configPath = resolve(runtime, "wrangler.json");
await writeFile(configPath, JSON.stringify(deploymentConfig, null, 2) + "\n", { mode: 0o600 });
run([
  "exec",
  "wrangler",
  "deploy",
  "--config",
  configPath,
  ...(dryRun ? ["--dry-run", "--outdir", resolve(runtime, "dry-run")] : []),
]);
if (!dryRun) {
  await cp(resolve(stage, "assets"), archive, { recursive: true });
  function readPublic(url) {
    const result = spawnSync(
      "curl",
      [
        "--http1.1",
        "--ipv4",
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "8",
        "--max-time",
        "20",
        url,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    if (result.status !== 0) throw Error("Public Cloudflare verification failed: " + url);
    return result.stdout;
  }
  let live;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      live = readPublic("https://wt.mrtreasure.cc/");
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  const entry = html.match(
    /<script[^>]+src="([^"]+)"[^>]*type="module"|<script[^>]+type="module"[^>]*src="([^"]+)"/,
  );
  if (!entry || !live.includes(entry[1] || entry[2]))
    throw Error(
      "Upload finished but public entry verification failed; check DNS/deployment before retrying",
    );
  const scriptUrl = new URL(entry[1] || entry[2], "https://wt.mrtreasure.cc/").href;
  readPublic(scriptUrl);
  const css = html.match(/<link[^>]+href="([^"]+\.css)"/);
  if (!css) throw Error("Missing stylesheet");
  readPublic(new URL(css[1], "https://wt.mrtreasure.cc/").href);
  if (
    !readPublic("https://wt.mrtreasure.cc/robots.txt").includes(
      "https://wt.mrtreasure.cc/sitemap.xml",
    )
  )
    throw Error("Wrong production sitemap");
  console.log("Verified public deployment: https://wt.mrtreasure.cc/");
}
