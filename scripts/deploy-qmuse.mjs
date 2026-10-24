/** CLI import builds a version; the separate platform deploy makes it public. */
import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--dry-run"))
  throw Error("Usage: pnpm run deploy:qmuse [--dry-run]");
const dryRun = args.includes("--dry-run");
function run(args) {
  const r = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WT_DEPLOY_TARGET: "qmuse" },
  });
  if (r.status !== 0) throw Error(`pnpm ${args.join(" ")} failed`);
}
run(["run", "check"]);
run(["run", "build"]);
const binding = JSON.parse(
  await readFile(new URL("../.qmuse/project.json", import.meta.url), "utf8"),
);
const appId = binding.targets?.prod?.appId;
if (appId !== "8645013411493394")
  throw Error("Unexpected QMuse binding; do not create a new application");
if (dryRun) {
  console.log(
    "Dry run passed: checked build; next steps would import the bound app and publish its READY version. No QMuse calls made.",
  );
  process.exit(0);
}
const { apiCall } = await import("@qmuse/qmuse-cli/dist/client.js");
async function api(method, path, body) {
  const r = await apiCall(method, path, body);
  if (!r.ok) throw Error(`QMuse ${method} ${path} failed (${r.status})`);
  return r.data;
}
// Preserve the existing contest setting and refuse overlapping deploys.
const previous = await api("GET", `/api/deploy/last?appId=${appId}`);
if (previous?.status && !["DEPLOYED", "FAILED", "DEPLOY_FAILED", "CANCELLED", "CANCELED"].includes(previous.status))
  throw Error("A QMuse deployment is already active; check its status before retrying");
run([
  "exec",
  "qmuse-cli",
  "import",
  ".",
  "--title",
  "战雷工作台 · 战绩查询、科技树与地图走线",
  "--no-open",
]);
const imported = JSON.parse(
  await readFile(new URL("../.qmuse/project.json", import.meta.url), "utf8"),
);
const versionId = imported.targets?.prod?.lastVersionId;
if (!versionId || imported.targets.prod.appId !== appId)
  throw Error("Import did not produce a version for the bound app");
let previousContent = previous?.content;
if (typeof previousContent === "string") previousContent = JSON.parse(previousContent);
if (previous && typeof previousContent?.agentContest !== "boolean")
  throw Error(
    "Cannot preserve QMuse contest setting; inspect the existing deployment before publishing",
  );
const body = {
  appId,
  versionId,
  agentContest: previousContent?.agentContest ?? false,
};
const deployed = await api("POST", "/api/deploy/create", body);
const id = typeof deployed === "object" ? deployed.id : deployed;
if (!id)
  throw Error(
    "Platform returned no deployment ID; check the last deployment instead of publishing again",
  );
const recordDir = new URL(`../artifacts/releases/${versionId}/`, import.meta.url);
await mkdir(recordDir, { recursive: true });
await writeFile(
  new URL("deploy-command.json", recordDir),
  JSON.stringify({ appId, versionId, id }, null, 2),
);
for (let attempt = 0; attempt < 150; attempt++) {
  const status = await api("GET", `/api/deploy/query?id=${encodeURIComponent(id)}`);
  if (status.status === "DEPLOYED") {
    const response = await fetch(
      `https://render.qmuse.pub/p/muse/${appId}?release=${versionId}-${Date.now()}`,
      { cache: "no-store", signal: AbortSignal.timeout(20000) },
    );
    const html = await response.text();
    if (!response.ok || !html.includes(`"appVersionId":"${versionId}"`))
      throw Error(
        "Deployment completed but the public version is not verified; check before retrying",
      );
    console.log(`Verified QMuse version ${versionId}: https://render.qmuse.pub/p/muse/${appId}`);
    process.exit(0);
  }
  if (["FAILED", "DEPLOY_FAILED", "CANCELLED", "CANCELED"].includes(status.status))
    throw Error(`QMuse deployment ${id}: ${status.status}`);
  if (attempt % 5 === 0) console.log(`QMuse deployment ${id}: ${status.status}`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
throw Error(`QMuse deployment ${id} is still pending; query it before creating another deployment`);
