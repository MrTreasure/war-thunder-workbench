import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const atlas = JSON.parse(
  await readFile(new URL("../data/map-atlas.json", import.meta.url), "utf8"),
);
const validDate = (value) =>
  assert(Number.isFinite(Date.parse(value)), `Invalid atlas date: ${value}`);
const publicSource = (value) => {
  const url = new URL(value);
  assert.equal(url.protocol, "https:");
  assert(["www.xiaoheihe.cn", "web.xiaoheihe.cn"].includes(url.hostname));
};
assert.equal(atlas.schemaVersion, 1);
assert.equal(atlas.source.url, "https://render.mrtreasure.cc/muse/wt-map-atlas/index.html");
for (const key of ["sha256", "guidesSha256", "imagesSha256"])
  assert.match(atlas.source[key], /^[a-f0-9]{64}$/);
validDate(atlas.source.checkedAt);
assert.equal(atlas.collection.author, "木炉");
assert.equal(atlas.collection.complete, true);
assert.equal(atlas.collection.count, atlas.collection.entries.length);
assert.equal(new Set(atlas.collection.entries.map((e) => e.id)).size, atlas.collection.count);
validDate(atlas.collection.checkedAt);
publicSource(atlas.collection.source);
const images = new Map();
for (const image of atlas.images) {
  assert(!images.has(image.id));
  images.set(image.id, image);
  assert.match(image.id, /^[a-f0-9]{14}$/);
  assert(["原图", "走线图"].includes(image.kind));
  assert(Number.isSafeInteger(image.size) && image.size > 0);
  assert.match(image.sha256, /^[a-f0-9]{64}$/);
  for (const field of ["image", "thumb"]) {
    const url = new URL(image[field]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "wtmaps.mrtreasure.cc");
    assert(url.pathname.includes(image.id));
  }
}
const guides = new Set();
for (const guide of atlas.guides) {
  assert(!guides.has(guide.id));
  guides.add(guide.id);
  assert(guide.name && guide.overview && guide.mode);
  publicSource(guide.source);
  assert.equal(guide.id, new URL(guide.source).pathname.split("/").at(-1));
  validDate(guide.verifiedAt);
  assert(guide.variants.length > 0);
  const sides = new Set();
  for (const variant of guide.variants) {
    assert(!sides.has(variant.id));
    sides.add(variant.id);
    assert(variant.side && variant.notes.length > 0);
    if (variant.imageId !== null) {
      assert(images.has(variant.imageId));
      assert.equal(images.get(variant.imageId).name, guide.name);
    }
    for (const note of variant.notes) assert(note.label && note.text);
  }
}
for (const entry of atlas.collection.entries) {
  publicSource(entry.source);
  validDate(entry.publishedAt);
  validDate(entry.updatedAt);
  assert.equal(entry.isMapGuide, guides.has(entry.id));
}
for (const entry of atlas.collection.newEntries)
  assert(atlas.collection.entries.some((e) => e.id === entry.id));
for (const record of Object.values(atlas.collection.articleChecks || {})) {
  publicSource(record.source);
  validDate(record.checkedAt);
  validDate(record.updatedAt);
  assert.match(record.bodySha256, /^[a-f0-9]{64}$/);
  assert(record.characters >= 40);
}
for (const resource of atlas.resources) {
  assert(resource.title);
  publicSource(resource.source);
}
assert(guides.size >= 12);
const archive = JSON.parse(
  await readFile(new URL("../data/map-collections.json", import.meta.url), "utf8"),
);
const settings = JSON.parse(
  await readFile(new URL("../data/map-collection-settings.json", import.meta.url), "utf8"),
);
assert.equal(archive.schemaVersion, 1);
assert.deepEqual(archive.categoryLabels, settings.categoryLabels);
assert.deepEqual(
  archive.collections.map((c) => c.id).sort(),
  settings.collections.map((c) => c.id).sort(),
);
for (const collection of archive.collections) {
  const expected = settings.collections.find((c) => c.id === collection.id);
  assert.equal(collection.source, expected.source);
  assert.equal(collection.author, expected.author);
  assert.equal(collection.authorId, expected.authorId);
  assert.equal(collection.edition, "archive");
  assert.equal(new URL(collection.source).searchParams.get("obj_id"), collection.id);
  assert.equal(collection.complete, true);
  assert.equal(collection.count, collection.entries.length);
  validDate(collection.checkedAt);
  validDate(collection.collectionUpdatedAt);
  assert.equal(
    createHash("sha256").update(JSON.stringify(collection.entries)).digest("hex"),
    collection.sha256,
  );
  const entries = new Map();
  for (const entry of collection.entries) {
    assert(!entries.has(entry.id));
    entries.set(entry.id, entry);
    publicSource(entry.source);
    assert(entry.title);
    assert.equal(entry.id, new URL(entry.source).pathname.split("/").at(-1));
    validDate(entry.publishedAt);
    validDate(entry.updatedAt);
    assert(Object.hasOwn(archive.categoryLabels, entry.category));
    for (const id of entry.relatedGuideIds) assert(guides.has(id));
  }
  for (const [id, check] of Object.entries(collection.articleChecks)) {
    assert(entries.has(id));
    assert.equal(check.source, entries.get(id).source);
    assert.match(check.articleId, /^\d+$/);
    assert.match(check.bodySha256, /^[a-f0-9]{64}$/);
    assert(check.characters >= 40);
    validDate(check.checkedAt);
    validDate(check.updatedAt);
  }
  for (const error of collection.articleCheckErrors) assert(entries.has(error.id));
  if (collection.articleRetryAfter) validDate(collection.articleRetryAfter);
  assert([null, "verification_required"].includes(collection.articleChecksStoppedReason));
}
console.log(
  JSON.stringify({
    mapGuides: guides.size,
    atlasImages: images.size,
    checkedCollectionEntries: atlas.collection.count,
    newCollectionEntries: atlas.collection.newEntries.length,
    archiveCollections: archive.collections.length,
    archiveEntries: archive.collections.reduce((sum, c) => sum + c.count, 0),
  }),
);
