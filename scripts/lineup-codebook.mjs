// Persistent country-scoped Base62 registry. Append only; never renumber or reuse.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../data/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), "utf8"));
const [rules, catalog] = await Promise.all([read("lineup-rules.json"), read("trees.json")]);
let registry;
try {
  registry = await read("lineup-codebook.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  registry = { schemaVersion: 1, countries: {} };
}
if (registry.schemaVersion !== 1) throw Error("Unknown lineup registry version");
for (const country of Object.keys(catalog.countries)) {
  const codes = (registry.countries[country] ||= {});
  const ids = new Set(Object.values(codes));
  if (ids.size !== Object.keys(codes).length) throw Error(`Duplicate registry ID: ${country}`);
  let next = 1;
  for (const code of Object.keys(codes)) {
    if (
      code.length !== 2 ||
      [...code].some((c) => !rules.alphabet.includes(c)) ||
      code === rules.emptyCode
    )
      throw Error(`Invalid registry code: ${country}/${code}`);
    next = Math.max(
      next,
      rules.alphabet.indexOf(code[0]) * 62 + rules.alphabet.indexOf(code[1]) + 1,
    );
  }
  const countryIds = Object.values(catalog.trees)
    .flatMap((nations) => nations[country]?.ranks || [])
    .flatMap((rank) => [...rank.research, ...rank.special])
    .flatMap((node) => node.members)
    .map((unit) => unit.id);
  for (const id of [...new Set(countryIds)].sort()) {
    if (ids.has(id)) continue;
    if (next >= 62 ** 2)
      throw Error(`Country ${country} exhausted its two-character vehicle codes`);
    const code = rules.alphabet[Math.floor(next / 62)] + rules.alphabet[next % 62];
    if (code === rules.emptyCode || codes[code])
      throw Error(`Registry collision ${country}/${code}`);
    codes[code] = id;
    ids.add(id);
    next++;
  }
}
await writeFile(new URL("lineup-codebook.json", root), JSON.stringify(registry, null, 2) + "\n");
console.log(
  `Saved stable vehicle codes for ${Object.keys(registry.countries).length} countries (${fileURLToPath(root)})`,
);
