import { statsRequest } from "./player-stats-api";
const preview = import.meta.env.VITE_WT_CATALOG_SOURCE === "preview";
export const loadoutPath = (suffix: string) =>
  preview ? `map-data-preview/loadouts/${suffix}` : `loadouts/${suffix}`;
export const loadoutRequest = <T>(suffix: string, body?: unknown, signal?: AbortSignal) =>
  statsRequest<T>(loadoutPath(suffix), body, signal);
export const isolatedLoadoutPreview = preview;
