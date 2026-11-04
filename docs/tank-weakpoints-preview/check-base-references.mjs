import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { validateBaseReferences } from './base-reference-validation.mjs';
const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const data = JSON.parse(await read('data/tank-weakpoints-samples.json'));
const registry = JSON.parse(await read('data/tank-weakpoint-assets.json'));
const audit = JSON.parse(await read('data/tank-weakpoint-base-proofs.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
await validateBaseReferences(data, registry, audit.candidates, read, hash);
// Execute actual UI functions against a small DOM, without loading images or a browser.
const js = String(await read('docs/tank-weakpoints-preview/preview.js'));
const functionSource = (name, next) => js.slice(js.indexOf(`function ${name}(`), js.indexOf(next, js.indexOf(`function ${name}(`)));
const node = () => ({ hidden: false, children: [], replaceChildren(...children) { this.children = children; } });
const host = node(), search = { value: 'active filter' };
let selectedId;
const context = vm.createContext({ SAMPLE: data, document: { createElement: node }, $: (id) => id === 'base-reference' ? host : search,
  location: { hash: '' }, URLSearchParams, encodeURIComponent,
  matches: () => false, updateList: (id) => { selectedId = id; } });
vm.runInContext('let country="britain", rank="VIII", searchQuery="active filter";\n' + functionSource('element', 'function sourceOf') + functionSource('renderBaseReference', 'function render()') + functionSource('fromHash', 'const searchInput'), context);
const before = JSON.stringify(data);
for (const target of data.models.filter((model) => model.baseVehicleReference)) {
  context.target = target;
  vm.runInContext('renderBaseReference(target)', context);
  assert.equal(host.hidden, false);
  assert.equal(host.children[2].href, '#vehicle=' + encodeURIComponent(target.baseVehicleReference.vehicleId));
  assert.equal(host.children[3].href, target.wikiUrl);
  assert.match(host.children[1].textContent, /不等同本车实拍/);
  assert.equal(host.children.some((child) => child.src), false);
  context.location.hash = host.children[2].href;
  vm.runInContext('fromHash()', context);
  assert.equal(selectedId, target.baseVehicleReference.vehicleId);
  assert.equal(vm.runInContext('country + "/" + rank + "/" + searchQuery', context), 'all/all/');
}
assert.equal(JSON.stringify(data), before, 'Rendering and following references cannot mutate images, tests, pins or coverage');
context.target = { ...data.models.find((model) => model.baseVehicleReference), imageUrl: 'own-photo.webp' };
vm.runInContext('renderBaseReference(target)', context);
assert.equal(host.hidden, true);
for (const mode of ['self', 'missing', 'cycle', 'hash', 'url', 'photo']) {
  const changed = structuredClone(data), assets = structuredClone(registry);
  const target = changed.models.find((model) => model.baseVehicleReference), ref = target.baseVehicleReference;
  if (mode === 'self') ref.vehicleId = target.id;
  if (mode === 'missing') ref.vehicleId = 'missing';
  if (mode === 'cycle') changed.models.find((model) => model.id === ref.vehicleId).baseVehicleReference = { vehicleId: target.id };
  if (mode === 'hash') ref.sourceHTMLSHA = '0'.repeat(64);
  if (mode === 'url') ref.targetWikiURL = 'https://wiki.warthunder.com/unit/wrong';
  if (mode === 'photo') delete assets.models[ref.vehicleId].photo;
  await assert.rejects(validateBaseReferences(changed, assets, audit.candidates, read, hash), undefined, mode);
}
console.log(`Base references: ${data.models.filter((model) => model.baseVehicleReference).length} verified links, no model mutation, cross-country hash navigation, invalid proofs/cycles rejected.`);
