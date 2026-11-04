import registry from "../data/player-vehicle-flags.json";
import assets from "../data/player-report-static-assets.json";
import policy from "../data/report-flag-policy.json";

type VehicleIdentity = { id: string; country: string | null };
type FlagAsset = { url: string; fallbackUrl: string };
type FlagInfo = { source: string; name?: string };

/** Apply the site's national flag policy before verified per-vehicle markings. */
export function reportVehicleFlag(vehicle: VehicleIdentity) {
  const sourceId = (registry.vehicles as Record<string, { flagId: string }>)[vehicle.id]?.flagId;
  const id =
    (policy.countryOverrides as Record<string, string>)[vehicle.country || ""] ||
    (policy.sourceFlagOverrides as Record<string, string>)[sourceId || ""] ||
    sourceId;
  // Outside explicit display policy, unknown vehicles must not inherit a guessed flag.
  if (!id) return null;
  const info = (registry.flags as Record<string, FlagInfo>)[id];
  const image = (assets.assets.flag as Record<string, FlagAsset>)[id];
  return info && image
    ? { id, name: info.name || id, url: image.url, fallbackUrl: image.fallbackUrl }
    : null;
}
