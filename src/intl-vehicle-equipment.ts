import { t } from "./i18n/core";
import { equipmentLabel as sourceLabel, equipmentValue as sourceValue } from "./vehicle-equipment";
import display from "../data/vehicle-equipment-display.json";
export { equipmentParameter } from "./vehicle-equipment";
export const equipmentLabel = (label: string) =>
  sourceLabel(label)
    .split(" · ")
    .map((part) => t(part))
    .join(" · ");
const terms = Object.values(display.values).sort((a, b) => b.length - a.length);
const pattern = new RegExp(
  terms.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);
export const equipmentValue = (value: string) =>
  sourceValue(value)
    .replace(pattern, (term) => t(term))
    .replace(/(\d+) 人/g, (_, count: string) => t("{0} 人", [count]));
