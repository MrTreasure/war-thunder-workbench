import { t, getLocale } from "./i18n/core";
import type { Mode, Vehicle } from "./models";
import { compactResearchPoints } from "./research-number-format";
export const modes: Record<Mode, string> = { ab: "街机", rb: "历史", sb: "全真" };
export const rating = (unit: { br?: Vehicle["br"] }, mode: Mode | "trb" | "tsb") => {
  const value = unit.br?.[mode];
  return typeof value === "number" && value >= 0 ? (value / 3 + 1).toFixed(1) : "—";
};
export const rpText = (unit: Vehicle) =>
  unit.rp === undefined
    ? t("研发点 —")
    : unit.rp === 0
      ? t("免费研发")
      : `${compactResearchPoints(unit.rp, getLocale())} RP`;
