import display from "../data/vehicle-equipment-display.json" with { type: "json" };
import type { Vehicle } from "./models";
const labels = display.labels as Record<string, string>;
const values = display.values as Record<string, string>;
export const equipmentLabel = (label: string) =>
  label
    .split(" · ")
    .map((part) => labels[part] || part)
    .join(" · ");
export function equipmentValue(value: string) {
  if (values[value]) return values[value];
  return value
    .replace(
      /\b(?:Yes|No|Separate antennas|Auto tracker|Thermal imager|Night vision device|Optics resolution)\b/g,
      (part) => values[part] || part,
    )
    .replace(/(\d+)\s+persons?\b/g, "$1 人");
}
export function equipmentParameter(unit: Vehicle, kind: string, parameter: string) {
  const data = unit.wikiDetails?.performance?.equipment;
  if (data?.status !== "available") return null;
  return (
    data.features
      .find((feature) => feature.kind === kind)
      ?.parameters.find((item) => item.id === parameter)?.value ?? null
  );
}
