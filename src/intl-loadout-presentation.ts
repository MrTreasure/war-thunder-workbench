import { t } from "./i18n/core";
import {
  loadoutWeaponName as sourceWeaponName,
  loadoutParameterValue as sourceParameterValue,
  matchesLoadoutText as sourceMatches,
  loadoutWeaponLabelWidth as sourceLabelWidth,
} from "./loadout-presentation";
export { loadoutRanks } from "./loadout-presentation";

// Share terminology matching with the Chinese workbench; localize display terms only.
export const loadoutWeaponName = (original: string) => sourceWeaponName(original, t);
export const loadoutParameterValue = (original: string) => sourceParameterValue(original, t);
export const matchesLoadoutText = (original: string, query: string) =>
  sourceMatches(original, query, t);
export const loadoutWeaponLabelWidth = (original: string) => sourceLabelWidth(original, t);
