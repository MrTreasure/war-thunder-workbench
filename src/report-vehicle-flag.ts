import { t } from "./i18n/core";
import registry from "../data/player-vehicle-flags.json";
import assets from "../data/player-report-static-assets.json";

type VehicleIdentity = { id: string; country: string | null };
type FlagAsset = { url: string; fallbackUrl: string };
type FlagInfo = { source: string; name?: string };

/** Per-vehicle Wiki markings take precedence over research-tree filter aliases. */
export function reportVehicleFlag(vehicle: VehicleIdentity) {
  const id = (registry.vehicles as Record<string, { flagId: string }>)[vehicle.id]?.flagId;
  // An unverified vehicle must not inherit a guessed WWII/modern flag from its tree.
  if (!id) return null;
  const info = (registry.flags as Record<string, FlagInfo>)[id];
  const image = (assets.assets.flag as Record<string, FlagAsset>)[id];
  return info && image
    ? { id, name: t(info.name || id), url: image.url, fallbackUrl: image.fallbackUrl }
    : null;
}
