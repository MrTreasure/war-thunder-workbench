import type { Profile } from "../../../src/models";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, maximum: number) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const ids = (value: unknown) =>
  Array.isArray(value) &&
  value.length <= 10000 &&
  value.every((id) => typeof id === "string" && id.length <= 256);
export function validPlan(value: unknown): value is Profile {
  if (!object(value)) return false;
  return (
    typeof value.target === "string" &&
    value.target.length <= 256 &&
    typeof value.price === "string" &&
    value.price.length <= 64 &&
    ids(value.owned) &&
    ids(value.pins) &&
    ids(value.banned) &&
    integer(value.progress, 10000000) &&
    integer(value.unlocked, 10) &&
    object(value.costs) &&
    Object.values(value.costs).every((v) => integer(v, 10000000)) &&
    object(value.gates) &&
    Object.values(value.gates).every((v) => integer(v, 99))
  );
}
