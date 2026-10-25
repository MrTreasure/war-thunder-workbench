import type { CountryPayload, LineupRules, Mode, Vehicle } from "./models";
import { indexTree } from "./planner";
import { object } from "./validation";
export type BattleType = "air" | "ground" | "naval";
export interface Lineup {
  id: string;
  name: string;
  slots: (string | null)[];
  battleType: BattleType;
  activeAircraft: string | null;
}
export interface LineupVehicle extends Vehicle {
  category: string;
}
export function lineupVehicleKind(unit: Vehicle) {
  if (unit.side === "research") return "research";
  if (["pack", "squadron", "market"].includes(unit.kind)) return unit.kind;
  if (unit.premium) return "premium";
  return "special";
}
export function lineupIndex(payload: CountryPayload | null) {
  const result = new Map<string, LineupVehicle>();
  if (payload)
    for (const [category, tree] of Object.entries(payload.trees))
      for (const unit of indexTree(tree).units.values()) result.set(unit.id, { ...unit, category });
  return result;
}
export function validLineups(value: unknown, maxSlots: number): value is Lineup[] {
  return (
    Array.isArray(value) &&
    new Set(value.map((v) => (object(v) ? v.id : null))).size === value.length &&
    value.every(
      (row) =>
        object(row) &&
        typeof row.id === "string" &&
        row.id.length > 0 &&
        typeof row.name === "string" &&
        row.name.length <= 80 &&
        ["air", "ground", "naval"].includes(String(row.battleType)) &&
        (row.activeAircraft === null || typeof row.activeAircraft === "string") &&
        Array.isArray(row.slots) &&
        row.slots.length === maxSlots &&
        row.slots.every((id) => id === null || (typeof id === "string" && id.length > 0)) &&
        new Set(row.slots.filter(Boolean)).size === row.slots.filter(Boolean).length,
    )
  );
}
export function shareCountry(raw: string, rules: LineupRules) {
  const code = raw.trim();
  if (code.length !== 2 + rules.maxSlots * 2 || [...code].some((c) => !rules.alphabet.includes(c)))
    throw Error(`分享码必须是 ${2 + rules.maxSlots * 2} 位数字及大小写字母，请检查长度和空格。`);
  const country = Object.entries(rules.countryCodes).find(
    ([, prefix]) => prefix === code.slice(0, 2),
  )?.[0];
  if (!country) throw Error("国家码不存在，请保留分享码的原始大小写。");
  return country;
}
export function encodeLineup(
  country: string,
  slots: (string | null)[],
  codes: Record<string, string>,
  rules: LineupRules,
) {
  if (slots.length > rules.maxSlots) throw Error("载具数量超过队列槽位上限。");
  const reverse = new Map(Object.entries(codes).map(([code, id]) => [id, code]));
  const prefix = rules.countryCodes[country];
  if (!prefix) throw Error("国家不存在。");
  if (new Set(slots.filter(Boolean)).size !== slots.filter(Boolean).length)
    throw Error("同一载具不能占用多个槽位。");
  return (
    prefix +
    Array.from({ length: rules.maxSlots }, (_, i) => {
      const id = slots[i];
      if (!id) return rules.emptyCode;
      const code = reverse.get(id);
      if (!code) throw Error(`载具 ${id} 尚无稳定编码，暂不能导出。`);
      return code;
    }).join("")
  );
}
export function decodeLineup(
  raw: string,
  country: string,
  codes: Record<string, string>,
  rules: LineupRules,
) {
  if (shareCountry(raw, rules) !== country) throw Error("请先读取分享码对应国家的资料。");
  const code = raw.trim();
  const slots = Array.from({ length: rules.maxSlots }, (_, i) => {
    const pair = code.slice(2 + i * 2, 4 + i * 2);
    if (pair === rules.emptyCode) return null;
    if (!Object.hasOwn(codes, pair))
      throw Error(`槽位 ${i + 1} 的编码 ${pair} 不存在，请检查大小写或更新资料。`);
    return codes[pair];
  });
  if (new Set(slots.filter(Boolean)).size !== slots.filter(Boolean).length)
    throw Error("分享码包含重复载具，请检查编码。");
  return slots;
}
export function inferBattle(
  slots: (string | null)[],
  units: Map<string, LineupVehicle>,
): BattleType {
  const categories = slots.map((id) => (id ? units.get(id)?.category : null));
  return categories.some((category) => category === "ground" || category === "helicopters")
    ? "ground"
    : categories.some((c) => c === "ships" || c === "boats")
      ? "naval"
      : "air";
}
export function vehicleStep(unit: LineupVehicle, battleType: BattleType, mode: Mode) {
  const key =
    battleType === "ground" && unit.category === "aviation" && mode !== "ab"
      ? mode === "rb"
        ? "trb"
        : "tsb"
      : mode;
  const value = unit.br[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export const brLabel = (step: number | null) => (step === null ? "—" : (1 + step / 3).toFixed(1));
/** Display only ratings relevant to the chosen lineup; excluded categories stay unknown. */
export function lineupCardRating(unit: LineupVehicle, battleType: BattleType, mode: Mode) {
  if (
    (battleType === "ground" && mode === "ab" && unit.category !== "ground") ||
    (battleType === "air" && unit.category !== "aviation") ||
    (battleType === "naval" && !["ships", "boats", "aviation"].includes(unit.category))
  )
    return "—";
  return brLabel(vehicleStep(unit, battleType, mode));
}
export function arcadeAverage(steps: number[], rules: LineupRules) {
  const sorted = [...steps].sort((a, b) => b - a).slice(0, 3);
  if (!sorted.length) return null;
  const [a] = sorted;
  if (sorted.length === 1) return a;
  const b = Math.max(sorted[1], a - rules.airArcadeGapSteps);
  const raw =
    sorted.length === 2
      ? (a + b) / 2
      : (2 * a + b + Math.max(sorted[2], a - rules.airArcadeGapSteps)) / 4;
  return Math.max(0, a - rules.airArcadeMaxReductionSteps, Math.floor(raw + 0.5));
}
export interface LineupRating {
  mode: Mode;
  step: number | null;
  label: string;
  note: string;
  excluded: string[];
}
export function lineupRatings(
  lineup: Lineup,
  units: Map<string, LineupVehicle>,
  rules: LineupRules,
): LineupRating[] {
  const ids = lineup.slots.filter((id): id is string => Boolean(id));
  const missing = ids.filter((id) => !units.has(id));
  const selected = ids.flatMap((id) => (units.has(id) ? [units.get(id)!] : []));
  return (["ab", "rb", "sb"] as Mode[]).map((mode) => {
    const result = (
      step: number | null,
      label: string,
      note: string,
      excluded: string[] = [],
    ): LineupRating => ({ mode, step, label, note, excluded });
    if (missing.length)
      return result(null, "资料待更新", "队列中有当前资料无法识别的载具，暂不计算权重。");
    if (!selected.length) return result(null, "未配置", "选择载具后显示队列权重。");
    if (mode === "sb") {
      if (lineup.battleType === "naval")
        return result(null, "无此模式", "海战无普通 SB 匹配；海战持续对抗另按房间规则。");
      if (lineup.battleType === "ground")
        return result(
          null,
          "按活动名单",
          "陆战 SB 不按队列最高 BR 匹配，需核对当前活动允许载具名单。",
        );
      const aircraft = selected.filter((u) => u.category === "aviation");
      if (!aircraft.length) return result(null, "无可用飞机", "空战需要至少一架飞机。");
      const steps = aircraft.map((u) => vehicleStep(u, "air", "sb"));
      if (steps.some((v) => v === null))
        return result(null, "权重未知", "有飞机缺少 SB 权重，请更新资料。");
      return result(
        null,
        "按房间范围",
        `飞机 SB ${brLabel(Math.min(...(steps as number[])))}～${brLabel(Math.max(...(steps as number[])))}；至少一架满足房间必需范围，其余需在允许范围内。`,
      );
    }
    const relevant = selected.filter((unit) =>
      lineup.battleType === "air"
        ? unit.category === "aviation"
        : lineup.battleType === "ground"
          ? unit.category === "ground" ||
            (mode === "rb" && ["aviation", "helicopters"].includes(unit.category))
          : ["ships", "boats", "aviation"].includes(unit.category),
    );
    const excluded = selected.filter((u) => !relevant.includes(u)).map((u) => u.id);
    const core = relevant.filter((u) =>
      lineup.battleType === "ground"
        ? u.category === "ground"
        : lineup.battleType === "naval"
          ? u.category === "ships" || u.category === "boats"
          : u.category === "aviation",
    );
    if (!core.length)
      return result(
        null,
        "缺少主战载具",
        lineup.battleType === "ground" && selected.some((u) => u.category === "helicopters")
          ? "此处估算陆战混合队列，请加入地面载具；直升机 PVE 等独立玩法不在此处估算。"
          : "请配置与当前战斗类型对应的飞机、地面载具或舰艇。",
        excluded,
      );
    let usable = relevant;
    if (lineup.battleType === "naval") {
      const ships = core.map((u) => vehicleStep(u, "naval", mode));
      if (ships.some((v) => v === null))
        return result(null, "权重未知", "有舰艇缺少该模式权重。", excluded);
      const ceiling = Math.max(...(ships as number[])) + rules.navalAircraftMaxExtraSteps;
      for (const u of relevant.filter((u) => u.category === "aviation")) {
        const step = vehicleStep(u, "naval", mode);
        if (step !== null && step > ceiling) excluded.push(u.id);
      }
      usable = relevant.filter((u) => !excluded.includes(u.id));
    }
    if (lineup.battleType === "air" && mode === "rb") {
      const active = usable.find((u) => u.id === lineup.activeAircraft);
      if (!active) return result(null, "请选择出击飞机", "空战 RB 仅按实际出击飞机的权重匹配。");
      const step = vehicleStep(active, "air", mode);
      return result(
        step,
        step === null ? "权重未知" : brLabel(step),
        `仅计算 ${active.name}；其他槽位不参与空战 RB 匹配。`,
        selected.filter((u) => u.id !== active.id).map((u) => u.id),
      );
    }
    const steps = usable.map((u) => vehicleStep(u, lineup.battleType, mode));
    if (steps.some((v) => v === null))
      return result(null, "权重未知", "有可用载具缺少该模式权重，请更新资料。", excluded);
    const step =
      lineup.battleType === "air"
        ? arcadeAverage(steps as number[], rules)
        : Math.max(...(steps as number[]));
    return result(
      step,
      brLabel(step),
      lineup.battleType === "air"
        ? "前三架加权；两架取均值，单架取自身；最多下调一档。"
        : lineup.battleType === "ground"
          ? mode === "ab"
            ? "仅地面载具取最高权重，机库固定翼飞机和直升机不参与陆战 AB。"
            : "地面载具、固定翼飞机与直升机取最高权重；固定翼采用陆战 RB 权重，直升机采用 RB 权重。"
          : "可用舰艇与飞机取最高权重；超过最高舰艇一档的飞机不计入且不可出击。",
      excluded,
    );
  });
}

export function moveLineupSlot(slots: (string | null)[], from: number, to: number) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= slots.length ||
    to >= slots.length ||
    from === to
  )
    return [...slots];
  const result = [...slots];
  const [value] = result.splice(from, 1);
  result.splice(to, 0, value);
  return result;
}
