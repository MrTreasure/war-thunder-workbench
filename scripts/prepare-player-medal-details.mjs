/** Public medal descriptions from hash-verified, pinned game source files.
 * Usage: node scripts/prepare-player-medal-details.mjs <source-directory>
 * Reads local game data only; performs no network or player-data requests.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createHash } from "node:crypto";

const commit = "ea96f3af75afe1d858f80ac13f212db218bc69ca";
const sourceFiles = [
  [
    "char.vromfs.bin_u/config/unlocks.blkx",
    "7d013a09cfc5561dc25a60e81b881b61af62ebbc4bb8f066b2514d0aa6e86f32",
  ],
  [
    "lang.vromfs.bin_u/lang/unlocks_medals.csv",
    "565f7d43dc3effd647ef9c20d5ab69af099b7eb7a54a8640524c53bdafb225f2",
  ],
  [
    "lang.vromfs.bin_u/lang/unlocks_conditions.csv",
    "039a9bd38010c245df0716debf1e194bcdf427254c93e8642a62d190a170ae92",
  ],
];
const countries = Object.fromEntries([
  ["usa", "美国"],
  ["germany", "德国"],
  ["ussr", "苏联"],
  ["britain", "英国"],
  ["japan", "日本"],
  ["china", "中国"],
  ["italy", "意大利"],
  ["france", "法国"],
  ["sweden", "瑞典"],
  ["israel", "以色列"],
]);
const units = {
  tank: "地面载具",
  aircraft: "航空载具",
  aircraft_only: "固定翼飞机",
  ship: "蓝水舰艇",
  boat: "近岸舰艇",
  typeTorpedoBoat: "鱼雷艇",
  typeDestroyer: "驱逐舰",
  type_light_tank: "轻型坦克",
  type_medium_tank: "中型坦克",
  type_heavy_tank: "重型坦克",
  type_tank_destroyer: "坦克歼击车",
  type_submarine_chaser: "猎潜艇",
  type_minelayer: "布雷艇",
  type_gun_boat: "炮艇",
  type_light_cruiser: "轻巡洋舰",
  type_heavy_cruiser: "重巡洋舰",
  type_battlecruiser: "战列巡洋舰",
  type_battleship: "战列舰",
  type_dive_bomber: "俯冲轰炸机",
  type_naval_aircraft: "海军航空载具",
};
const values = (value) => (Array.isArray(value) ? value : [value]);
const label = (value) =>
  values(value)
    .map((v) => countries[v.replace(/^country_/, "")] || units[v] || v)
    .join(" / ");
const need = (valid, message) => {
  if (!valid) throw Error(message);
};
const number = (value) => {
  need(Number.isSafeInteger(value) && value >= 0, "Invalid objective count");
  return value.toLocaleString("en-US");
};

function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ";" || c === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  need(!quoted, "Unclosed CSV quote");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function condition(c) {
  const t = c.type;
  const simple = {
    online: "在线战斗中完成",
    critical: "自身载具处于严重损伤状态",
    isBurning: "自身载具处于着火状态",
    inTurret: "使用机枪手视角",
    offenderIsSupportGun: "使用辅助武器",
    targetIsPlayer: "目标为玩家载具",
  };
  if (simple[t]) return simple[t];
  if (t === "playerHasFeature") {
    need(c.feature === "UnlocksUnavailableForChina", "Unknown feature gate");
    return null;
  }
  if (t === "activity") return `战斗活跃度至少 ${c.percent}%`;
  if (t === "minStat") {
    need(c.stat === "place" && new Set(c.value).size === 1, "Unsupported stat condition");
    return `队内名次前 ${c.value[0]} 名`;
  }
  if (
    [
      "offenderType",
      "playerType",
      "targetType",
      "offenderTag",
      "playerTag",
      "targetTag",
      "playerCountry",
    ].includes(t)
  ) {
    const field = ["unitType", "tag", "country"].find((key) => key in c);
    return `${t.startsWith("target") ? "目标" : "使用"}：${label(c[field])}${c.inSession ? "（本场出击载具范围）" : ""}`;
  }
  if (t === "location") return `指定地图之一（游戏地图 ID）：${values(c.location).join(" / ")}`;
  if (t === "weaponType") {
    need(c.weapon === "torpedo", "Unknown weapon type");
    return "使用鱼雷";
  }
  if (t === "targetDistance") return `目标距离条件：${c.distance} 米（距离判定方向以游戏内为准）`;
  if (["offenderUnitRank", "playerUnitRank"].includes(t)) {
    return `使用 ${c.minRank} 级或以上载具${c.inSession && c.inSessionAnd === false ? "（本场至少一辆出击载具满足）" : ""}`;
  }
  if (["playerUnitMRank", "offenderUnitMRank"].includes(t)) {
    const bounds = "maxMRank" in c ? `${c.minMRank ?? 0}–${c.maxMRank}` : `至少 ${c.minMRank}`;
    return `载具匹配等级：${bounds}（游戏内部编号，非界面 BR）`;
  }
  throw Error(`Unsupported medal condition: ${JSON.stringify(c)}`);
}

async function main(directory) {
  const sources = [],
    bodies = [];
  for (const [path, expected] of sourceFiles) {
    const body = await readFile(resolve(directory, basename(path)));
    need(
      createHash("sha256").update(body).digest("hex") === expected,
      `Source hash mismatch: ${path}`,
    );
    sources.push({
      path,
      url: `https://github.com/gszabi99/War-Thunder-Datamine/blob/${commit}/${path}`,
      sha256: expected,
      bytes: body.length,
    });
    bodies.push(body);
  }
  const unlocks = JSON.parse(bodies[0]).unlockable,
    index = new Map(unlocks.map((x) => [x.id, x]));
  const rows = parseCsv(bodies[1].toString("utf8").replace(/^\uFEFF/, ""));
  const zh = rows[0].indexOf("<Chinese>"),
    en = rows[0].indexOf("<English>");
  need(zh >= 0 && en >= 0, "Missing source languages");
  const locale = new Map(rows.slice(1).map((row) => [row[0], row]));
  const items = unlocks
    .filter((x) => x.type === "medal")
    .map((x) => {
      const m = x.mode || {},
        t = m.type,
        notes = [];
      const objectives = {
        killedPlayersScore: "击毁玩家载具",
        missionsWonScore: "获得胜利",
        missionsPlayedScore: "参加战斗",
        awardDamage: "对水面单位造成伤害",
        amountDamagesZone: "轰炸基地（千克）",
        killedGroundScore: "摧毁地面目标",
        captures: "占领据点",
      };
      let objective = null;
      if (objectives[t]) objective = `${objectives[t]}：累计 ${number(m.num)}`;
      else if (["unlockOpenCount", "unlockStageCount"].includes(t)) {
        const dependency = index.get(m.unlock),
          dm = dependency.mode;
        // The linked assist streak has a sentinel num=1005000. Its stage size,
        // combined with the medal's own num, gives the actual 300-assist target.
        if (dm.type === "assistPlayers" && t === "unlockStageCount") {
          need(dependency.stage.param === 1, "Unexpected assist stage size");
          objective = `累计协助击毁玩家载具 ${number(m.num)} 次`;
        } else if (dm.type === "killedPlayersBest") {
          objective = `获得单场玩家击毁榜第一且至少击毁 ${dm.minVal} 个目标的战斗奖励，累计 ${number(m.num)} 次`;
          if (dm.noDeaths) notes.push("对应奖励要求本场无阵亡。");
        } else if (dm.type === "killedAirBest") {
          objective = `获得单场空中击毁榜第一且至少达到 ${dm.minVal} 击毁进度的战斗奖励，累计 ${number(m.num)} 次`;
          notes.push(
            `该战斗奖励的击毁进度倍率：街机 ×${dm.mulArcade}、历史 ×${dm.mulRealistic}、全真 ×${dm.mulHardcore}。`,
          );
        } else throw Error(`Unsupported linked unlock: ${m.unlock}`);
        if (dm.includeBots) notes.push("对应战斗奖励的配置包含机器人目标。");
        notes.push(`关联战斗奖励：${m.unlock}。`);
      } else if (t === "char_player_era") {
        objective = `解锁${label(m.country)}${m.unitClass ? label(m.unitClass) : "载具"}的 ${m.era} 级`;
      } else if (t === "char_aircrafts_in_era") {
        objective = `购买 ${m.num} 辆 ${m.era} 级或以上的${label(m.country)}载具`;
        notes.push("此条件含高级载具适用标记，其具体范围尚未核实，请以游戏内为准。");
      } else if (t == null)
        notes.push("游戏配置未提供常规获取条件；不能据此判断目前是否仍可获取。");
      else throw Error(`Unsupported medal objective: ${t}`);
      const desc = locale.get(`${x.id}/desc`);
      return {
        id: x.id,
        country: x.country.replace(/^country_/, ""),
        objective,
        conditions: values(m.condition || [])
          .map(condition)
          .filter(Boolean),
        multipliers: Object.fromEntries(
          [
            ["ab", "mulArcade"],
            ["rb", "mulRealistic"],
            ["sb", "mulHardcore"],
          ]
            .filter(([, key]) => key in m)
            .map(([mode, key]) => [mode, m[key]]),
        ),
        description: desc ? desc[zh]?.trim() || desc[en]?.trim() || null : null,
        notes,
      };
    });
  const registry = JSON.parse(
    await readFile(new URL("../data/player-medal-images.json", import.meta.url), "utf8"),
  );
  need(
    JSON.stringify(items.map((x) => x.id).sort()) ===
      JSON.stringify(registry.items.map((x) => x.id).sort()),
    "Medal/image registry mismatch",
  );
  const output = {
    schemaVersion: 1,
    sourceCommit: commit,
    parserVersion: 1,
    semantics: "localized_game_configuration_outline_not_verbatim_game_ui",
    sources,
    items,
  };
  await writeFile(
    new URL("../data/player-medal-details.json", import.meta.url),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    `Prepared ${items.length} public medal details; ${items.filter((x) => x.objective === null).length} without a configured objective; ${items.filter((x) => x.description !== null).length} background descriptions.`,
  );
}
if (process.argv.length !== 3)
  throw Error("Usage: node scripts/prepare-player-medal-details.mjs <source-directory>");
await main(resolve(process.argv[2]));
