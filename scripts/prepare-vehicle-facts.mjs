import { mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

/** A small display projection, separate from trees, modifications and lineup registries. */
export async function prepareVehicleFacts(root, catalog) {
  const folder = resolve(root, "src/generated/vehicle-facts");
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  const entries = [];
  for (const country of Object.keys(catalog.countries)) {
    const items = new Map();
    for (const [category, countries] of Object.entries(catalog.trees))
      for (const rank of countries[country]?.ranks || [])
        for (const node of [...rank.research, ...rank.special])
          for (const unit of node.members) {
            const record = { country, category };
            for (const field of [
              "id",
              "name",
              "nameEn",
              "nameRu",
              "nameJa",
              "nameZhCN",
              "premium",
              "kind",
              "side",
              "rank",
              "role",
              "br",
              "rp",
              "price",
              "packPrice",
              "store",
              "market",
            ])
              if (unit[field] !== undefined) record[field] = unit[field];
            items.set(unit.id, record);
          }
    const text =
      JSON.stringify({
        schemaVersion: 1,
        country,
        checkedAt: catalog.checkedAt,
        items: [...items.values()],
      }) + "\n";
    const sha256 = createHash("sha256").update(text).digest("hex");
    const stem = `vehicle-facts-${country}.${sha256.slice(0, 16)}`;
    await writeFile(resolve(folder, `${stem}.ts`), `export default ${JSON.stringify(text)};\n`);
    entries.push(
      `${JSON.stringify(country)}: { sha256: ${JSON.stringify(sha256)}, bytes: ${Buffer.byteLength(text)}, load: () => import("./vehicle-facts/${stem}") }`,
    );
  }
  await writeFile(
    resolve(root, "src/generated/vehicle-fact-modules.ts"),
    `// Generated display metadata. Never preloaded or merged with modifications.\nexport const vehicleFactModules: Record<string, { sha256: string; bytes: number; load: () => Promise<{default: string}> }> = {\n${entries.join(",\n")}\n};\n`,
  );
}
