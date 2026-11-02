import type { WikiLoadoutOption, WikiWeaponParameter } from "./models";
import { weaponKey } from "./loadouts.ts";
export const missileComparisonLimit = 6;
export const missileBriefFields = [
  { id: "guidance", label: "制导方式" },
  { id: "lock-range-in-rear-aspect", label: "尾锁距离" },
  { id: "launch-range", label: "发射距离" },
] as const;
export const isComparableMissile = (option: Pick<WikiLoadoutOption, "name">) =>
  /\bmissiles?\b/i.test(option.name);
export function missileBrief(parameters: WikiWeaponParameter[]) {
  const value = (id: string) =>
    parameters.find((parameter) => parameter.id === id)?.value?.trim() || null;
  const lock = [
    { id: "lock-range-in-rear-aspect", label: "尾锁距离" },
    { id: "lock-range", label: "锁定距离" },
    { id: "lock-range-in-all-aspect", label: "全向锁定距离" },
  ].find((field) => value(field.id));
  return [missileBriefFields[0], ...(lock ? [lock] : []), missileBriefFields[2]]
    .map((field) => ({ ...field, value: value(field.id) }))
    .filter((field) => field.value !== null);
}
export type ComparedMissile = {
  key: string;
  name: string;
  imageUrl: string | null;
  parameters: WikiWeaponParameter[];
  source: string;
  checkedAt: string;
};
export function comparedMissile(
  option: WikiLoadoutOption,
  source: { source: string; checkedAt: string },
): ComparedMissile {
  return {
    key: weaponKey(option.name),
    name: option.name.normalize("NFKC").replace(/^\d+\s*×\s*/, ""),
    imageUrl: option.imageUrl || null,
    parameters: structuredClone(option.parameters),
    source: source.source,
    checkedAt: source.checkedAt,
  };
}
/** One specific missile model, irrespective of rack count. Unknown values stay unknown. */
export function selectComparedMissile(
  current: ComparedMissile[],
  item: ComparedMissile,
  selected: boolean,
) {
  if (!selected) return current.filter((old) => old.key !== item.key);
  if (current.some((old) => old.key === item.key) || current.length >= missileComparisonLimit)
    return current;
  return [...current, item];
}
export function missileComparisonRows(items: ComparedMissile[]) {
  const fields = new Map<string, string>();
  for (const field of missileBriefFields) fields.set(field.id, field.label);
  for (const item of items)
    for (const field of item.parameters)
      if (!fields.has(field.id)) fields.set(field.id, field.label);
  return [...fields].map(([id, label]) => ({
    id,
    label,
    values: items.map(
      (item) => item.parameters.find((field) => field.id === id)?.value?.trim() || null,
    ),
  }));
}
