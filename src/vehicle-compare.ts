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
const cleanWeapon = (name: string) =>
  name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const metricKind = (metric: WikiPerformanceMetric) =>
  metric.weaponName ? metric.id.replace(/-\d+$/, "") : metric.id;
export interface VehicleMetricRow {
  key: string;
  label: string;
  unit: string;
  direction?: WikiPerformanceMetric["direction"];
  metrics: (WikiPerformanceMetric | undefined)[];
}
/** Metric occurrence numbers are local to a page, not weapon identities. */
export function comparisonMetricRows(entries: ComparedVehicle[]) {
  const rows = new Map<string, VehicleMetricRow>();
  entries.forEach((entry, column) => {
    const data = entry.unit.wikiDetails?.performance;
    if (data?.status !== "available") return;
    const metrics = [...data.metrics];
    const combat = data.groundCombat;
    if (entry.category === "ground" && combat?.weaponsStatus === "available") {
      for (const weapon of combat.weapons)
        if (
          weapon.reload &&
          !metrics.some(
            (metric) =>
              metricKind(metric) === "reload" &&
              metric.unit === weapon.reload!.unit &&
              metric.weaponName &&
              cleanWeapon(metric.weaponName) === cleanWeapon(weapon.name),
          )
        ) {
          const at = metrics.findIndex(
            (metric) =>
              metric.weaponName && cleanWeapon(metric.weaponName) === cleanWeapon(weapon.name),
          );
          metrics.splice(at < 0 ? metrics.length : at, 0, weapon.reload);
        }
    }
    const weapons = [
      ...new Set([
        ...(combat?.weaponsStatus === "available"
          ? combat.weapons.map((weapon) => cleanWeapon(weapon.name))
          : []),
        ...metrics.flatMap((metric) => (metric.weaponName ? [cleanWeapon(metric.weaponName)] : [])),
      ]),
    ];
    function weaponRole(metric: WikiPerformanceMetric) {
      const name = cleanWeapon(metric.weaponName!);
      if (entry.category !== "ground") return { key: `named:${name}`, label: metric.weaponName! };
      const primary =
        /\s*·\s*武器1$/.test(metric.label) ||
        (!/\s*·\s*武器\d+$/.test(metric.label) && name === weapons[0]);
      const type = /\bmachine guns?\b/.test(name)
        ? "machine-gun"
        : /\b(?:cannons?|guns?|recoilless rifles?)\b/.test(name)
          ? "cannon"
          : /\b(?:missiles?|launchers?)\b/.test(name)
            ? "launcher"
            : /\bmortars?\b/.test(name)
              ? "mortar"
              : null;
      if (primary && type)
        return { key: `primary:${type}`, label: type === "cannon" ? "主炮" : "主武器" };
      if (type === "machine-gun") {
        const coaxial = /\bcoaxial\b/.test(name);
        const caliber = name.match(/\b(\d+(?:\.\d+)?)\s*mm\b/)?.[1];
        const group = coaxial ? "coaxial" : caliber ? `machine-gun:${caliber}` : `named:${name}`;
        const peers = weapons.filter(
          (weapon) =>
            /\bmachine guns?\b/.test(weapon) &&
            (coaxial
              ? /\bcoaxial\b/.test(weapon)
              : !/\bcoaxial\b/.test(weapon) &&
                weapon.match(/\b(\d+(?:\.\d+)?)\s*mm\b/)?.[1] === caliber),
        );
        // Multiple same-role mounts are not assumed interchangeable.
        if (peers.length > 1) return { key: `named:${name}`, label: metric.weaponName! };
        return {
          key: group,
          label: coaxial ? "同轴机枪" : caliber ? `${caliber} 毫米机枪` : "机枪",
        };
      }
      return { key: `named:${name}`, label: metric.weaponName! };
    }
    for (const metric of metrics) {
      const role = metric.weaponName ? weaponRole(metric) : null;
      const key = `${metricKind(metric)}:${metric.unit}${role ? ":" + role.key : ""}`;
      const label = metric.label.replace(/\s*·\s*武器\d+$/, "") + (role ? ` · ${role.label}` : "");
      if (!rows.has(key))
        rows.set(key, {
          key,
          label,
          unit: metric.unit,
          direction: metric.direction,
          metrics: Array(entries.length).fill(undefined),
        });
      const row = rows.get(key)!;
      if (!row.metrics[column]) row.metrics[column] = metric;
      else if (row.metrics[column] !== metric) {
        const separate = `${key}:source:${metric.id}:${metric.weaponName || ""}`;
        if (!rows.has(separate))
          rows.set(separate, {
            key: separate,
            label: metric.label,
            unit: metric.unit,
            direction: metric.direction,
            metrics: Array(entries.length).fill(undefined),
          });
        rows.get(separate)!.metrics[column] = metric;
      }
    }
  });
  return [...rows.values()];
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
