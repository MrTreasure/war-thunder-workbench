import { lineupRatings } from "./lineups";
import type { BattleType, Lineup, LineupVehicle } from "./lineups";
import type { LineupRules, Mode } from "./models";

export type LineupSort = "saved" | "br-asc" | "br-desc";
export const lineupSearchText = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** A derived view never reorders the stored lineups or their crew slots. */
export function savedLineupEntries(
  saved: Lineup[],
  units: Map<string, LineupVehicle>,
  rules: LineupRules,
  mode: Mode,
) {
  return saved.map((lineup, index) => ({
    lineup,
    index,
    step: lineupRatings(lineup, units, rules).find((rating) => rating.mode === mode)?.step ?? null,
    search: lineupSearchText(
      [
        lineup.name,
        ...lineup.slots.flatMap((id) => {
          const unit = id ? units.get(id) : null;
          return id ? [id, unit?.name || "", unit?.nameEn || ""] : [];
        }),
      ].join(" "),
    ),
  }));
}
export function filterSavedLineups(
  entries: ReturnType<typeof savedLineupEntries>,
  filters: { search: string; battle: BattleType | ""; sort: LineupSort },
) {
  const needle = lineupSearchText(filters.search);
  return entries
    .filter(
      ({ lineup, search }) =>
        (!filters.battle || lineup.battleType === filters.battle) && search.includes(needle),
    )
    .sort((a, b) => {
      if (filters.sort === "saved") return a.index - b.index;
      if (a.step === null || b.step === null)
        return a.step === b.step ? a.index - b.index : a.step === null ? 1 : -1;
      return (filters.sort === "br-asc" ? a.step - b.step : b.step - a.step) || a.index - b.index;
    });
}
