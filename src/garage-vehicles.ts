import type { OwnedVehicle } from "./player-rankings-api";
import type { PlayerVehicle } from "./player-stats-api";
/** Missing mode statistics stay unknown; ownership never implies invented battle counters. */
export function garageVehicleRecords(
  owned: OwnedVehicle[],
  records: PlayerVehicle[],
  mode: string,
  details: (Partial<PlayerVehicle> & Pick<PlayerVehicle, "id" | "mode">)[] = [],
): PlayerVehicle[] {
  const byId = new Map(records.filter((v) => v.mode === mode).map((v) => [v.id, v]));
  const extra = new Map(details.filter((v) => v.mode === mode).map((v) => [v.id, v]));
  return owned.map((v) => ({
    battles: null,
    wins: null,
    sorties: null,
    deaths: null,
    airKills: null,
    groundKills: null,
    navalKills: null,
    silverLions: null,
    winRate: null,
    knownKills: null,
    kd: null,
    airKd: null,
    groundKd: null,
    navalKd: null,
    kr: null,
    efficiency: null,
    smallSample: false,
    partialKills: false,
    ...byId.get(v.id),
    ...extra.get(v.id),
    id: v.id,
    name: v.name,
    country: v.country,
    category: v.category,
    rank: v.rank,
    mode,
    image: byId.get(v.id)?.image || v.image,
    thumbnail: v.thumbnail || v.image,
  }));
}
