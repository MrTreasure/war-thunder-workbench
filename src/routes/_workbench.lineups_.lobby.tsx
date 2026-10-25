import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/lineups_/lobby")({
  codeSplitGroupings: [],
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    post?: string;
    country?: string;
    battle?: string;
    mode?: string;
    step?: string;
    tag?: string;
    sort?: string;
    mine?: string;
    page?: number;
  } => ({
    post:
      typeof search.post === "string" && /^L-[A-Za-z0-9_-]{6,40}$/.test(search.post)
        ? search.post
        : undefined,
    country: typeof search.country === "string" ? search.country : undefined,
    battle:
      typeof search.battle === "string" && ["ground", "air", "naval"].includes(search.battle)
        ? search.battle
        : undefined,
    mode:
      typeof search.mode === "string" && ["ab", "rb", "sb"].includes(search.mode)
        ? search.mode
        : undefined,
    step: search.step !== undefined ? String(search.step) : undefined,
    tag:
      typeof search.tag === "string" && /^[a-z-]{1,24}$/.test(search.tag) ? search.tag : undefined,
    sort: search.sort === "popular" ? "popular" : undefined,
    mine: String(search.mine) === "1" ? "1" : undefined,
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) > 0
        ? Number(search.page)
        : undefined,
  }),
  component: lazyRouteComponent(() => import("../LineupLobby"), "LineupLobby"),
});
