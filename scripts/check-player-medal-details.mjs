import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (name) =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const [details, images] = await Promise.all([
  read("player-medal-details"),
  read("player-medal-images"),
]);
assert.equal(details.schemaVersion, 1);
assert.equal(details.sourceCommit, images.source.assetCommit);
assert.equal(images.source.hosting, "third-party-game-resource-mirror");
assert(Number.isFinite(Date.parse(images.detailCheckedAt)));
for (const image of images.items) {
  const detail = image.detail;
  assert.equal(image.width, 128);
  assert.equal(image.height, 128);
  assert.equal(detail.width, 256);
  assert.equal(detail.height, 256);
  assert(Number.isSafeInteger(detail.bytes) && detail.bytes > 0);
  assert.match(detail.sha256, /^[a-f0-9]{64}$/);
  assert.match(detail.gitBlobSha, /^[a-f0-9]{40}$/);
  const path = `${images.source.assetCommit}/${images.source.directory}/${image.id}_big.png`;
  assert.equal(
    detail.fallbackUrl,
    `https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/${path}`,
  );
  assert.equal(detail.url, `https://cdn.jsdelivr.net/gh/gszabi99/War-Thunder-Datamine@${path}`);
}
assert.match(details.sourceCommit, /^[a-f0-9]{40}$/);
assert.equal(details.semantics, "localized_game_configuration_outline_not_verbatim_game_ui");
assert.equal(details.sources.length, 3);
for (const source of details.sources) {
  assert.match(source.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(source.bytes) && source.bytes > 0);
  assert.equal(
    source.url,
    `https://github.com/gszabi99/War-Thunder-Datamine/blob/${details.sourceCommit}/${source.path}`,
  );
}
assert.equal(new Set(details.items.map((item) => item.id)).size, details.items.length);
assert.deepEqual(
  details.items.map((item) => item.id).sort(),
  images.items.map((item) => item.id).sort(),
);
for (const item of details.items) {
  assert.equal(typeof item.country, "string");
  assert(
    item.objective === null || (typeof item.objective === "string" && item.objective.length > 0),
  );
  assert(item.description === null || typeof item.description === "string");
  for (const lines of [item.conditions, item.notes]) {
    assert(Array.isArray(lines));
    for (const line of lines) assert(typeof line === "string" && line.length > 0);
  }
  for (const [mode, multiplier] of Object.entries(item.multipliers)) {
    assert(["ab", "rb", "sb"].includes(mode));
    assert(Number.isFinite(multiplier) && multiplier > 0);
  }
  if (item.objective === null) assert(item.notes.length > 0);
}
// These cases protect against treating an absent objective as zero, or exposing
// a hidden linked streak's sentinel as the required number of assists.
const byId = new Map(details.items.map((item) => [item.id, item]));
assert.equal(byId.get("ussr_victory_75_medal").objective, null);
assert.equal(byId.get("fr_volunteer_cross").objective, "累计协助击毁玩家载具 300 次");
assert.deepEqual(byId.get("fr_military_medal").multipliers, { ab: 1, rb: 2, sb: 3 });
assert(byId.get("fr_military_medal").conditions.includes("战斗活跃度至少 60%"));
console.log(
  `Validated ${details.items.length} public medal descriptions, source pins and image IDs.`,
);
