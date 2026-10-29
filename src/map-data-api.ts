import type bundledAtlas from "../data/ground-maps.json";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import settings from "./config/player-stats.json";
import { statsHeaders } from "./player-stats-api";

export type GroundAtlas = typeof bundledAtlas;
export type GroundMap = GroundAtlas["maps"][number];
export type MapSnapshot = { releaseId: string; atlas: GroundAtlas };
export type MapRoute = {
  id: string;
  mapId: string;
  layoutId: string;
  team: number;
  title: string;
  label: string;
  sourceUrl: string;
  sourceDate: string;
  width: number;
  height: number;
  matrix: number[];
  pointError: number;
  svg: { path: string; sha256: string; bytes: number };
};
export const mapAPIBase =
  settings.apiBaseUrl +
  (import.meta.env.VITE_WT_CATALOG_SOURCE === "preview" ? "/map-data-preview" : "");
const hash = (bytes: Uint8Array) => bytesToHex(sha256(bytes));
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function assetURL(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      ((u.hostname === "cdn.jsdelivr.net" &&
        /^\/gh\/MrTreasure\/oss-files@[a-f0-9]{40}\/war-thunder\//.test(u.pathname)) ||
        (u.hostname === "raw.githubusercontent.com" &&
          /^\/MrTreasure\/oss-files\/[a-f0-9]{40}\/war-thunder\//.test(u.pathname)) ||
        (u.hostname === "wtmaps.mrtreasure.cc" &&
          /^\/(ground-maps|wt-map-atlas)\//.test(u.pathname)))
    );
  } catch {
    return false;
  }
}
function validAsset(v: unknown): boolean {
  return (
    record(v) &&
    assetURL(v.url) &&
    digest(v.sha256) &&
    finite(v.bytes) &&
    v.bytes > 0 &&
    [v.rawUrl, v.fallbackUrl].every((u) => u === undefined || u === "" || assetURL(u))
  );
}
export function validateMapSnapshot(v: unknown): v is MapSnapshot {
  if (!record(v) || !id(v.releaseId) || !record(v.atlas)) return false;
  const a = v.atlas;
  if (
    !Array.isArray(a.maps) ||
    !a.maps.length ||
    a.maps.length > 1000 ||
    !record(a.icons) ||
    !Object.values(a.icons).every(validAsset) ||
    !Array.isArray(a.seasonalVariants)
  )
    return false;
  const seen = new Set<string>();
  for (const m of a.maps) {
    if (
      !record(m) ||
      !id(m.id) ||
      seen.has(m.id) ||
      typeof m.name !== "string" ||
      typeof m.english !== "string" ||
      !finite(m.width) ||
      m.width <= 0 ||
      !finite(m.height) ||
      m.height <= 0 ||
      !validAsset(m.base) ||
      !validAsset(m.contourImage) ||
      !Array.isArray(m.layouts) ||
      !m.layouts.length ||
      !Array.isArray(m.thumbnails) ||
      !Array.isArray(m.guides) ||
      !Array.isArray(m.legacyGuideIds) ||
      !Array.isArray(m.bounds) ||
      m.bounds.length !== 2 ||
      !m.bounds.every((b) => Array.isArray(b) && b.length === 2 && b.every(finite)) ||
      !record(m.grid) ||
      !record(m.grid.default_reference) ||
      !Array.isArray(m.grid.default_reference.origin_xz_m) ||
      m.grid.default_reference.origin_xz_m.length !== 2 ||
      !m.grid.default_reference.origin_xz_m.every(finite) ||
      !Array.isArray(m.grid.default_reference.step_xz_m) ||
      m.grid.default_reference.step_xz_m.length !== 2 ||
      !m.grid.default_reference.step_xz_m.every((n) => finite(n) && n > 0) ||
      !record(m.contours) ||
      !Array.isArray(m.contours.height_range_m) ||
      m.contours.height_range_m.length !== 2 ||
      !m.contours.height_range_m.every(finite)
    )
      return false;
    seen.add(m.id);
    const layouts = new Set<string>();
    for (const l of m.layouts) {
      if (
        !record(l) ||
        !id(l.id) ||
        layouts.has(l.id) ||
        typeof l.name !== "string" ||
        !Array.isArray(l.crop) ||
        l.crop.length !== 4 ||
        !l.crop.every(finite) ||
        !Array.isArray(l.marks) ||
        !l.marks.every(
          (p) =>
            record(p) &&
            ["spawn", "capture"].includes(String(p.kind)) &&
            finite(p.x) &&
            finite(p.y) &&
            finite(p.team) &&
            typeof p.label === "string",
        )
      )
        return false;
      layouts.add(l.id);
    }
    if (
      !m.thumbnails.every(
        (t) => record(t) && layouts.has(String(t.layoutId)) && validAsset(t.image),
      )
    )
      return false;
    if (
      !m.guides.every(
        (g) =>
          record(g) &&
          typeof g.title === "string" &&
          typeof g.source === "string" &&
          /^https:\/\/(www\.)?xiaoheihe\.cn\//.test(g.source),
      )
    )
      return false;
  }
  return a.seasonalVariants.every(
    (x) =>
      record(x) &&
      seen.has(String(x.mapId)) &&
      seen.has(String(x.sourceMapId)) &&
      record(x.layouts),
  );
}
export function mapGuides(atlas: GroundAtlas, mapId: string) {
  const family = atlas.seasonalVariants.find((v) => v.mapId === mapId)?.sourceMapId || mapId;
  const guides = atlas.maps
    .filter(
      (m) => (atlas.seasonalVariants.find((v) => v.mapId === m.id)?.sourceMapId || m.id) === family,
    )
    .flatMap((m) => m.guides);
  return [...new Map(guides.map((g) => [g.source, g])).values()];
}
export function routeIdentity(atlas: GroundAtlas, mapId: string, layoutId: string) {
  const v = atlas.seasonalVariants.find((v) => v.mapId === mapId);
  const layout = v && Object.entries(v.layouts).find(([k]) => k === layoutId)?.[1];
  return layout ? { mapId: v!.sourceMapId, layoutId: layout } : { mapId, layoutId };
}
async function readJSON(path: string, signal: AbortSignal, authorization?: string) {
  const response = await fetch(`${mapAPIBase}/${path}`, {
    credentials: "omit",
    cache: "no-cache",
    signal,
    headers: authorization
      ? { Authorization: authorization, Accept: "application/json" }
      : { Accept: "application/json" },
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error("地图资料超过大小限制");
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!response.ok)
    throw new Error(
      record(value) && typeof value.message === "string" ? value.message : "地图服务暂时不可用",
    );
  if (response.headers.get("X-Content-SHA256") !== hash(bytes))
    throw new Error("地图资料完整性校验失败");
  return value;
}
export async function fetchMapSnapshot(signal: AbortSignal): Promise<MapSnapshot> {
  const maps: GroundMap[] = [];
  let cursor: string | null = null;
  let first: Record<string, unknown> | null = null;
  do {
    const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
    const page = await readJSON(`maps?${query}`, signal);
    if (
      !record(page) ||
      page.schemaVersion !== 1 ||
      !id(page.releaseId) ||
      !Array.isArray(page.items) ||
      !(page.nextCursor === null || typeof page.nextCursor === "string")
    )
      throw new Error("地图清单格式无效");
    if (first && page.releaseId !== first.releaseId) throw new Error("地图清单版本不一致");
    first ||= page;
    maps.push(...(page.items as GroundMap[]));
    if (maps.length > 1000 || (page.nextCursor && page.nextCursor === cursor))
      throw new Error("地图分页无效");
    cursor = page.nextCursor as string | null;
  } while (cursor);
  const snapshot = {
    releaseId: first!.releaseId,
    atlas: {
      schemaVersion: 1,
      maps,
      icons: first!.icons,
      seasonalVariants: first!.seasonalVariants,
      projection: first!.projection,
    },
  };
  if (!validateMapSnapshot(snapshot)) throw new Error("地图资料格式或资源地址无效");
  return snapshot;
}
function validRoute(v: unknown): v is MapRoute {
  if (
    !record(v) ||
    !id(v.id) ||
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
    !/^https:\/\/www\.xiaoheihe\.cn\/app\/bbs\/link\/[A-Za-z0-9]+$/.test(v.sourceUrl) ||
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
export async function fetchMapRoutes(
  releaseId: string,
  signal: AbortSignal,
  mapId?: string,
  layoutId?: string,
  team?: number,
): Promise<MapRoute[]> {
  const authorization = statsHeaders().Authorization;
  if (!authorization) throw new Error("请登录后读取推荐走线");
  const q = new URLSearchParams({
    releaseId,
    ...(mapId && layoutId ? { mapId, layoutId } : {}),
    ...(team ? { team: String(team) } : {}),
  });
  const value = await readJSON(`map-guides/routes?${q}`, signal, authorization);
  if (statsHeaders().Authorization !== authorization) throw new Error("登录身份已变化");
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.releaseId !== releaseId ||
    !Array.isArray(value.items) ||
    value.items.length > 1000 ||
    !value.items.every(validRoute)
  )
    throw new Error("走线索引格式无效");
  return value.items;
}
export async function fetchMapRouteSVG(
  route: MapRoute,
  releaseId: string,
  signal: AbortSignal,
): Promise<Blob> {
  const authorization = statsHeaders().Authorization;
  if (!authorization) throw new Error("请登录后读取推荐走线");
  const response = await fetch(
    `${mapAPIBase}/${route.svg.path}?releaseId=${encodeURIComponent(releaseId)}`,
    {
      credentials: "omit",
      cache: "no-store",
      headers: { Authorization: authorization },
      signal,
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "登录或走线读取权限已失效"
        : "推荐走线暂时无法读取",
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.length !== route.svg.bytes ||
    bytes.length > 262144 ||
    hash(bytes) !== route.svg.sha256 ||
    response.headers.get("X-Map-Release") !== releaseId ||
    statsHeaders().Authorization !== authorization
  )
    throw new Error("走线文件版本或哈希校验失败");
  return new Blob([bytes], { type: "image/svg+xml" });
}
