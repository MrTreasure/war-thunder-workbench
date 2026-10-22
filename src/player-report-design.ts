import { t } from "./i18n/core";
import { vehicleDisplayName } from "./vehicle-display-name";
import type { Background, ReportPayload } from "./player-stats-api";
import { statsNumber, statsRatio } from "./player-stats-api";
import statsRules from "../data/player-stats-rules.json";
export function reportEfficiencyMaximum(payload: ReportPayload) {
  return [statsRules.version, "wt-efficiency-v2"].includes(payload.efficiencyVersion || "")
    ? statsRules.efficiency.maximum
    : 1000;
}
export type ReportTheme = {
  base: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  secondary: string;
  tertiary: string;
};
export const defaultReportTheme: ReportTheme = {
  base: "#202924",
  panel: "#2b352e",
  ink: "#eeeade",
  muted: "#bec6bb",
  accent: "#dfc589",
  line: "#6f7c6b",
  secondary: "#c2d2c3",
  tertiary: "#9cb5b0",
};
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB =>
  a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)) as RGB;
const hex = (v: RGB) =>
  "#" +
  v
    .map((n) =>
      Math.round(Math.max(0, Math.min(255, n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function hsl(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}
export function imageReportTheme(image: HTMLImageElement): ReportTheme {
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 60;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error(t("浏览器无法读取图片颜色。"));
  ctx.drawImage(image, 0, 0, 80, 60);
  const pixels = ctx.getImageData(0, 0, 80, 60).data;
  const bins = new Map<string, { rgb: RGB; weight: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const max = Math.max(...rgb),
      min = Math.min(...rgb);
    if (max < 22 || min > 240) continue;
    const key = rgb.map((v) => Math.floor(v / 32)).join("-");
    const weight = 1 + (max - min) / 255;
    const b = bins.get(key) || { rgb: [0, 0, 0] as RGB, weight: 0 };
    b.rgb = b.rgb.map((v, j) => v + rgb[j] * weight) as RGB;
    b.weight += weight;
    bins.set(key, b);
  }
  const winner = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!winner) return defaultReportTheme;
  const rgb = winner.rgb.map((v) => v / winner.weight) as RGB;
  const [r, g, b] = rgb.map((v) => v / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let hue = 42;
  if (d > 0.06) {
    hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  const accent = hsl(hue, Math.max(0.32, Math.min(0.62, d * 1.8)), 0.73);
  const base = mix(hsl(hue, 0.24, 0.15), [14, 18, 21], 0.3);
  return {
    base: hex(base),
    panel: hex(mix(base, rgb, 0.13)),
    ink: hex(hsl(hue, 0.12, 0.94)),
    muted: hex(hsl(hue, 0.12, 0.77)),
    accent: hex(accent),
    line: hex(mix(base, accent, 0.38)),
    secondary: hex(hsl((hue + 42) % 360, 0.3, 0.76)),
    tertiary: hex(hsl((hue + 310) % 360, 0.22, 0.64)),
  };
}
export async function localReportImage(source: string, signal?: AbortSignal) {
  const image = new Image();
  image.src = source;
  await image.decode();
  if (signal?.aborted) throw new DOMException(t("已取消"), "AbortError");
  return image;
}
export async function uploadReportBackground(
  file: File,
): Promise<{ background: Background; theme: ReportTheme }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(t("请选择 JPG、PNG 或 WebP 图片。"));
  if (file.size > 12 * 1024 * 1024) throw new Error(t("图片不能超过 12 MB，请压缩后再试。"));
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!png && !jpg && !webp) throw new Error(t("文件内容不是支持的图片格式，请换一张图片。"));
  const source = URL.createObjectURL(file);
  try {
    const image = await localReportImage(source);
    if (
      image.naturalWidth * image.naturalHeight > 24000000 ||
      image.naturalWidth < 320 ||
      image.naturalHeight < 240
    )
      throw new Error(t("请选择至少 320×240、且不超过 2400 万像素的图片。"));
    return {
      background: {
        id: "custom",
        title: file.name.slice(0, 80),
        category: "custom",
        era: "custom",
        source,
        thumbnail: source,
        sourcePage: "",
        local: true,
      },
      theme: imageReportTheme(image),
    };
  } catch (e) {
    URL.revokeObjectURL(source);
    throw e;
  }
}
export function reportSummary(p: ReportPayload) {
  const row = p.career || p.totals;
  const win =
    p.career?.winRate ?? (row.battles && row.wins != null ? (row.wins / row.battles) * 100 : null);
  return [
    { label: p.career ? t("战斗场次") : t("单车场次合计"), value: statsNumber(row.battles) },
    { label: t("综合 K/D"), value: statsRatio(row.kd) },
    { label: t("效率评分"), value: statsNumber(row.efficiency) },
    { label: t("胜率"), value: win == null ? "—" : win.toFixed(2) + "%" },
  ];
}
export function reportChartData(p: ReportPayload) {
  const values = p.top5.map((v, i) => ({
    id: v.id,
    label: vehicleDisplayName(v.name),
    rank: String(i + 1).padStart(2, "0"),
    value: v.efficiency,
  }));
  const groundOnly =
    p.scope?.category === "ground" ||
    (p.top5.length > 0 && p.top5.every((v) => v.category === "ground"));
  const segments = [
    { key: "air", label: t("空中目标"), value: p.totals.airKills },
    { key: "ground", label: t("地面目标"), value: p.totals.groundKills },
    { key: "naval", label: t("海上目标"), value: p.totals.navalKills },
  ].filter((segment) => !groundOnly || segment.key !== "naval");
  const total = segments.reduce((sum, v) => sum + (v.value ?? 0), 0);
  let start = -Math.PI / 2;
  return {
    values,
    total,
    hasKnown: segments.some((v) => v.value != null),
    segments: segments.map((v) => {
      const angle = total > 0 ? ((v.value ?? 0) / total) * Math.PI * 2 : 0;
      const segment = { ...v, start, end: start + angle };
      start += angle;
      return segment;
    }),
  };
}
