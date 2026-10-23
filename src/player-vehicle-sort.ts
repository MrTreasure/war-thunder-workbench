import { getLocale } from "./i18n/core";
import type { PlayerVehicle } from "./player-stats-api";
export type VehicleSortKey =
  | "battles"
  | "winRate"
  | "airKd"
  | "groundKd"
  | "navalKd"
  | "kd"
  | "efficiency"
  | "silverLions";
export type VehicleSort = { key: VehicleSortKey; direction: "asc" | "desc" };
const collators = {
  "zh-CN": new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" }),
  en: new Intl.Collator("en", { numeric: true, sensitivity: "base" }),
  ru: new Intl.Collator("ru", { numeric: true, sensitivity: "base" }),
  ja: new Intl.Collator("ja", { numeric: true, sensitivity: "base" }),
};
export function comparePlayerVehicles(a: PlayerVehicle, b: PlayerVehicle, sort: VehicleSort) {
  const collator = collators[getLocale()];
  const raw = (v: PlayerVehicle) =>
    sort.key === "navalKd" && v.category === "ground" ? null : v[sort.key];
  const left = raw(a),
    right = raw(b);
  // Missing values stay last in both directions; infinity is a known highest ratio.
  if (left == null || right == null)
    return left == null && right == null ? collator.compare(a.id, b.id) : left == null ? 1 : -1;
  const l = left === "∞" ? Infinity : left,
    r = right === "∞" ? Infinity : right;
  const result =
    typeof l === "string" && typeof r === "string"
      ? collator.compare(l, r)
      : l === r
        ? 0
        : l < r
          ? -1
          : 1;
  return result ? result * (sort.direction === "asc" ? 1 : -1) : collator.compare(a.id, b.id);
}
