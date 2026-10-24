import { setDefaultResultOrder } from "node:dns";
import { lookup } from "node:dns/promises";
/** Upload only the validated static build. Never upload the source tree. */
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

setDefaultResultOrder("ipv4first");
const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = process.env.WT_CF_RUNTIME || "/vol1/1000/appdata/war-thunder-trees/cloudflare";
const dryRun = process.argv.slice(2).includes("--dry-run");
const verifyOnly = process.argv.slice(2).includes("--verify-only");
if (process.argv.slice(2).some((arg) => !["--dry-run", "--verify-only"].includes(arg)))
  throw Error("Usage: pnpm run deploy:cf [--dry-run | --verify-only]");
function run(args) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WT_SITE_URL: "https://wt.mrtreasure.cc/", WT_DEPLOY_TARGET: "cf" },
  });
  if (result.status !== 0) throw Error(`pnpm ${args.join(" ")} failed`);
}
if (verifyOnly) {
  if (dryRun) throw Error("Choose dry-run or verify-only");
  await verifyWorker(await readFile(resolve(runtime, "staging/index.html"), "utf8"));
  process.exit(0);
}

// Check the real public gateway without replaying any business/quota operation.
if (!dryRun) {
  const origin = "https://wt.mrtreasure.cc";
  const gatewayAddresses = await lookup("api.mrtreasure.cc", { all: true, family: 4 });
  function gatewayCheck(method, headers, body) {
    const args = [
      "--http1.1",
      "--ipv4",
      "--compressed",
      "--silent",
      "--show-error",
      "--connect-timeout",
      "5",
      "--max-time",
      "45",
      "--include",
      "--request",
      method,
    ];
    for (const [name, value] of Object.entries(headers)) args.push("--header", `${name}: ${value}`);
    if (body !== undefined) args.push("--data-binary", "@-");
    args.push(
      "--write-out",
      "\n__WT_STATUS__%{http_code}",
      "https://api.mrtreasure.cc/wt-stats/v1/auth/start",
    );
    let result;
    // Try each published address only on transport failure, never on an HTTP rejection.
    for (const { address } of gatewayAddresses) {
      result = spawnSync("curl", ["--resolve", `api.mrtreasure.cc:443:${address}`, ...args], {
        encoding: "utf8",
        input: body === undefined ? undefined : JSON.stringify(body),
        maxBuffer: 1024 * 1024,
      });
      if (result.status === 0) break;
    }
    if (result.status !== 0)
      throw Error("Public API deployment preflight failed; no Worker was uploaded");
    return { status: Number(result.stdout.match(/__WT_STATUS__(\d+)$/)?.[1]), raw: result.stdout };
  }
  const response = gatewayCheck("OPTIONS", {
    Origin: origin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type",
  });
  if (
    response.status !== 200 ||
    !response.raw.toLowerCase().includes("access-control-allow-origin: " + origin)
  )
    throw Error("Production CORS origin is not enabled; see docs/deployment-seo.md");
  const { randomBytes } = await import("node:crypto");
  const auth = gatewayCheck(
    "POST",
    { Origin: origin, "Content-Type": "application/json" },
    {
      challenge: randomBytes(32).toString("base64url"),
      state: randomBytes(24).toString("base64url"),
      returnUrl: origin + "/",
    },
  );
  if (auth.status !== 200)
    throw Error("Production login return URL is not enabled; see docs/deployment-seo.md");
}
run(["run", "check"]);
run(["run", "build"]);

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
  if (/\.(json|map|py|ts|tsx|wat|env|yml|yaml)$/.test(file))
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
  await verifyWorker(html);
}

async function verifyWorker(html) {
  let publicAddresses;
  try {
    publicAddresses = (await lookup("wt.mrtreasure.cc", { all: true, family: 4 })).map(
      (item) => item.address,
    );
  } catch {
    // A newly published name may still have a local negative DNS cache.
  }
  function curl(args) {
    return spawnSync(
      "curl",
      [
        "--http2",
        "--ipv4",
        "--compressed",
        "--fail",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "5",
        "--max-time",
        "30",
        ...args,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
  }
  function readPublic(url, allowEntryChallenge = false) {
    const parsed = new URL(url);
    if (parsed.origin !== "https://wt.mrtreasure.cc") throw Error("Unexpected verification origin");
    const requestArgs = allowEntryChallenge ? ["--include", url] : [url];
    let result = curl(requestArgs);
    if ([6, 7, 16, 18, 28, 35, 52, 55, 56, 92].includes(result.status)) {
      // Retry transport failures only. HTTP rejections must remain visible.
      // Keep the public URL, SNI and certificate validation on every address.
      if (!publicAddresses) {
        const dns = curl(["https://dns.alidns.com/resolve?name=wt.mrtreasure.cc&type=A"]);
        if (dns.status !== 0) throw Error("Public DNS check failed");
        const response = JSON.parse(dns.stdout);
        publicAddresses = (response.Answer || [])
          .filter(
            (item) =>
              item.type === 1 &&
              /^\d{1,3}(?:\.\d{1,3}){3}$/.test(item.data) &&
              item.data.split(".").every((n) => Number(n) <= 255),
          )
          .map((item) => item.data);
        if (response.Status !== 0 || !publicAddresses.length)
          throw Error("Production DNS is not published yet");
        console.log("Using public DNS answers for Cloudflare verification");
      }
      for (const ip of publicAddresses) {
        result = curl(["--resolve", "wt.mrtreasure.cc:443:" + ip, ...requestArgs]);
        if (result.status === 0 || result.status === 22) break;
      }
    }
    // The international tool entry intentionally challenges unverified clients.
    // Only accept Cloudflare's explicit challenge response, never an arbitrary 403.
    if (
      allowEntryChallenge &&
      result.status === 22 &&
      /^HTTP\/[\d.]+ 403\b/im.test(result.stdout) &&
      /^cf-mitigated:\s*challenge\s*$/im.test(result.stdout)
    )
      return null;
    if (result.status !== 0) throw Error("Public Cloudflare verification failed: " + url);
    return result.stdout;
  }
  const live = readPublic("https://wt.mrtreasure.cc/", true);
  const entry = html.match(
    /<script[^>]+src="([^"]+)"[^>]*type="module"|<script[^>]+type="module"[^>]*src="([^"]+)"/,
  );
  if (!entry || (live !== null && !live.includes(entry[1] || entry[2])))
    throw Error("Public entry does not match this release");
  if (live === null) {
    const guide = readPublic("https://wt.mrtreasure.cc/about/zh/");
    if (!guide.includes("https://wt.mrtreasure.cc/about/zh/") || !guide.includes('lang="zh-CN"'))
      throw Error("Public SEO guide unavailable behind entry protection");
    console.log(
      "Verified intentional CF challenge on the tool entry; public SEO guide remains accessible",
    );
  }
  readPublic(new URL(entry[1] || entry[2], "https://wt.mrtreasure.cc/").href);
  const css = html.match(/<link[^>]+href="([^"]+\.css)"/);
  if (!css) throw Error("Missing stylesheet");
  readPublic(new URL(css[1], "https://wt.mrtreasure.cc/").href);
  if (
    !readPublic("https://wt.mrtreasure.cc/robots.txt").includes(
      "https://wt.mrtreasure.cc/sitemap.xml",
    )
  )
    throw Error("Wrong production sitemap");
  console.log(
    `Verified public deployment: https://wt.mrtreasure.cc/ (HTTPS, ${live === null ? "protected entry + public SEO" : "entry"}, JS, CSS, sitemap)`,
  );
}
