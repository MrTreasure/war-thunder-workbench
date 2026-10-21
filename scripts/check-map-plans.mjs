import assert from "node:assert/strict";
import { MapPlanStore, planFileName, planStorageError } from "../src/map-editor-plans.ts";
import { makeProject, parseProject } from "../src/map-editor-model.ts";
import { mapFonts, canvasTextFont, fontFamily } from "../src/map-editor-fonts.ts";

const context = { mapId: "map-a", layoutId: "layout-a", team: 1 };
const icons = new Set();
const annotation = {
  id: "text-1",
  kind: "text",
  color: "#e4c477",
  point: { x: 0.4, y: 0.5 },
  text: "侧翼推进",
  fontSize: 0.018,
  rotation: 0,
  hidden: false,
  locked: false,
};
const legacy = makeProject(context, [annotation]);
let raw = null,
  fail = false,
  writes = 0;
const files = {
  read: async () => raw,
  write: async (body) => {
    if (fail) throw new DOMException("quota", "QuotaExceededError");
    raw = body;
    writes++;
  },
};
let tail = Promise.resolve();
const lock = (operation) => {
  const task = tail.then(operation);
  tail = task.catch(() => {});
  return task;
};
const store = new MapPlanStore(context, icons, files, lock);
let library = await store.load(legacy);
assert.equal(library.activeId, "default");
assert.deepEqual(library.plans[0].project.items, legacy.items);
const firstWrite = writes;
await store.load(makeProject(context, []));
assert.equal(writes, firstWrite, "An existing library must not be overwritten by a legacy draft");

library = await store.create(
  "进攻方案",
  makeProject(context, [{ ...annotation, font: "serif", fontWeight: 700, italic: true }]),
);
const attackId = library.activeId;
assert.equal(library.plans.length, 2);
assert.notEqual(attackId, "default");
assert.equal(library.plans[1].project.items[0].font, "serif");
const secondTab = new MapPlanStore(context, icons, files, lock);
await Promise.all([
  store.save("default", makeProject(context, [{ ...annotation, text: "默认方案仍保留" }])),
  secondTab.create("防守方案", makeProject(context, [])),
]);
library = await store.load(legacy);
assert.equal(library.plans.length, 3, "Concurrent tabs must retain both sets of changes");
assert.equal(
  library.plans.find((plan) => plan.id === "default").project.items[0].text,
  "默认方案仍保留",
);
library = await store.select(attackId);
assert.equal(library.activeId, attackId);
library = await store.rename(attackId, "侧翼进攻");
assert.equal(library.activeId, attackId);
assert.equal(library.plans.find((plan) => plan.id === attackId).name, "侧翼进攻");
await assert.rejects(store.rename(attackId, "默认方案"));
await assert.rejects(store.create(" "));
await assert.rejects(store.save("deleted-plan", legacy));
await assert.rejects(store.save(attackId, makeProject({ ...context, team: 2 }, [])));

const saved = raw;
fail = true;
await assert.rejects(store.save(attackId, makeProject(context, [])));
assert.equal(raw, saved, "Quota errors must retain the committed OPFS file");
fail = false;
library = await store.save(attackId, makeProject(context, [{ ...annotation, text: "保存恢复" }]));
assert.equal(library.plans.find((plan) => plan.id === attackId).project.items[0].text, "保存恢复");
library = await store.remove(attackId);
assert(!library.plans.some((plan) => plan.id === attackId));
assert(library.plans.some((plan) => plan.id === library.activeId));
for (const plan of library.plans.slice(1)) await store.remove(plan.id);
await assert.rejects(store.remove("default"));
raw = "{broken";
await assert.rejects(store.load(legacy));
assert.equal(raw, "{broken", "Corrupt user documents must never be replaced automatically");
assert.notEqual(planFileName(context), planFileName({ ...context, team: 2 }));
assert.notEqual(
  planFileName({ mapId: "a--b", layoutId: "c", team: 1 }),
  planFileName({ mapId: "a", layoutId: "b--c", team: 1 }),
);
assert(!planFileName({ ...context, mapId: "../map" }).includes("/"));
assert.match(planStorageError(new DOMException("quota", "QuotaExceededError")), /空间不足/);
assert.match(planStorageError(new SyntaxError()), /原文件已保留/);
for (const font of mapFonts) {
  const text = { ...annotation, font: font.id, fontWeight: 400, italic: true };
  const parsed = parseProject(makeProject(context, [text]), icons, () => true);
  assert.deepEqual(parsed.items[0], text);
  assert(canvasTextFont(text, 18).includes(fontFamily(font.id)));
  assert(canvasTextFont(text, 18).startsWith("italic 400 18px"));
}
assert.equal(canvasTextFont({}, 18), "600 18px " + fontFamily("sans"));
for (const extra of [{ font: "url(evil)" }, { fontWeight: 900 }, { italic: "true" }])
  assert.throws(() =>
    parseProject(makeProject(context, [{ ...annotation, ...extra }]), icons, () => true),
  );
console.log(
  "Map plans verified: legacy migration, independent schemes, cross-tab locking, atomic failure recovery, deletion, corrupt-file preservation and validated text fonts",
);
