export const BVID_PATTERN = /^BV[A-Za-z0-9]{10}$/;
export const textStatuses = {
  complete: "整片文字分析",
  partial: "部分分析",
  captured: "文字已采集，待分析",
  referenced: "仅引用",
  unknown: "分析状态未知",
};
export const imageStatuses = {
  adopted: "图片已采用",
  reviewed: "图片已核对",
  captured: "图片已采集",
  none: "无图片",
  unknown: "图片状态未知",
};
export type VideoAnalysis = {
  bvid: string;
  url: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  topics: ("weakpoints" | "maps")[];
  textStatus: keyof typeof textStatuses;
  imageStatus: keyof typeof imageStatuses;
  analyzedRanges: { from: number; to: number }[];
  durationSeconds: number | null;
  segmentCount: number | null;
  lastAnalyzedAt: string | null;
  summary: string;
  gaps: string[];
  adoptedVehicles: { id: string; name: string }[];
  chapters: {
    title: string;
    from: number;
    to: number;
    summary: string;
    vehicleId: string | null;
  }[];
  evidenceCount: number;
  usedGuideCount: number;
};
export type VideoLibrary = {
  schema: 1;
  updatedAt: string;
  revision: string;
  items: VideoAnalysis[];
};
export function parseVideoId(input: string): string | null {
  const value = input.trim();
  if (BVID_PATTERN.test(value)) return value;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.bilibili.com", "bilibili.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const match = /^\/video\/(BV[A-Za-z0-9]{10})\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const nullableStr = (v: unknown) => v === null || str(v);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const time = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const range = (v: unknown) => record(v) && time(v.from) && time(v.to) && v.to >= v.from;
const list = (v: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(v) && v.length <= 10000 && v.every(check);
export function validateVideoLibrary(value: unknown): VideoLibrary {
  if (
    !record(value) ||
    value.schema !== 1 ||
    !str(value.updatedAt) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !str(value.revision) ||
    !/^[a-f0-9]{64}$/.test(value.revision) ||
    !list(value.items, (v) => {
      if (!record(v)) return false;
      return (
        str(v.bvid) &&
        BVID_PATTERN.test(v.bvid) &&
        str(v.url) &&
        parseVideoId(v.url) === v.bvid &&
        v.url === `https://www.bilibili.com/video/${v.bvid}/` &&
        str(v.title) &&
        nullableStr(v.author) &&
        nullableStr(v.publishedAt) &&
        list(v.topics, (t) => t === "weakpoints" || t === "maps") &&
        str(v.textStatus) &&
        Object.hasOwn(textStatuses, v.textStatus) &&
        str(v.imageStatus) &&
        Object.hasOwn(imageStatuses, v.imageStatus) &&
        list(v.analyzedRanges, range) &&
        (v.durationSeconds === null || time(v.durationSeconds)) &&
        (v.segmentCount === null || count(v.segmentCount)) &&
        nullableStr(v.lastAnalyzedAt) &&
        str(v.summary) &&
        list(v.gaps, str) &&
        list(
          v.adoptedVehicles,
          (a) => record(a) && str(a.id) && /^[a-z0-9_]+$/.test(a.id) && str(a.name),
        ) &&
        list(
          v.chapters,
          (c) =>
            record(c) &&
            range(c) &&
            str(c.title) &&
            str(c.summary) &&
            (c.vehicleId === null || (str(c.vehicleId) && /^[a-z0-9_]+$/.test(c.vehicleId))),
        ) &&
        count(v.evidenceCount) &&
        count(v.usedGuideCount)
      );
    })
  )
    throw Error("视频清单格式不正确，请稍后重试");
  const payload = value as VideoLibrary;
  if (new Set(payload.items.map((v) => v.bvid)).size !== payload.items.length)
    throw Error("视频清单包含重复 BV");
  return payload;
}
export function videoLibraryCsv(items: VideoAnalysis[]): string {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      [
        "视频原题",
        "BV",
        "链接",
        "作者",
        "文字进度",
        "图片进度",
        "已关联车型",
        "走线数量",
        "待补事项",
        "核对时间",
      ],
      ...items.map((v) => [
        v.title,
        v.bvid,
        v.url,
        v.author,
        textStatuses[v.textStatus],
        imageStatuses[v.imageStatus],
        v.adoptedVehicles.map((a) => a.name).join("；"),
        v.usedGuideCount,
        v.gaps.join("；"),
        v.lastAnalyzedAt,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
