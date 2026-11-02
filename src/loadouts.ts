import { sha256 } from "@noble/hashes/sha2.js";
import type { WikiLoadouts, WikiLoadoutOption } from "./models";
import rules from "../data/loadout-rules.json" with { type: "json" };

export type Mount = { station: string; option: string };
export type LoadoutPlan = {
  schemaVersion: 1;
  id: string;
  name: string;
  country: string;
  vehicleId: string;
  sourceHash: string;
  sourceDate: string;
  mounts: Mount[];
  preset: string | null;
  updatedAt: string;
};
export type Requirement = { weapon: string; count: number };
export type LoadoutIssue = { code: string; message: string; stations: string[] };
export type LoadoutCheck = {
  issues: LoadoutIssue[];
  weightKg: number | null;
  leftKg: number | null;
  rightKg: number | null;
  weapons: { key: string; name: string; count: number }[];
  limitations: string[];
};
export const loadoutKey = "wt-loadouts-v1";
export const stationLoadoutOptions = (data: WikiLoadouts, station: string) =>
  data.compatibility.filter((option) =>
    option.stations.some((entry) => entry.hardpointId === station),
  );
export const hasConfigurableLoadout = (data?: WikiLoadouts) =>
  !!data &&
  data.status === "available" &&
  (data.hardpoints.some((point) => stationLoadoutOptions(data, point.id).length > 0) ||
    data.presets.some((preset) =>
      preset.items.some((item) => item.count === null || item.count > 0),
    ));
const clean = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
export const weaponKey = (name: string) =>
  clean(name)
    .replace(/^\d+\s*×\s*/, "")
    .toLowerCase();
// Content identity survives table reordering. Different rack weights remain distinct;
// changed source configurations require an explicit recheck rather than a guessed match.
const optionKeys = new WeakMap<WikiLoadoutOption, string>();
export const optionKey = (option: WikiLoadoutOption) => {
  const old = optionKeys.get(option);
  if (old) return old;
  const body = JSON.stringify([
    clean(option.name),
    option.count ?? 1,
    option.source || "",
    option.weightKg,
    option.imageUrl || "",
  ]);
  const key =
    "o1:" +
    [...sha256(new TextEncoder().encode(body))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  optionKeys.set(option, key);
  return key;
};
const revisionKeys = new WeakMap<WikiLoadouts, string>();
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  return value;
}
/** Includes normalized rules as well as the page hash, so rule-only updates
 * also prompt a recheck of an in-progress configuration. */
export function loadoutRevision(data: WikiLoadouts) {
  const old = revisionKeys.get(data);
  if (old) return old;
  const key = [...sha256(new TextEncoder().encode(JSON.stringify(canonicalValue(data))))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  revisionKeys.set(data, key);
  return key;
}
export const presetKey = (preset: WikiLoadouts["presets"][number]) =>
  JSON.stringify(preset.items.map((item) => [clean(item.name), item.count, item.source || ""]));

export function validLoadoutPlan(value: unknown): value is LoadoutPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as LoadoutPlan;
  return (
    p.schemaVersion === 1 &&
    typeof p.id === "string" &&
    p.id.length > 0 &&
    p.id.length <= 100 &&
    typeof p.name === "string" &&
    p.name.trim().length > 0 &&
    p.name.length <= 80 &&
    typeof p.country === "string" &&
    /^(usa|germany|ussr|britain|japan|italy|france|china|sweden|israel)$/.test(p.country) &&
    typeof p.vehicleId === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(p.vehicleId) &&
    typeof p.sourceHash === "string" &&
    /^[a-f0-9]{64}$/.test(p.sourceHash) &&
    typeof p.sourceDate === "string" &&
    Number.isFinite(Date.parse(p.sourceDate)) &&
    typeof p.updatedAt === "string" &&
    Number.isFinite(Date.parse(p.updatedAt)) &&
    (p.preset === null || (typeof p.preset === "string" && p.preset.length <= 16000)) &&
    Array.isArray(p.mounts) &&
    p.mounts.length <= 64 &&
    new Set(p.mounts.map((m) => m?.station)).size === p.mounts.length &&
    p.mounts.every(
      (m) =>
        m &&
        typeof m.station === "string" &&
        /^t\d+-s\d+$/.test(m.station) &&
        typeof m.option === "string" &&
        m.option.length <= 1000,
    ) &&
    !(p.preset !== null && p.mounts.length)
  );
}
export const validLoadoutPlans = (value: unknown): value is LoadoutPlan[] =>
  Array.isArray(value) &&
  value.length <= 100 &&
  value.every(validLoadoutPlan) &&
  new Set(value.map((p) => p.id)).size === value.length;

export function checkLoadout(
  data: WikiLoadouts,
  mounts: Mount[],
  preset: string | null = null,
): LoadoutCheck {
  const issues: LoadoutIssue[] = [];
  const summary = new Map<string, { key: string; name: string; count: number }>();
  let weight = 0,
    left = 0,
    right = 0;
  let unknownWeight = false,
    unknownSide = false;
  const addWeapon = (name: string, count: number | null) => {
    if (count === null) return;
    const key = weaponKey(name),
      old = summary.get(key);
    summary.set(key, {
      key,
      name: clean(name).replace(/^\d+\s*×\s*/, ""),
      count: (old?.count || 0) + count,
    });
  };
  if (data.status !== "available")
    issues.push({ code: "missing-data", message: "该机挂载资料尚不完整。", stations: [] });
  if (preset !== null) {
    const selected = data.presets.find((p) => presetKey(p) === preset);
    if (!selected || mounts.length)
      issues.push({
        code: "missing-preset",
        message: "原预设已变化，请重新选择；未修改原方案。",
        stations: [],
      });
    else selected.items.forEach((item) => addWeapon(item.name, item.count));
    return {
      issues,
      weightKg: null,
      leftKg: null,
      rightKg: null,
      weapons: [...summary.values()],
      limitations: ["预设重量未提供。", "个人配件解锁状态尚未接入。"],
    };
  }
  if (data.presets.length && !data.hardpoints.length)
    issues.push({ code: "choose-preset", message: "请选用该机已有预设。", stations: [] });
  const seen = new Set<string>();
  for (const mount of mounts) {
    if (seen.has(mount.station))
      issues.push({
        code: "occupied",
        message: "同一挂点存在重复装配。",
        stations: [mount.station],
      });
    seen.add(mount.station);
    const point = data.hardpoints.find((p) => p.id === mount.station);
    const options = data.compatibility.filter(
      (o) =>
        optionKey(o) === mount.option && o.stations.some((s) => s.hardpointId === mount.station),
    );
    if (!point || options.length === 0) {
      issues.push({
        code: "missing-option",
        message: `挂点 ${point?.label || mount.station} 的原配置已失效或存在歧义，请重新选择。`,
        stations: [mount.station],
      });
      unknownWeight = true;
      continue;
    }
    const option = options[0],
      station = option.stations.find((s) => s.hardpointId === mount.station)!;
    addWeapon(option.name, station.count);
    const baseCount = option.count ?? 1;
    const kg =
      option.weightKg === null || station.count === null || baseCount <= 0
        ? null
        : (option.weightKg * station.count) / baseCount;
    if (kg === null) unknownWeight = true;
    else {
      // Integer grams prevent cumulative binary rounding at weight boundaries.
      const grams = Math.round(kg * 1000);
      weight += grams;
      if (point.side === "left") left += grams;
      else if (point.side === "right") right += grams;
      else if (point.side !== "center") unknownSide = true;
    }
  }
  if (!unknownWeight) {
    for (const limit of data.limits) {
      if (limit.value === null || limit.unit !== "kg") continue;
      const max = Math.round(limit.value * 1000);
      const exceeded =
        limit.id === "max-weight"
          ? weight > max
          : !unknownSide &&
            (limit.id === "wing-maximum"
              ? Math.max(left, right) > max
              : limit.id === "wing-max-difference" && Math.abs(left - right) > max);
      if (exceeded)
        issues.push({
          code: limit.id,
          message: `${limit.label}超过 ${limit.value.toLocaleString()} kg。`,
          stations: mounts.map((m) => m.station),
        });
    }
  }
  for (const rule of data.rules ||
    rules.vehicles[data.vehicleId as keyof typeof rules.vehicles] ||
    []) {
    const matching = rule.weapons.map((name) =>
      mounts.filter((m) => {
        const option = data.compatibility.find((o) => optionKey(o) === m.option);
        return option && weaponKey(option.name) === weaponKey(name);
      }),
    );
    if (matching.every((group) => group.length))
      issues.push({
        code: rule.id,
        message: rule.message,
        stations: matching.flat().map((m) => m.station),
      });
  }
  return {
    issues,
    weightKg: unknownWeight ? null : weight / 1000,
    leftKg: unknownWeight || unknownSide ? null : left / 1000,
    rightKg: unknownWeight || unknownSide ? null : right / 1000,
    weapons: [...summary.values()],
    limitations: [
      "Wiki 挂点与已收录规则已检查，其他跨挂点限制仍可能未公开。",
      "个人配件解锁状态尚未接入。",
      ...(unknownWeight ? ["部分挂载重量未知。"] : []),
    ],
  };
}

/** Exact assignment for known constraints. A time limit is distinct from no solution. */
export function solveLoadout(
  data: WikiLoadouts,
  requirements: Requirement[],
  budget = 30000,
):
  | { state: "found"; mounts: Mount[]; preset: string | null }
  | { state: "unmatched" | "incomplete" | "budget" } {
  if (data.status !== "available") return { state: "incomplete" };
  const needs = requirements.filter((r) => r.count > 0);
  if (
    !needs.length ||
    needs.length > 12 ||
    needs.some((r) => !Number.isSafeInteger(r.count) || r.count > 10000)
  )
    return { state: "unmatched" };
  if (
    (data.rules || []).some(
      (rule) =>
        rule.kind === "exclusive" &&
        rule.weapons.every((name) => needs.some((need) => need.weapon === weaponKey(name))),
    )
  )
    return { state: "unmatched" };
  if (!data.hardpoints.length) {
    for (const preset of data.presets) {
      const check = checkLoadout(data, [], presetKey(preset));
      if (
        !check.issues.length &&
        needs.every((r) => (check.weapons.find((w) => w.key === r.weapon)?.count || 0) >= r.count)
      )
        return { state: "found", mounts: [], preset: presetKey(preset) };
    }
    return { state: data.presets.length ? "unmatched" : "incomplete" };
  }
  const balanceRequired = data.limits.some(
    (limit) => limit.id === "wing-max-difference" && limit.value !== null && limit.unit === "kg",
  );
  const needed = (option: WikiLoadoutOption) =>
    needs.some((r) => r.weapon === weaponKey(option.name));
  const slots = data.hardpoints
    .map((point) => ({
      point,
      choices: data.compatibility.filter(
        (o) =>
          (needed(o) || balanceRequired) &&
          o.stations.some((s) => s.hardpointId === point.id && s.count !== null),
      ),
    }))
    .filter((s) => s.choices.length)
    .sort((a, b) => a.choices.length - b.choices.length);
  let visits = 0,
    unresolved = false;
  const search = (index: number, mounts: Mount[]): Mount[] | null => {
    if (++visits > budget) return null;
    const check = checkLoadout(data, mounts);
    // Wing imbalance is not monotone: a later mount may rebalance it.
    if (check.issues.some((i) => i.code !== "wing-max-difference")) return null;
    const missing = needs.filter(
      (r) => (check.weapons.find((w) => w.key === r.weapon)?.count || 0) < r.count,
    );
    if (!missing.length && !check.issues.length) {
      if (check.weightKg === null) {
        unresolved = true;
        return null;
      }
      return mounts;
    }
    if (index >= slots.length || visits > budget) return null;
    for (const need of missing) {
      let capacity = check.weapons.find((w) => w.key === need.weapon)?.count || 0;
      for (const slot of slots.slice(index))
        capacity += Math.max(
          0,
          ...slot.choices
            .filter((o) => weaponKey(o.name) === need.weapon)
            .map((o) => o.stations.find((s) => s.hardpointId === slot.point.id)!.count || 0),
        );
      if (capacity < need.count) return null;
    }
    const slot = slots[index];
    // Empty precedes optional ballast; requested weapons are attempted first.
    const choices = [
      ...slot.choices.filter(needed),
      null,
      ...slot.choices.filter((o) => !needed(o)),
    ];
    for (const option of choices) {
      const result = search(index + 1, [
        ...mounts,
        ...(option ? [{ station: slot.point.id, option: optionKey(option) }] : []),
      ]);
      if (result) return result;
      if (visits > budget) break;
    }
    return null;
  };
  const result = search(0, []);
  return result
    ? { state: "found", mounts: result, preset: null }
    : { state: visits > budget ? "budget" : unresolved ? "incomplete" : "unmatched" };
}

const SHARE_MAX = 80000;
export async function encodeLoadout(plan: LoadoutPlan) {
  if (!validLoadoutPlan(plan)) throw Error("挂载方案格式不正确。");
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = [...digest]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  const encoded = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const code = `WTL1.${hash}.${encoded}`;
  if (code.length > SHARE_MAX) throw Error("方案过长，请使用文件导出。");
  return code;
}
export async function decodeLoadout(code: string): Promise<LoadoutPlan> {
  if (code.length > SHARE_MAX) throw Error("分享内容超过上限。");
  const match = /^WTL1\.([a-f0-9]{24})\.([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!match) throw Error("不是有效的挂载分享码。");
  const bytes = Uint8Array.from(atob(match[2].replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  if (hash !== match[1]) throw Error("分享内容校验失败，请重新复制。");
  const plan: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!validLoadoutPlan(plan)) throw Error("挂载方案字段不完整或超过限制。");
  return plan;
}
