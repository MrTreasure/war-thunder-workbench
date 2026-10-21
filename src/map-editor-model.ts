export type MapPoint = { x: number; y: number };
export type EditorContext = { mapId: string; layoutId: string; team: 1 | 2 };
type Base = { id: string; color: string; hidden: boolean; locked: boolean };
export type RouteAnnotation = Base & {
  kind: "path";
  points: MapPoint[];
  width: number;
  dashed: boolean;
  arrow: boolean;
  curve?: boolean;
  lineStyle?: "solid" | "dashed" | "dotted" | "dashdot" | "defense" | "barrier";
};
export type ShapeAnnotation = Base & {
  kind: "shape";
  shape: "rectangle" | "ellipse" | "polygon";
  points: MapPoint[];
  width: number;
  fillOpacity: number;
  hatch: boolean;
  caption: string;
};
export type GeometryAnnotation = RouteAnnotation | ShapeAnnotation;
export type IconAnnotation = Base & {
  kind: "icon";
  point: MapPoint;
  iconId: string;
  size: number;
  rotation: number;
  caption: string;
};
export type TextAnnotation = Base & {
  kind: "text";
  point: MapPoint;
  text: string;
  fontSize: number;
  rotation: number;
};
export type Annotation = RouteAnnotation | IconAnnotation | TextAnnotation | ShapeAnnotation;
export type MapProject = EditorContext & { version: 1; updatedAt: string; items: Annotation[] };
export const MAX_ITEMS = 500;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const draftKey = (context: EditorContext) =>
  `wt-map-editor-v1:${context.mapId}:${context.layoutId}:${context.team}`;
export const sameContext = (a: EditorContext, b: EditorContext) =>
  a.mapId === b.mapId && a.layoutId === b.layoutId && a.team === b.team;
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export function moveAnnotation(item: Annotation, dx: number, dy: number): Annotation {
  const points = item.kind === "path" || item.kind === "shape" ? item.points : [item.point];
  dx = clamp(dx, -Math.min(...points.map((p) => p.x)), 1 - Math.max(...points.map((p) => p.x)));
  dy = clamp(dy, -Math.min(...points.map((p) => p.y)), 1 - Math.max(...points.map((p) => p.y)));
  const move = (p: MapPoint) => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) });
  return item.kind === "path" || item.kind === "shape"
    ? { ...item, points: points.map(move) }
    : { ...item, point: move(item.point) };
}
export const anchorPoint = (item: Annotation) =>
  item.kind === "path" || item.kind === "shape" ? item.points[0] : item.point;
export function curveControls(points: MapPoint[], index: number): [MapPoint, MapPoint] {
  const a = points[index],
    b = points[index + 1],
    previous = points[index - 1] || a,
    next = points[index + 2] || b;
  return [
    { x: clamp(a.x + (b.x - previous.x) / 6), y: clamp(a.y + (b.y - previous.y) / 6) },
    { x: clamp(b.x - (next.x - a.x) / 6), y: clamp(b.y - (next.y - a.y) / 6) },
  ];
}
export function routePoint(item: RouteAnnotation, index: number, t: number): MapPoint {
  const a = item.points[index],
    b = item.points[index + 1];
  if (!item.curve) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const [c, d] = curveControls(item.points, index),
    u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * c.x + 3 * u * t ** 2 * d.x + t ** 3 * b.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * c.y + 3 * u * t ** 2 * d.y + t ** 3 * b.y,
  };
}
export function pathData(points: MapPoint[], curve = false): string {
  return points
    .map((p, i) => {
      if (!i) return `M${p.x * 1000},${p.y * 1000}`;
      if (!curve) return `L${p.x * 1000},${p.y * 1000}`;
      const [a, b] = curveControls(points, i - 1);
      return `C${a.x * 1000},${a.y * 1000} ${b.x * 1000},${b.y * 1000} ${p.x * 1000},${p.y * 1000}`;
    })
    .join(" ");
}
export function bendPoints(start: MapPoint, end: MapPoint): MapPoint[] {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  return [
    start,
    { x: clamp((start.x + end.x) / 2 - dy * 0.2), y: clamp((start.y + end.y) / 2 + dx * 0.2) },
    end,
  ];
}
export function routeDash(item: RouteAnnotation): number[] {
  const w = item.width * 1000;
  switch (item.lineStyle || (item.dashed ? "dashed" : "solid")) {
    case "dashed":
      return [w * 4, w * 3];
    case "dotted":
      return [w * 0.15, w * 2.5];
    case "dashdot":
      return [w * 5, w * 2, w * 0.2, w * 2];
    default:
      return [];
  }
}
/** Decorations are tactical sketch aids, not certified military symbology. */
export function routeDecorations(item: RouteAnnotation): MapPoint[][] {
  if (item.lineStyle !== "defense" && item.lineStyle !== "barrier") return [];
  const samples: MapPoint[] = [item.points[0]];
  for (let i = 0; i < item.points.length - 1; i++) {
    const steps = item.curve ? 20 : 1;
    for (let k = 1; k <= steps; k++) samples.push(routePoint(item, i, k / steps));
  }
  const spacing = Math.max(0.018, item.width * 8),
    size = Math.max(0.006, item.width * 2.2);
  const result: MapPoint[][] = [];
  let walked = 0,
    target = spacing / 2;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    while (target <= walked + length && result.length < 500) {
      const t = (target - walked) / length,
        x = a.x + dx * t,
        y = a.y + dy * t,
        ux = dx / length,
        uy = dy / length;
      const at = (along: number, side: number) => ({
        x: x + ux * along - uy * side,
        y: y + uy * along + ux * side,
      });
      if (item.lineStyle === "defense") result.push([at(-size, 0), at(0, size * 1.6), at(size, 0)]);
      else {
        result.push([at(-size, -size), at(size, size)]);
        result.push([at(-size, size), at(size, -size)]);
      }
      target += spacing;
    }
    walked += length;
  }
  return result;
}
export function shapeCorners(a: MapPoint, b: MapPoint): MapPoint[] {
  return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
}
export function shapeBounds(item: ShapeAnnotation) {
  const xs = item.points.map((p) => p.x),
    ys = item.points.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
export function shapePath(item: ShapeAnnotation): string {
  if (item.shape === "polygon") return pathData(item.points) + " Z";
  const { x, y, w, h } = shapeBounds(item);
  if (item.shape === "ellipse") {
    if (!w || !h) return "";
    return `M${x * 1000},${(y + h / 2) * 1000}a${w * 500},${h * 500} 0 1 0 ${w * 1000},0a${w * 500},${h * 500} 0 1 0 ${-w * 1000},0Z`;
  }
  return pathData(shapeCorners({ x, y }, { x: x + w, y: y + h })) + " Z";
}
/** Expand the layout to the actual viewport; prevent panning into empty world space. */
export function mapView(crop: number[], zoom: number, aspect: number, offset: MapPoint) {
  const baseW = (crop[2] - crop[0]) * 1000,
    baseH = (crop[3] - crop[1]) * 1000;
  let w = Math.max(baseW / zoom, (baseH / zoom) * aspect),
    h = w / aspect;
  const fit = Math.min(1, 1000 / w, 1000 / h);
  w *= fit;
  h *= fit;
  const originX = (crop[0] + crop[2]) * 500 - w / 2,
    originY = (crop[1] + crop[3]) * 500 - h / 2;
  return {
    w,
    h,
    x: clamp(originX + offset.x, 0, 1000 - w),
    y: clamp(originY + offset.y, 0, 1000 - h),
    originX,
    originY,
  };
}
export function arrowPoints(item: RouteAnnotation): MapPoint[] {
  if (!item.arrow || item.points.length < 2) return [];
  const b = item.points.at(-1)!;
  const lastControl = item.curve ? curveControls(item.points, item.points.length - 2)[1] : null;
  const a =
    lastControl && Math.hypot(b.x - lastControl.x, b.y - lastControl.y) > 0.00001
      ? lastControl
      : [...item.points].reverse().find((p) => Math.hypot(b.x - p.x, b.y - p.y) > 0.00001);
  if (!a) return [];
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    length = item.width * 4;
  return [
    b,
    {
      x: b.x - length * Math.cos(angle) + length * 0.5 * Math.sin(angle),
      y: b.y - length * Math.sin(angle) - length * 0.5 * Math.cos(angle),
    },
    {
      x: b.x - length * Math.cos(angle) - length * 0.5 * Math.sin(angle),
      y: b.y - length * Math.sin(angle) + length * 0.5 * Math.cos(angle),
    },
  ];
}
export type History = {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
  group?: string;
};
export type HistoryAction =
  | { type: "commit"; items: Annotation[]; group?: string }
  | { type: "undo" | "redo" | "endGroup" };
export const createHistory = (items: Annotation[] = []): History => ({
  past: [],
  present: items,
  future: [],
});
export function reduceHistory(h: History, action: HistoryAction): History {
  if (action.type === "endGroup") return { ...h, group: undefined };
  if (action.type === "undo")
    return h.past.length
      ? {
          past: h.past.slice(0, -1),
          present: h.past.at(-1)!,
          future: [h.present, ...h.future],
          group: undefined,
        }
      : h;
  if (action.type === "redo")
    return h.future.length
      ? {
          past: [...h.past, h.present].slice(-60),
          present: h.future[0],
          future: h.future.slice(1),
          group: undefined,
        }
      : h;
  if (action.type !== "commit" || JSON.stringify(h.present) === JSON.stringify(action.items))
    return h;
  return {
    past: action.group && action.group === h.group ? h.past : [...h.past, h.present].slice(-60),
    present: action.items,
    future: [],
    group: action.group,
  };
}
function requireValue(value: unknown, ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function number(value: unknown, min: number, max: number) {
  requireValue(
    value,
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max,
    "标注数值超出范围",
  );
  return value as number;
}
function record(value: unknown): Record<string, unknown> {
  requireValue(
    value,
    !!value && typeof value === "object" && !Array.isArray(value),
    "文件格式不正确",
  );
  return value as Record<string, unknown>;
}
function point(value: unknown): MapPoint {
  const p = record(value);
  return { x: number(p.x, 0, 1), y: number(p.y, 0, 1) };
}
function text(value: unknown, max: number) {
  requireValue(value, typeof value === "string" && value.length <= max, "文字内容过长或格式错误");
  return value as string;
}
function flag(value: unknown) {
  requireValue(value, typeof value === "boolean", "标注开关格式错误");
  return value as boolean;
}
function lineStyle(value: unknown): NonNullable<RouteAnnotation["lineStyle"]> {
  requireValue(
    value,
    ["solid", "dashed", "dotted", "dashdot", "defense", "barrier"].includes(value as string),
    "未知线条样式",
  );
  return value as NonNullable<RouteAnnotation["lineStyle"]>;
}
export function parseProject(
  input: unknown,
  iconIds: ReadonlySet<string>,
  knownContext: (c: EditorContext) => boolean,
): MapProject {
  const p = record(input);
  requireValue(p.version, p.version === 1, "不支持这个编辑文件版本");
  const context: EditorContext = {
    mapId: text(p.mapId, 100),
    layoutId: text(p.layoutId, 150),
    team: number(p.team, 1, 2) as 1 | 2,
  };
  requireValue(
    context.team,
    Number.isInteger(context.team) && knownContext(context),
    "文件对应的地图、布局或队伍未收录",
  );
  const updatedAt = text(p.updatedAt, 40);
  requireValue(updatedAt, Number.isFinite(Date.parse(updatedAt)), "文件保存时间格式错误");
  requireValue(
    p.items,
    Array.isArray(p.items) && p.items.length <= MAX_ITEMS,
    "最多支持 500 个标注",
  );
  const ids = new Set<string>();
  let totalPoints = 0;
  const items = (p.items as unknown[]).map((value): Annotation => {
    const a = record(value),
      id = text(a.id, 80),
      color = text(a.color, 7);
    requireValue(id, /^[a-zA-Z0-9_-]+$/.test(id) && !ids.has(id), "标注编号重复或无效");
    ids.add(id);
    requireValue(color, /^#[a-fA-F0-9]{6}$/.test(color), "标注颜色格式错误");
    const base = { id, color, hidden: flag(a.hidden), locked: flag(a.locked) };
    if (a.kind === "path") {
      requireValue(
        a.points,
        Array.isArray(a.points) && a.points.length >= 2 && a.points.length <= 3000,
        "走线需包含 2 至 3000 个点",
      );
      const points = (a.points as unknown[]).map(point);
      totalPoints += points.length;
      requireValue(totalPoints, totalPoints <= 50000, "文件包含过多走线点");
      return {
        ...base,
        kind: "path",
        points,
        width: number(a.width, 0.001, 0.03),
        dashed: flag(a.dashed),
        arrow: flag(a.arrow),
        ...(a.curve === undefined ? {} : { curve: flag(a.curve) }),
        ...(a.lineStyle === undefined ? {} : { lineStyle: lineStyle(a.lineStyle) }),
      };
    }
    if (a.kind === "shape") {
      const shape = a.shape;
      requireValue(
        shape,
        shape === "rectangle" || shape === "ellipse" || shape === "polygon",
        "未知区域形状",
      );
      requireValue(
        a.points,
        Array.isArray(a.points) &&
          (shape === "polygon"
            ? a.points.length >= 3 && a.points.length <= 128
            : a.points.length === 2),
        "区域控制点数量不正确",
      );
      const points = (a.points as unknown[]).map(point);
      totalPoints += points.length;
      requireValue(totalPoints, totalPoints <= 50000, "文件包含过多控制点");
      return {
        ...base,
        kind: "shape",
        shape,
        points,
        width: number(a.width, 0.001, 0.03),
        fillOpacity: number(a.fillOpacity, 0, 0.6),
        hatch: flag(a.hatch),
        caption: text(a.caption, 300),
      };
    }
    if (a.kind === "icon") {
      const iconId = text(a.iconId, 100);
      requireValue(iconId, iconIds.has(iconId), "文件包含未收录图标");
      return {
        ...base,
        kind: "icon",
        iconId,
        point: point(a.point),
        size: number(a.size, 0.008, 0.2),
        rotation: number(a.rotation, -180, 180),
        caption: text(a.caption, 300),
      };
    }
    requireValue(a.kind, a.kind === "text", "不支持的标注类型");
    return {
      ...base,
      kind: "text",
      point: point(a.point),
      text: text(a.text, 1000),
      fontSize: number(a.fontSize, 0.008, 0.1),
      rotation: number(a.rotation, -180, 180),
    };
  });
  return { ...context, version: 1, updatedAt, items };
}
export function makeProject(context: EditorContext, items: Annotation[]): MapProject {
  return { ...context, version: 1, updatedAt: new Date().toISOString(), items };
}
export function serializeProject(project: MapProject): string {
  const body = JSON.stringify(project);
  if (new TextEncoder().encode(body).byteLength > MAX_FILE_BYTES)
    throw new Error("草稿过大，请减少标注或分次保存");
  return body;
}
export function writeProject(project: MapProject): void {
  localStorage.setItem(draftKey(project), serializeProject(project));
}
export function readProject(
  context: EditorContext,
  icons: ReadonlySet<string>,
): { items: Annotation[]; message: string } {
  try {
    const body = localStorage.getItem(draftKey(context));
    if (!body) return { items: [], message: "标注将保存在当前浏览器" };
    if (body.length > MAX_FILE_BYTES) throw new Error();
    const p = parseProject(JSON.parse(body), icons, (c) => sameContext(c, context));
    return { items: p.items, message: `已恢复本地草稿 · ${p.items.length} 个标注` };
  } catch {
    return { items: [], message: "无法读取本地草稿，原记录已保留；请先导出当前编辑结果" };
  }
}
export function annotationName(a: Annotation): string {
  return a.kind === "text"
    ? a.text.split("\n")[0] || "文字说明"
    : a.kind === "shape"
      ? a.caption ||
        (a.shape === "ellipse" ? "椭圆区域" : a.shape === "rectangle" ? "矩形区域" : "多边形区域")
      : a.kind === "icon"
        ? a.caption || "图标标记"
        : a.arrow
          ? "箭头走线"
          : "折线 / 画笔";
}
