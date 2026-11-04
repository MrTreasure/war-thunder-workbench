import type { Vehicle, WikiPerformanceMetric, WikiGroundShell } from "./models";

export const VEHICLE_COMPARE_LIMIT = 5;
export interface ComparedVehicle {
  country: string;
  category: string;
  unit: Vehicle;
}
export const comparedVehicleKey = (entry: ComparedVehicle) => `${entry.country}:${entry.unit.id}`;
export function addComparedVehicle(entries: ComparedVehicle[], entry: ComparedVehicle) {
  if (
    entries.length >= VEHICLE_COMPARE_LIMIT ||
    (entries.length > 0 && entries[0].category !== entry.category) ||
    entries.some((value) => comparedVehicleKey(value) === comparedVehicleKey(entry))
  )
    return entries;
  return [...entries, entry];
}
export function removeComparedVehicles(entries: ComparedVehicle[], keys: ReadonlySet<string>) {
  return entries.filter((entry) => !keys.has(comparedVehicleKey(entry)));
}
/** Baseline is the first entry; preserve every other entry and its relative order. */
export function setComparedVehicleBaseline(entries: ComparedVehicle[], key: string) {
  const index = entries.findIndex((entry) => comparedVehicleKey(entry) === key);
  if (index <= 0) return entries;
  return [entries[index], ...entries.slice(0, index), ...entries.slice(index + 1)];
}
export function spadedValue(metric: WikiPerformanceMetric | undefined, mode: "ab" | "rb") {
  const value = metric?.modes[mode]?.spaded;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export const comparisonMetricKey = (metric: WikiPerformanceMetric) => `${metric.id}:${metric.unit}`;
export function comparisonMetrics(entries: ComparedVehicle[]) {
  const metrics = new Map<string, WikiPerformanceMetric>();
  for (const entry of entries) {
    const data = entry.unit.wikiDetails?.performance;
    if (data?.status !== "available") continue;
    for (const metric of data.metrics)
      if (!metrics.has(comparisonMetricKey(metric)))
        metrics.set(comparisonMetricKey(metric), metric);
  }
  return [...metrics.values()];
}
export function groundShells(unit: Vehicle) {
  const data = unit.wikiDetails?.performance?.groundCombat;
  return (data?.weaponsStatus === "available" ? data.weapons : []).flatMap((weapon) =>
    weapon.shells.map((shell) => ({ weapon, shell, key: `${weapon.id}:${shell.id}` })),
  );
}
export function shellPenetration(
  shell: WikiGroundShell | undefined,
  distanceM: number,
  angle: string,
) {
  if (!shell) return null;
  return angle === "source"
    ? (shell.penetration.find((point) => point.distanceM === distanceM)?.mm ?? null)
    : (shell.penetrationAngles.find(
        (point) => point.distanceM === distanceM && point.angleDeg === Number(angle),
      )?.mm ?? null);
}
