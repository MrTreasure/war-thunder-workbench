import type { Vehicle } from "./models";
import model from "../data/armor-estimation.json" with { type: "json" };
export { model as armorEstimationModel };
export type ArmorPart = "hull" | "turret";
export type ArmorLayer = {
  id: string;
  thicknessMm: number | null;
  angleDeg: number | null;
  kineticFactor: number | null;
  chemicalFactor: number | null;
};
export function referenceArmorLayer(unit: Vehicle, part: ArmorPart): ArmorLayer {
  const combat = unit.wikiDetails?.performance?.groundCombat;
  const text =
    combat?.armorStatus === "available" ? combat.armor.find((row) => row.id === part)?.front : null;
  const thickness = text && /^\d+(?:\.\d+)?$/.test(text.trim()) ? Number(text.trim()) : null;
  return { id: "wiki-reference", thicknessMm: thickness, ...model.reference };
}
const bounded = (value: number | null, max: number) =>
  value !== null && Number.isFinite(value) && value >= 0 && value <= max;
/** User-specified passive-layer model only. No inferred ERA contribution, geometry or material. */
export function estimateArmor(layers: ArmorLayer[], kind: "kinetic" | "chemical") {
  if (!layers.length || layers.length > model.limits.layers) return null;
  let total = 0;
  for (const layer of layers) {
    const factor = kind === "kinetic" ? layer.kineticFactor : layer.chemicalFactor;
    if (
      !bounded(layer.thicknessMm, model.limits.thicknessMm) ||
      !bounded(layer.angleDeg, model.limits.angleDeg) ||
      !bounded(factor, model.limits.factor)
    )
      return null;
    total += (layer.thicknessMm! * factor!) / Math.cos((layer.angleDeg! * Math.PI) / 180);
  }
  return Number.isFinite(total) ? total : null;
}
