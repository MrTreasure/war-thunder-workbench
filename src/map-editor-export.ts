import type { Annotation, MapPoint } from "./map-editor-model";
import type { TextAnnotation } from "./map-editor-model";
import { canvasTextFont } from "./map-editor-fonts";
import {
  arrowPoints,
  pathData,
  routeDash,
  routeBodyData,
  routeDecorations,
  shapeBounds,
  shapePath,
} from "./map-editor-model";
import { assetSources } from "./map-assets";
import type { GroundImageAsset } from "./map-assets";
import { tacticalSymbolIds, drawTacticalSymbol } from "./map-editor-symbols";
export type MapExportScene = {
  base: GroundImageAsset;
  contourImage: GroundImageAsset;
  view: { x: number; y: number; w: number; h: number };
  mapFrame: { x: number; y: number; w: number; h: number };
  markerScale: number;
  contours: boolean;
  points: boolean;
  grid: boolean;
  team: number;
  zoom: number;
  bounds: number[][];
  reference: { origin_xz_m: number[]; step_xz_m: number[] };
  marks: { kind: string; label: string; team: number; x: number; y: number }[];
  builtinIcons: Record<string, GroundImageAsset>;
  editorIcons: Record<string, GroundImageAsset>;
};
function imageFromUrl(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    let timer: ReturnType<typeof setTimeout>;
    const clean = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
    };
    const fail = (message: string) => {
      clean();
      image.src = "";
      reject(new Error(message));
    };
    const abort = () => fail("已取消导出");
    image.onload = () => {
      clean();
      resolve(image);
    };
    image.onerror = () => fail("图片源未允许导出或暂时无法访问");
    timer = setTimeout(() => fail("图片加载超时"), 25000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    image.src = url;
  });
}
async function loadAsset(asset: GroundImageAsset, signal: AbortSignal): Promise<HTMLImageElement> {
  for (const url of assetSources(asset)) {
    if (signal.aborted) throw new Error("已取消导出");
    try {
      return await imageFromUrl(url, signal);
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  throw new Error("图片无法用于导出，请切换网络后重试；编辑文件仍可保存");
}
const iconKey = (m: MapExportScene["marks"][number], team: number) =>
  m.kind === "spawn"
    ? m.team === team
      ? "spawn_ally"
      : "spawn_enemy"
    : `capture_${m.label.toLowerCase()}`;
function contain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight),
    w = image.naturalWidth * scale,
    h = image.naturalHeight * scale;
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
}
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  p: MapPoint,
  size: number,
  color: string,
  rotation = 0,
  align: CanvasTextAlign = "left",
  typography: Pick<TextAnnotation, "font" | "fontWeight" | "italic"> = {},
) {
  ctx.save();
  ctx.translate(p.x * 1000, p.y * 1000);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.font = canvasTextFont(typography, size);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#171c22";
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.fillStyle = color;
  text.split("\n").forEach((line, i) => {
    ctx.strokeText(line, 0, i * size * 1.3);
    ctx.fillText(line, 0, i * size * 1.3);
  });
  ctx.restore();
}
export async function renderMapPng(
  scene: MapExportScene,
  items: Annotation[],
  resolution: number,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
): Promise<Blob> {
  const fontsReady = Promise.all(
    items
      .filter((item): item is TextAnnotation => item.kind === "text" && !item.hidden)
      .map((item) =>
        document.fonts.load(canvasTextFont(item, item.fontSize * 1000), item.text || " "),
      ),
  );
  const needed = new Map<string, GroundImageAsset>();
  const add = (asset: GroundImageAsset) => needed.set(asset.url, asset);
  add(scene.base);
  if (scene.contours) add(scene.contourImage);
  if (scene.points)
    for (const mark of scene.marks) {
      const asset = scene.builtinIcons[iconKey(mark, scene.team)];
      if (asset) add(asset);
    }
  for (const item of items)
    if (!item.hidden && item.kind === "icon" && !tacticalSymbolIds.has(item.iconId)) {
      const asset = scene.editorIcons[item.iconId];
      if (!asset) throw new Error("图标资源未收录");
      add(asset);
    }
  const images = new Map<string, HTMLImageElement>();
  let loaded = 0;
  progress(0, needed.size);
  // Bound concurrent large terrain downloads; no pixel reads before CORS-approved images load.
  const queue = [...needed.values()];
  await Promise.all([
    fontsReady,
    ...[0, 1].map(async () => {
      while (queue.length) {
        const asset = queue.shift()!;
        images.set(asset.url, await loadAsset(asset, signal));
        progress(++loaded, needed.size);
      }
    }),
  ]);
  if (signal.aborted) throw new Error("已取消导出");
  const { x, y, w, h } = scene.view;
  const scale = Math.min(4096, Math.max(512, resolution)) / Math.max(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法生成图片");
  ctx.fillStyle = "#151b1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.beginPath();
  ctx.rect(scene.mapFrame.x, scene.mapFrame.y, scene.mapFrame.w, scene.mapFrame.h);
  ctx.clip();
  ctx.drawImage(images.get(scene.base.url)!, 0, 0, 1000, 1000);
  if (scene.contours) {
    ctx.globalAlpha = 0.8;
    ctx.drawImage(images.get(scene.contourImage.url)!, 0, 0, 1000, 1000);
    ctx.globalAlpha = 1;
  }
  if (scene.grid) {
    const [[x0, z0], [x1, z1]] = scene.bounds,
      ref = scene.reference;
    ctx.save();
    ctx.strokeStyle = "#f7edcb9c";
    ctx.lineWidth = 1 / scene.zoom;
    ctx.font = `${16 / scene.zoom}px system-ui,sans-serif`;
    ctx.textBaseline = "top";
    for (let i = 0; i < 100; i++) {
      const gx = ((ref.origin_xz_m[0] + i * ref.step_xz_m[0] - x0) / (x1 - x0)) * 1000,
        gz = ((ref.origin_xz_m[1] + i * ref.step_xz_m[1] - z0) / (z1 - z0)) * 1000;
      if (gx >= 0 && gx <= 1000) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, 1000);
        ctx.stroke();
        drawText(
          ctx,
          String(i + 1),
          { x: (gx + 3) / 1000, y: (scene.mapFrame.y + 3 / scene.zoom) / 1000 },
          16 / scene.zoom,
          "#f7edcb",
        );
      }
      if (gz >= 0 && gz <= 1000) {
        ctx.beginPath();
        ctx.moveTo(0, gz);
        ctx.lineTo(1000, gz);
        ctx.stroke();
        const label =
          i < 26
            ? String.fromCharCode(65 + i)
            : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
        drawText(
          ctx,
          label,
          { x: (scene.mapFrame.x + 4 / scene.zoom) / 1000, y: gz / 1000 },
          16 / scene.zoom,
          "#f7edcb",
        );
      }
    }
    ctx.restore();
  }
  if (scene.points)
    for (const mark of scene.marks) {
      const size = scene.markerScale * (mark.kind === "spawn" ? 0.047 : 0.029),
        asset = scene.builtinIcons[iconKey(mark, scene.team)];
      if (asset)
        contain(
          ctx,
          images.get(asset.url)!,
          mark.x * 1000 - size / 2,
          mark.y * 1000 - size / 2,
          size,
        );
      else drawText(ctx, mark.label, { x: mark.x, y: mark.y }, size, "#efede5", 0, "center");
    }
  ctx.restore(); // Only terrain and original mission marks are clipped to the map layer.
  for (const item of items) {
    if (item.hidden) continue;
    if (item.kind === "path") {
      ctx.save();
      const route = new Path2D(routeBodyData(item));
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * 1000;
      ctx.lineCap = "round";
      ctx.lineJoin = item.lineStyle === "defense" ? "miter" : "round";
      ctx.setLineDash(routeDash(item));
      ctx.strokeStyle = "#10191fb3";
      ctx.lineWidth = item.width * 1000 + 1.8;
      ctx.stroke(route);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * 1000;
      ctx.stroke(route);
      ctx.setLineDash([]);
      ctx.lineWidth = item.width * 1000;
      for (const points of routeDecorations(item)) {
        const decoration = new Path2D(pathData(points));
        ctx.stroke(decoration);
      }
      const triangle = arrowPoints(item);
      if (triangle.length) {
        ctx.setLineDash([]);
        if (item.arrowHead === "open")
          ctx.stroke(new Path2D(pathData([triangle[1], triangle[0], triangle[2]])));
        else {
          const path = new Path2D(pathData(triangle) + " Z");
          ctx.fillStyle = item.color;
          ctx.fill(path);
        }
      }
      ctx.restore();
    } else if (item.kind === "shape") {
      const path = new Path2D(shapePath(item)),
        bounds = shapeBounds(item);
      ctx.save();
      ctx.fillStyle = item.color;
      ctx.globalAlpha = item.fillOpacity;
      ctx.fill(path);
      ctx.globalAlpha = 1;
      if (item.hatch) {
        const tile = document.createElement("canvas");
        tile.width = 12;
        tile.height = 12;
        const paint = tile.getContext("2d");
        if (!paint) throw new Error("无法绘制区域填充");
        paint.strokeStyle = item.color;
        paint.lineWidth = 1.2;
        paint.stroke(new Path2D("M-3 3L3 -3M0 12L12 0M9 15L15 9"));
        const hatch = ctx.createPattern(tile, "repeat");
        if (!hatch) throw new Error("无法绘制区域填充");
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = hatch;
        ctx.fill(path);
        ctx.restore();
      }
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width * 1000;
      ctx.stroke(path);
      ctx.restore();
      if (item.caption)
        drawText(
          ctx,
          item.caption,
          { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 - 0.008 },
          16,
          item.color,
          0,
          "center",
        );
    } else if (item.kind === "text")
      drawText(
        ctx,
        item.text,
        item.point,
        item.fontSize * 1000,
        item.color,
        item.rotation,
        "left",
        item,
      );
    else {
      const size = item.size * 1000,
        px = item.point.x * 1000,
        py = item.point.y * 1000;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.fillStyle = item.color + "40";
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!drawTacticalSymbol(ctx, item.iconId, -size / 2, -size / 2, size, item.color))
        contain(ctx, images.get(scene.editorIcons[item.iconId].url)!, -size / 2, -size / 2, size);
      ctx.restore();
      if (item.caption)
        drawText(
          ctx,
          item.caption,
          { x: item.point.x, y: item.point.y + item.size * 0.7 },
          size * 0.38,
          item.color,
          0,
          "center",
        );
    }
  }
  if (signal.aborted) throw new Error("已取消导出");
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("图片生成失败，请尝试 2K 尺寸"))),
        "image/png",
      );
    } catch {
      reject(new Error("图片源不允许导出，请保存编辑文件后重试"));
    }
  });
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "_");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
