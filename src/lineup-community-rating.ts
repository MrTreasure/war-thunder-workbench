import { lineupRatings } from "./lineups.ts";
import type { LineupVehicle } from "./lineups.ts";
import type { CommunityPost } from "./lineup-community-api";
import type { LineupRules } from "./models";

/** Published ratings are historical snapshots; visible vehicles use the current catalog. */
export function currentCommunityRating(
  post: Pick<CommunityPost, "id" | "slots" | "battle" | "mode" | "activeAircraft">,
  units: Map<string, LineupVehicle>,
  rules: LineupRules,
) {
  return lineupRatings(
    {
      id: post.id,
      name: "",
      slots: post.slots,
      battleType: post.battle,
      activeAircraft: post.activeAircraft || null,
    },
    units,
    rules,
  ).find((rating) => rating.mode === post.mode)!;
}
