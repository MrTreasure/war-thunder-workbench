import type { LoadoutPlan } from "./loadouts";
import type { LoadoutShare } from "./loadout-shares";

/** Private names, document IDs, timestamps and station array order do not identify equipment. */
export const loadoutConfigurationKey = (plan: LoadoutPlan) =>
  JSON.stringify([
    plan.country,
    plan.vehicleId,
    plan.sourceHash,
    plan.preset,
    [...plan.mounts]
      .sort((a, b) => a.station.localeCompare(b.station))
      .map((mount) => [mount.station, mount.option]),
  ]);

export function loadoutLibrary(saved: LoadoutPlan[], shares: LoadoutShare[]) {
  const published = new Map<string, LoadoutShare[]>();
  for (const share of shares) {
    if (!share.listed) continue;
    const key = loadoutConfigurationKey(share.plan);
    published.set(key, [...(published.get(key) || []), share]);
  }
  const represented = new Set(saved.map(loadoutConfigurationKey));
  return [
    ...saved.map((plan) => ({
      plan,
      saved: true,
      recommendations: published.get(loadoutConfigurationKey(plan)) || [],
    })),
    ...[...published]
      .filter(([key]) => !represented.has(key))
      .map(([, recommendations]) => ({
        plan: recommendations[0].plan,
        saved: false,
        recommendations,
      })),
  ];
}
