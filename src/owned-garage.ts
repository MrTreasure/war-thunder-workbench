import type { GameBinding } from "./workspace-context";

/** Only complete, authenticated garage responses can update ownership. */
export type OwnedGarageSnapshot = {
  uid: string;
  fetchedAt: string;
  vehicles: { id: string; country: string; category: string | null }[];
  unmatchedCount: number;
};

/** An older binding projection must not undo a garage already read this session. */
export function preferOwnedBinding(remote: GameBinding | null, local: GameBinding | null) {
  if (!remote || !local || remote.uid !== local.uid) return remote;
  const incoming = Date.parse(remote.fetchedAt),
    current = Date.parse(local.fetchedAt);
  return Number.isFinite(current) && (!Number.isFinite(incoming) || current > incoming)
    ? local
    : remote;
}

export function mergeOwnedGarage(binding: GameBinding | null, garage: OwnedGarageSnapshot) {
  if (!binding || binding.uid !== garage.uid) return binding;
  const incoming = Date.parse(garage.fetchedAt),
    previous = Date.parse(binding.fetchedAt);
  if (!Number.isFinite(incoming) || (Number.isFinite(previous) && incoming < previous))
    return binding;
  const vehicles = [
    ...new Map(
      garage.vehicles.map((v) => [
        v.id,
        {
          id: v.id,
          country: v.country,
          category: v.category || "",
        },
      ]),
    ).values(),
  ];
  if (
    incoming === previous &&
    binding.unmatchedCount === garage.unmatchedCount &&
    JSON.stringify(binding.vehicles) === JSON.stringify(vehicles)
  )
    return binding;
  return {
    ...binding,
    fetchedAt: garage.fetchedAt,
    vehicles,
    unmatchedCount: garage.unmatchedCount,
  };
}
