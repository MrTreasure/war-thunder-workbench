import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const atlas = JSON.parse(
  await readFile(new URL("../data/ground-maps.json", import.meta.url), "utf8"),
);
assert.equal(atlas.maps.length, 55);
assert.equal(
  atlas.maps.reduce((n, m) => n + m.layouts.length, 0),
  309,
);
assert.equal(
  atlas.maps.reduce((n, m) => n + m.thumbnails.length, 0),
  77,
);
assert.equal(atlas.assetRepository.url, "https://github.com/MrTreasure/oss-files");
assert.match(atlas.assetRepository.commit, /^[a-f0-9]{40}$/);
assert.equal(atlas.projection.revision, 2);
assert.equal(atlas.projection.worldZDirection, "up");
assert.equal(atlas.projection.contourSvgTransform, "matrix(1 0 0 -1 0 1000)");
const ids = new Set();
function asset(a, fallbackRequired = true) {
  assert(
    a.url.startsWith(
      `https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@${atlas.assetRepository.commit}/war-thunder/ground-maps/v1/`,
    ),
  );
  assert(
    a.rawUrl.startsWith(
      `https://raw.githubusercontent.com/MrTreasure/oss-files/${atlas.assetRepository.commit}/war-thunder/ground-maps/v1/`,
    ),
  );
  if (fallbackRequired || a.fallbackUrl) {
    assert.match(a.fallbackUrl, /^https:\/\/wtmaps\.mrtreasure\.cc\/ground-maps\/v1\//);
    assert(a.fallbackUrl.includes(a.fallbackSha256.slice(0, 24)));
    assert.equal(a.fallbackSha256, a.sourceSha256);
  }
  assert.match(a.sha256, /^[a-f0-9]{64}$/);
  assert(a.url.includes(a.sha256.slice(0, 24)));
  assert(a.bytes > 0);
  assert.match(a.sourceSha256, /^[a-f0-9]{64}$/);
}
for (const m of atlas.maps) {
  assert(!ids.has(m.id));
  ids.add(m.id);
  asset(m.base);
  asset(m.contourImage);
  assert(m.width > 0 && m.height > 0);
  assert(m.bounds[1][0] > m.bounds[0][0] && m.bounds[1][1] > m.bounds[0][1]);
  assert(m.grid.default_reference.step_xz_m.every((n) => n > 0));
  assert.equal(m.grid.default_reference.origin_xz_m[1], m.bounds[1][1]);
  assert.equal(m.contours.imageProjection, "source-world-z-down; reflect-y-on-display");
  assert.equal(m.grid.verified_for_runtime_match, false);
  const layouts = new Set();
  for (const l of m.layouts) {
    assert(!layouts.has(l.id));
    layouts.add(l.id);
    if (l.crop) {
      assert(l.crop.length === 4 && l.crop.every(Number.isFinite));
      assert(l.crop[2] > l.crop[0] && l.crop[3] > l.crop[1]);
    }
    for (const p of l.marks) {
      assert(["spawn", "capture"].includes(p.kind));
      assert(Number.isFinite(p.x) && Number.isFinite(p.y));
      const world = [
        m.bounds[0][0] + p.x * (m.bounds[1][0] - m.bounds[0][0]),
        m.bounds[1][1] - p.y * (m.bounds[1][1] - m.bounds[0][1]),
      ];
      assert(
        world.every((n, i) => Math.abs(n - p.world[i]) < 0.02),
        "Point projection changed",
      );
    }
  }
  for (const t of m.thumbnails) {
    assert(layouts.has(t.layoutId));
    asset(t.image, false);
    assert.equal(t.projectionRevision, 2);
    assert.match(t.sourcePath, /^图片\/.+_dom\.webp$/);
    assert.match(t.sourceSha256, /^[a-f0-9]{64}$/);
    assert(t.width > 0 && t.height > 0 && t.width <= 512 && t.height <= 512);
  }
  for (const g of m.guides) {
    assert.match(g.source, /^https:\/\/(www\.)?xiaoheihe\.cn\//);
    assert(g.title);
  }
}
Object.values(atlas.icons).forEach(asset);
console.log(
  "Ground maps verified: 55 maps / 77 thumbnails / 309 layouts; coordinates and asset hashes checked",
);
