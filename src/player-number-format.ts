/** Compact game income; preserve the exact integer for titles/details. */
export function compactSilver(value: number | null | undefined): string {
  if (value == null || !Number.isSafeInteger(value) || value < 0) return "—";
  const integer = BigInt(value);
  if (integer < 10000n) return integer.toString();
  let divisor = integer >= 100000000n ? 100000000n : 10000n;
  let rounded = (integer * 100n + divisor / 2n) / divisor;
  // Rounding must not produce the awkward boundary "10000万".
  if (divisor === 10000n && rounded >= 1000000n) {
    divisor = 100000000n;
    rounded = (integer * 100n + divisor / 2n) / divisor;
  }
  const decimal = (rounded % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return (rounded / 100n).toString() + (decimal ? "." + decimal : "") + (divisor === 10000n ? "万" : "亿");
}

export type VehiclePresentation = "table" | "cards";
const VIEW_KEY = "wt-stats-vehicle-view-v1";
const SIZE_KEY = "wt-stats-vehicle-page-size-v1";
export function savedVehiclePresentation(): VehiclePresentation {
  try { return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table"; }
  catch { return "table"; }
}
export function saveVehiclePresentation(view: VehiclePresentation) {
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* Keep the in-memory choice. */ }
}
export function savedVehiclePageSize() {
  try {
    const value = Number(localStorage.getItem(SIZE_KEY));
    return [24, 48, 96].includes(value) ? value : 24;
  } catch { return 24; }
}
export function saveVehiclePageSize(size: number) {
  try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* Keep the current page size. */ }
}
