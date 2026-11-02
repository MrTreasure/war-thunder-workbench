import type { MapRoute } from "./map-data-api";
import { isMapGuideSourceURL } from "./map-route-sources.ts";

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validMapRoute(v: unknown): v is MapRoute {
  if (
    !record(v) ||
    !id(v.id) ||
    (v.routeId !== undefined && v.routeId !== v.id) ||
    !id(v.mapId) ||
    !id(v.layoutId) ||
    ![1, 2].includes(Number(v.team)) ||
    !Array.isArray(v.matrix) ||
    v.matrix.length !== 6 ||
    !v.matrix.every(finite) ||
    !finite(v.width) ||
    v.width <= 0 ||
    !finite(v.height) ||
    v.height <= 0 ||
    typeof v.sourceUrl !== "string" ||
    !isMapGuideSourceURL(v.sourceUrl) ||
    (v.sourceTitle !== undefined &&
      (typeof v.sourceTitle !== "string" ||
        !v.sourceTitle.trim() ||
        v.sourceTitle.length > 1000)) ||
    (v.guideVersion !== undefined &&
      (!Number.isInteger(v.guideVersion) || Number(v.guideVersion) < 1)) ||
    (v.tacticsMarkdown !== undefined &&
      (typeof v.tacticsMarkdown !== "string" || v.tacticsMarkdown.length > 32000)) ||
    (v.sourceSummary !== undefined &&
      (typeof v.sourceSummary !== "string" || v.sourceSummary.length > 1000)) ||
    (v.sourceData !== undefined && !record(v.sourceData)) ||
    (v.spawnSide !== undefined && (typeof v.spawnSide !== "string" || v.spawnSide.length > 100)) ||
    (v.side !== undefined &&
      !(Number.isInteger(v.side) && Number(v.side) >= 1 && Number(v.side) <= 100) &&
      (typeof v.side !== "string" || v.side.length > 100)) ||
    (v.sourceVersion !== undefined &&
      (typeof v.sourceVersion !== "string" || v.sourceVersion.length > 100)) ||
    (v.evidenceStatus !== undefined &&
      (typeof v.evidenceStatus !== "string" || v.evidenceStatus.length > 100)) ||
    (v.sourceTimes !== undefined &&
      (!Array.isArray(v.sourceTimes) ||
        !v.sourceTimes.every((n: unknown) => finite(n) && n >= 0))) ||
    !record(v.svg)
  )
    return false;
  return (
    v.matrix[0] * v.matrix[3] - v.matrix[1] * v.matrix[2] > 0 &&
    digest(v.svg.sha256) &&
    v.svg.path === `map-guides/assets/${v.svg.sha256}.svg` &&
    finite(v.svg.bytes) &&
    v.svg.bytes > 0 &&
    v.svg.bytes <= 262144
  );
}
