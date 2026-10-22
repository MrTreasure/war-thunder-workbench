import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
const read = async (path) =>
  JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const catalog = await read("data/generated/catalog.json"),
  research = await read("data/research.json");
const output = new URL("../data/account-vehicle-policies.json", import.meta.url);
const previous = await readFile(output, "utf8")
  .then(JSON.parse)
  .catch(() => ({ vehicles: [] }));
const archive = new URL("../artifacts/valuation-policy-research/", import.meta.url);
await mkdir(archive, { recursive: true });
const units = new Map();
for (const [category, countries] of Object.entries(catalog.trees))
  for (const [country, tree] of Object.entries(countries))
    if (tree)
      for (const rank of tree.ranks)
        for (const node of [...rank.research, ...rank.special])
          for (const u of node.members)
            if (!node.variant || u.id === node.members[0].id)
              units.set(u.id, {
                id: u.id,
                name: u.name,
                country,
                category,
                rank: rank.rank,
                side: u.side,
                rp: u.rp,
              });
const promos = new Set(["us_m4_sherman_promo", "jp_destroyer_hatsuzuki"]);
const hidden = new Set([
  "germ_panther_ii",
  "germ_pzkpfw_vi_ausf_b_tiger_iih_kwk46",
  "germ_pzkpfw_maus",
  "germ_pzkpfw_e_100",
  "germ_flakpanzer_v_coelian",
]);
const extras = [
  "us_m2a4_1st_armor_div",
  "germ_pzkpfw_ii_ausf_c_DAK",
  "ussr_t_26_1940_1st_gvtbr",
  "uk_a_13_mk1_3rd_rtr",
  "fr_hotchkiss_h39_cambronne",
  "f3f-2_galer",
  "p-36a_rasmussen",
  "f2a-1_thach",
  "bf-109a_1",
  "i-153_m62_zhukovskiy",
  "gladiator_mk2_tuck",
  "a5m4_hagiri",
  "fiat_cr42_marcolin_italy",
  "hawk_iii",
  "tb_3_m17_32",
  "lagg-i-301",
  "us_m8_greyhound",
  "po-2m",
  "uk_a_13_mk2_1939",
];
const targets = [
  ...new Set([
    ...promos,
    ...hidden,
    ...extras,
    ...[...units.values()]
      .filter((u) => u.side === "research" && u.rp === 0 && research[u.id]?.free === true)
      .map((u) => u.id),
  ]),
].filter((id) => units.has(id));
const result = new Map(previous.vehicles.map((v) => [v.id, v]));
let requests = 0,
  failed = 0;
for (const id of targets) {
  const prior = result.get(id),
    unit = units.get(id),
    source = "https://wiki.warthunder.com/unit/" + encodeURIComponent(id);
  if (prior && Date.now() - Date.parse(prior.checkedAt) < 24 * 3600000) continue;
  if (requests++) await new Promise((resolve) => setTimeout(resolve, 1500));
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (response.status === 429 || response.status === 403) {
      console.error("Collection stopped at official access/rate limit; prior records retained");
      failed++;
      break;
    }
    if (!response.ok) throw Error("HTTP " + response.status);
    const html = await response.text();
    if (!html.includes(id) || html.length > 2000000) throw Error("Unit identity/body check failed");
    const { document } = parseHTML(html);
    document.querySelectorAll("script,style").forEach((node) => node.remove());
    const text = (document.querySelector("main") || document.body).textContent
      .replace(/\s+/g, " ")
      .trim();
    const header = text.split("General information")[0];
    const removed =
      /removed[^.!?]{0,150}(?:research tree|tech tree|air forces tree|researchable vehicle|reserve status)|hidden[^.!?]{0,150}(?:research|tech) tree|no longer (?:available|obtainable)|unavailable for (?:research|purchase)/i.exec(
        text,
      );
    const gift =
      /given away as a reward vehicle|(?:obtained|awarded|given to|given away|receive|rewarded|reward|gift)[^.!?]{0,180}(?:complet|event|War Thunder Mobile|new players|first battle|anniversary|Christmas|Halloween)/i.exec(
        text,
      );
    const free = /Free Research\s+Free Purchase/.test(header);
    let classification = "review",
      defaultMode = "unpriced",
      reason = "赠送／活动载具候选，获取条件待管理员确认",
      position = gift?.index || 0;
    if (unit.side === "research" && unit.rp === 0) {
      classification = free ? "initial_free" : "zero_research";
      defaultMode = free ? "exclude" : "auto";
      reason = free
        ? "官方页面确认免费研发与免费购买，不计入账号估值"
        : "已核实无需研发点；不代表默认赠送或免费购买";
      position = Math.max(0, text.indexOf("Free Research") - 40);
    } else if (gift) {
      classification = "conditional_gift";
      reason = "可通过任务／活动／新手奖励获得，默认等待管理员定价";
    }
    if (removed || hidden.has(id)) {
      classification = "hidden";
      defaultMode = "unpriced";
      reason = "隐藏或按等级条件开放的载具，保留未计价明细，待管理员确认";
      position = removed?.index || gift?.index || 0;
    }
    if (promos.has(id)) {
      classification = "promotion";
      defaultMode = "exclude";
      reason = "战争雷霆手游推广任务奖励，按用户规则不计价";
    }
    const evidence = text.slice(Math.max(0, position - 25), position + 600);
    const checkedAt = new Date().toISOString();
    const entry = {
      ...unit,
      classification,
      defaultMode,
      reason,
      source,
      checkedAt,
      sha256: createHash("sha256").update(html).digest("hex"),
      evidence: evidence.split(/\s+/).slice(0, 22).join(" "),
      freeResearch: /Free Research/.test(header)
        ? true
        : /[\d,]+ Research/.test(header)
          ? false
          : null,
      freePurchase: /Free Purchase/.test(header)
        ? true
        : /[\d,]+ Purchase/.test(header)
          ? false
          : null,
    };
    if (prior?.unitSource && prior.source !== source) {
      entry.unitSource = source;
      entry.source = prior.source;
      entry.evidence = prior.evidence;
      entry.sha256 = prior.sha256;
      entry.checkedAt = prior.checkedAt;
    }
    if (prior?.curated) {
      for (const key of [
        "classification",
        "defaultMode",
        "reason",
        "source",
        "evidence",
        "sha256",
        "checkedAt",
        "unitSource",
        "curated",
      ])
        if (prior[key] !== undefined) entry[key] = prior[key];
    }
    result.set(id, entry);
    await writeFile(
      new URL(encodeURIComponent(id) + ".json", archive),
      JSON.stringify({ source, checkedAt, text }, null, 2),
    );
    console.log(id + ": " + classification + " / " + defaultMode);
  } catch (error) {
    failed++;
    console.error(id + ": " + error.message + "; prior record retained");
  }
  // Checkpoint each verified page so an interrupted audit can resume without refetching.
  await writeFile(
    output,
    JSON.stringify(
      {
        schemaVersion: 1,
        version: "vehicle-policies-v1",
        checkedAt: new Date().toISOString(),
        countries: catalog.countries,
        categories: catalog.categories,
        vehicles: [...result.values()],
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(JSON.stringify({ targets: targets.length, verified: result.size, failed }));
if (failed) process.exitCode = 1;
