import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";

const root = fileURLToPath(new URL("../", import.meta.url));
const { countries, categories } = JSON.parse(
  await readFile(resolve(root, "data/catalog-settings.json"), "utf8"),
);
const { categoryRoles = {} } = JSON.parse(
  await readFile(resolve(root, "data/taxonomy.json"), "utf8"),
);
const selectedCategory = process.argv.find((value) => value.startsWith("--category="))?.slice(11);
if (selectedCategory && !Object.hasOwn(categories, selectedCategory))
  throw Error(`Unknown category: ${selectedCategory}`);
const sourceDir = process.argv
  .find((value) => value.startsWith("--source-dir="))
  ?.split("=")
  .slice(1)
  .join("=");
const refresh = process.argv.includes("--refresh") || Boolean(sourceDir);
const clean = (text) => text.replaceAll("\u00a0", " ").trim();
const purchasesPath = resolve(root, "data/purchases.json");
let research = {};
try {
  research = JSON.parse(await readFile(resolve(root, "data/research.json"), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
let purchases = {};
try {
  purchases = JSON.parse(await readFile(purchasesPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

async function snapshot() {
  const previous = selectedCategory
    ? JSON.parse(await readFile(resolve(root, "data/trees.json"), "utf8"))
    : null;
  const payload = {
    countries,
    categories,
    checkedAt: new Date().toISOString(),
    sources: previous?.sources || {},
    trees: previous?.trees || {},
    audit: previous?.audit.filter((row) => row.category !== selectedCategory) || [],
  };
  for (const category of Object.keys(categories)) {
    if (selectedCategory && category !== selectedCategory) continue;
    const url = `https://wiki.warthunder.com/${category}`;
    const html = sourceDir
      ? await readFile(resolve(sourceDir, `${category}.html`), "utf8")
      : await fetch(url, { signal: AbortSignal.timeout(45_000) }).then((response) => {
          if (!response.ok) throw new Error(`Official Wiki: ${response.status}`);
          return response.text();
        });
    const { document } = parseHTML(html);
    const encoded = html.match(/window\.WT_UnitList\s*=\s*('(?:\\.|[^'\\])*')/)?.[1];
    if (!encoded) throw new Error(`Missing official metadata: ${category}`);
    // Evaluate only a matched JavaScript string literal, never a remote script.
    const metadata = new Map(
      JSON.parse(runInNewContext(encoded, Object.create(null), { timeout: 100 })).map((row) => [
        row[0],
        row,
      ]),
    );
    payload.sources[category] = {
      url,
      sha256: createHash("sha256").update(html).digest("hex"),
      checkedAt: payload.checkedAt,
    };
    payload.trees[category] = {};
    for (const country of Object.keys(countries)) {
      const instance = document.querySelector(
        `.unit-tree[data-tree-id="${country}"] .wt-tree_instance`,
      );
      if (!instance) {
        payload.trees[category][country] = null;
        continue;
      }
      const tree = { ranks: [], columns: 0, specialColumns: 0, edges: [], missingReferences: [] };
      const aliases = new Map();
      const units = new Map();
      function vehicle(element) {
        const id = element.getAttribute("data-unit-id");
        const data = metadata.get(id);
        const row = data?.[7] ?? [];
        const price = row[1] ?? [];
        const verified = purchases[id];
        const premium = data ? data[5] === 1 : element.classList.contains("wt-tree_item--prem");
        const kind =
          data?.[5] === 2
            ? "squadron"
            : price[2] === "g" && premium
              ? "gold"
              : verified?.store && premium
                ? "pack"
                : verified?.market
                  ? "market"
                  : premium
                    ? "premium"
                    : "special";
        const name = clean(element.querySelector(".wt-tree_item-text")?.textContent || id);
        const item = {
          id,
          name,
          req: element.getAttribute("data-unit-req") || null,
          premium,
          kind,
          role: categoryRoles[category]?.[row[0]?.[0]] || row[0]?.[0] || null,
          br: data?.[4] || {},
          price: price[2] === "g" ? price[0] : null,
          store: verified?.store || null,
          market: verified?.market || null,
        };
        if (units.has(id)) throw new Error(`Duplicate vehicle ${category}/${country}/${id}`);
        units.set(id, item);
        return item;
      }
      for (const heading of instance.querySelectorAll(".wt-tree_r-header")) {
        const label = heading.querySelector(".wt-tree_r-header_label span")?.textContent;
        const rankElement = heading.nextElementSibling;
        if (!label || !rankElement?.classList.contains("wt-tree_rank")) continue;
        const tables = [...rankElement.querySelectorAll("table.wt-tree_rank-instance")];
        if (tables.length !== 2)
          throw new Error(`Unexpected official tree layout: ${category}/${country}/${label}`);
        const rank = { rank: label, research: [], special: [], rows: 0 };
        tables.forEach((table, side) => {
          const rows = [...table.querySelectorAll("tr")];
          if (side === 0) rank.rows = rows.length;
          rows.forEach((row, rowIndex) => {
            const cells = [...row.children].filter((child) => child.tagName === "TD");
            if (side === 0) tree.columns = Math.max(tree.columns, cells.length);
            else tree.specialColumns = Math.max(tree.specialColumns, cells.length);
            cells.forEach((cell, column) => {
              const element = [...cell.children].find(
                (child) =>
                  child.classList.contains("wt-tree_item") ||
                  child.classList.contains("wt-tree_group"),
              );
              if (!element) return;
              const group = element.classList.contains("wt-tree_group");
              const members = group
                ? [...element.querySelectorAll(".wt-tree_item[data-unit-id]")].map(vehicle)
                : [vehicle(element)];
              if (!members.length) throw new Error("Empty official folder");
              const id = element.getAttribute("data-unit-id");
              const node = {
                id,
                name: group
                  ? clean(
                      element.querySelector(".wt-tree_group-folder .wt-tree_item-text")
                        ?.textContent || members[0].name,
                    )
                  : members[0].name,
                group,
                variant: group && element.classList.contains("slave"),
                row: rowIndex,
                column,
                req: element.getAttribute("data-unit-req") || null,
                members,
              };
              aliases.set(id, node);
              members.forEach((member) => {
                aliases.set(member.id, node);
                member.side = side === 0 ? "research" : "special";
                member.rank = label;
              });
              rank[side === 0 ? "research" : "special"].push(node);
            });
          });
        });
        tree.ranks.push(rank);
      }
      for (const rank of tree.ranks) {
        for (const node of rank.research) {
          if (node.req) {
            const previous = aliases.get(node.req);
            if (!previous) tree.missingReferences.push({ to: node.id, from: node.req });
            else tree.edges.push({ from: previous.id, to: node.id, sourceReq: node.req });
          }
        }
      }
      if (tree.missingReferences.length)
        throw new Error(
          `Unresolved research references: ${JSON.stringify(tree.missingReferences)}`,
        );
      const count = [...units.values()];
      tree.counts = {
        total: count.length,
        research: count.filter((item) => item.side === "research").length,
        special: count.filter((item) => item.side === "special").length,
        groups: tree.ranks.reduce(
          (sum, rank) => sum + rank.research.filter((node) => node.group).length,
          0,
        ),
      };
      tree.missingReferences = undefined;
      payload.trees[category][country] = tree;
      payload.audit.push({
        category,
        country,
        ...tree.counts,
        edges: tree.edges.length,
        columns: tree.columns,
      });
      console.log(
        `${category}/${country}: ${tree.counts.total} vehicles, ${tree.edges.length} explicit edges, ${tree.counts.groups} folders`,
      );
    }
  }
  return payload;
}

const data = refresh
  ? await snapshot()
  : JSON.parse(await readFile(resolve(root, "data/trees.json"), "utf8"));
if (refresh) await writeFile(resolve(root, "data/trees.json"), `${JSON.stringify(data)}\n`);
console.log("Tree JSON snapshot ready.");
