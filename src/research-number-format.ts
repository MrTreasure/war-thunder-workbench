/** Compact display only. Calculations and titles retain the original RP integer. */
export function compactResearchPoints(value: number, locale = "zh-CN"): string {
  if (!Number.isSafeInteger(value) || value < 0) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
