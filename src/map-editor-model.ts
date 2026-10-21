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
  lineStyle?:
    | "solid"
    | "dashed"
    | "dotted"
    | "dashdot"
    | "defense"
    | "barrier"
    | "front"
    | "antitank"
    | "advance";
  arrowHead?: "filled" | "open";
  flip?: boolean;
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
// Coordinates stay relative to the full map; the drawing canvas extends beyond its edges.
export const CANVAS_MIN = -32;
export const CANVAS_MAX = 32;
export const canvasCoordinate = (n: number) => clamp(n, CANVAS_MIN, CANVAS_MAX);
export const MAX_ITEMS = 500;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const draftKey = (context: EditorContext) =>
  `wt-map-editor-v1:${context.mapId}:${context.layoutId}:${context.team}`;
export const sameContext = (a: EditorContext, b: EditorContext) =>
  a.mapId === b.mapId && a.layoutId === b.layoutId && a.team === b.team;
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export function moveAnnotation(item: Annotation, dx: number, dy: number): Annotation {
  const points = item.kind === "path" || item.kind === "shape" ? item.points : [item.point];
  dx = clamp(
    dx,
    CANVAS_MIN - Math.min(...points.map((p) => p.x)),
    CANVAS_MAX - Math.max(...points.map((p) => p.x)),
  );
  dy = clamp(
    dy,
    CANVAS_MIN - Math.min(...points.map((p) => p.y)),
    CANVAS_MAX - Math.max(...points.map((p) => p.y)),
  );
  const move = (p: MapPoint) => ({ x: canvasCoordinate(p.x + dx), y: canvasCoordinate(p.y + dy) });
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
    {
      x: canvasCoordinate(a.x + (b.x - previous.x) / 6),
      y: canvasCoordinate(a.y + (b.y - previous.y) / 6),
    },
    {
      x: canvasCoordinate(b.x - (next.x - a.x) / 6),
      y: canvasCoordinate(b.y - (next.y - a.y) / 6),
    },
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
    {
      x: canvasCoordinate((start.x + end.x) / 2 - dy * 0.2),
      y: canvasCoordinate((start.y + end.y) / 2 + dx * 0.2),
    },
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
/** Arc-length placement keeps military glyph spacing continuous through vertices. */
function measureRoute(item: RouteAnnotation) {
  const points: MapPoint[] = [item.points[0]],
    lengths = [0];
  for (let i = 0; i < item.points.length - 1; i++) {
    const steps = item.curve ? 24 : 1;
    for (let k = 1; k <= steps; k++) {
      const p = routePoint(item, i, k / steps),
        a = points.at(-1)!;
      points.push(p);
      lengths.push(lengths.at(-1)! + Math.hypot(p.x - a.x, p.y - a.y));
    }
  }
  const length = lengths.at(-1)!;
  const at = (distance: number, side = 0): MapPoint => {
    const d = clamp(distance, 0, length);
    let low = 1,
      high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (lengths[middle] < d) low = middle + 1;
      else high = middle;
    }
    const a = points[Math.max(0, low - 1)],
      b = points[low] || a,
      dx = b.x - a.x,
      dy = b.y - a.y,
      segment = Math.hypot(dx, dy),
      t = segment ? clamp((d - lengths[Math.max(0, low - 1)]) / segment) : 0;
    return {
      x: a.x + dx * t - (segment ? dy / segment : 0) * side,
      y: a.y + dy * t + (segment ? dx / segment : 1) * side,
    };
  };
  return { length, at };
}
/** Independently drawn planning graphics, informed by FORTL/FLOT/ATDITCH conventions. */
export function routeBodyData(item: RouteAnnotation): string {
  if (!["defense", "front", "advance"].includes(item.lineStyle || ""))
    return pathData(item.points, item.curve);
  const { length, at } = measureRoute(item);
  if (length < 0.00001) return pathData(item.points, item.curve);
  const sign = item.flip ? -1 : 1;
  if (item.lineStyle === "advance") {
    const half = Math.min(Math.max(0.006, item.width * 2.8), length * 0.13),
      head = Math.min(Math.max(0.028, item.width * 11), length * 0.42),
      shoulder = half * 2,
      end = length - head,
      steps = Math.min(250, Math.max(2, Math.ceil(end / 0.008))),
      left: MapPoint[] = [],
      right: MapPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const d = (end * i) / steps;
      left.push(at(d, half));
      right.push(at(d, -half));
    }
    return (
      pathData([...left, at(end, shoulder), at(length), at(end, -shoulder), ...right.reverse()]) +
      " Z"
    );
  }
  const count = Math.min(350, Math.max(1, Math.floor(length / Math.max(0.025, item.width * 10)))),
    step = length / count,
    height = Math.min(Math.max(0.006, item.width * 2.6), step * 0.4) * sign,
    points: MapPoint[] = [at(0)];
  for (let i = 0; i < count; i++) {
    const d = i * step;
    if (item.lineStyle === "defense") {
      points.push(
        at(d + step * 0.4),
        at(d + step * 0.4, height),
        at(d + step * 0.85, height),
        at(d + step * 0.85),
        at(d + step),
      );
    } else {
      for (let k = 1; k <= 12; k++) {
        const angle = (Math.PI * k) / 12;
        points.push(
          at(d + (step * (1 - Math.cos(angle))) / 2, Math.sin(angle) * step * 0.5 * sign),
        );
      }
    }
  }
  return pathData(points);
}
export function routeDecorations(item: RouteAnnotation): MapPoint[][] {
  if (item.lineStyle !== "antitank" && item.lineStyle !== "barrier") return [];
  const { length, at } = measureRoute(item),
    spacing = Math.max(0.022, item.width * 9, length / 250),
    size = Math.max(0.005, item.width * 2),
    sign = item.flip ? -1 : 1,
    result: MapPoint[][] = [];
  for (let d = spacing / 2; d < length; d += spacing) {
    if (item.lineStyle === "antitank")
      result.push([at(d - size), at(d, size * 1.7 * sign), at(d + size)]);
    else {
      result.push([at(d - size, -size), at(d + size, size)]);
      result.push([at(d - size, size), at(d + size, -size)]);
    }
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
/** Map is one layer on a larger canvas; extra view width never stretches the map. */
export function mapView(crop: number[], zoom: number, offset: MapPoint, aspect = 1) {
  const baseW = (crop[2] - crop[0]) * 1000,
    baseH = (crop[3] - crop[1]) * 1000;
  const h = (Math.max(baseH, baseW / aspect) * 1.16) / zoom,
    w = h * aspect;
  const originX = (crop[0] + crop[2]) * 500 - w / 2,
    originY = (crop[1] + crop[3]) * 500 - h / 2;
  return {
    w,
    h,
    x: originX + clamp(offset.x, -30000, 30000),
    y: originY + clamp(offset.y, -30000, 30000),
    originX,
    originY,
  };
}
export function arrowPoints(item: RouteAnnotation): MapPoint[] {
  if (!item.arrow || item.lineStyle === "advance" || item.points.length < 2) return [];
  const b = item.points.at(-1)!;
  const lastControl = item.curve ? curveControls(item.points, item.points.length - 2)[1] : null;
  const a =
    lastControl && Math.hypot(b.x - lastControl.x, b.y - lastControl.y) > 0.00001
      ? lastControl
      : [...item.points].reverse().find((p) => Math.hypot(b.x - p.x, b.y - p.y) > 0.00001);
  if (!a) return [];
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    length = item.width * (item.arrowHead === "open" ? 6 : 4);
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
  return { x: number(p.x, CANVAS_MIN, CANVAS_MAX), y: number(p.y, CANVAS_MIN, CANVAS_MAX) };
}
function text(value: unknown, max: number) {
  requireValue(value, typeof value === "string" && value.length <= max, "文字内容过长或格式错误");
  return value as string;
}
function flag(value: unknown) {
  requireValue(value, typeof value === "boolean", "标注开关格式错误");
  return value as boolean;
}
function arrowHead(value: unknown): "filled" | "open" {
  requireValue(value, value === "filled" || value === "open", "未知箭头样式");
  return value as "filled" | "open";
}
function lineStyle(value: unknown): NonNullable<RouteAnnotation["lineStyle"]> {
  requireValue(
    value,
    [
      "solid",
      "dashed",
      "dotted",
      "dashdot",
      "defense",
      "barrier",
      "front",
      "antitank",
      "advance",
    ].includes(value as string),
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
        ...(a.flip === undefined ? {} : { flip: flag(a.flip) }),
        ...(a.arrowHead === undefined ? {} : { arrowHead: arrowHead(a.arrowHead) }),
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
