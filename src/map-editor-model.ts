export type MapPoint = { x: number; y: number };
export type EditorContext = { mapId: string; layoutId: string; team: 1 | 2 };
type Base = { id: string; color: string; hidden: boolean; locked: boolean };
export type RouteAnnotation = Base & {
  kind: "path";
  points: MapPoint[];
  width: number;
  dashed: boolean;
  arrow: boolean;
};
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
export type Annotation = RouteAnnotation | IconAnnotation | TextAnnotation;
export type MapProject = EditorContext & { version: 1; updatedAt: string; items: Annotation[] };
export const MAX_ITEMS = 500;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const draftKey = (context: EditorContext) =>
  `wt-map-editor-v1:${context.mapId}:${context.layoutId}:${context.team}`;
export const sameContext = (a: EditorContext, b: EditorContext) =>
  a.mapId === b.mapId && a.layoutId === b.layoutId && a.team === b.team;
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export function moveAnnotation(item: Annotation, dx: number, dy: number): Annotation {
  const points = item.kind === "path" ? item.points : [item.point];
  dx = clamp(dx, -Math.min(...points.map((p) => p.x)), 1 - Math.max(...points.map((p) => p.x)));
  dy = clamp(dy, -Math.min(...points.map((p) => p.y)), 1 - Math.max(...points.map((p) => p.y)));
  const move = (p: MapPoint) => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) });
  return item.kind === "path"
    ? { ...item, points: points.map(move) }
    : { ...item, point: move(item.point) };
}
export const anchorPoint = (item: Annotation) =>
  item.kind === "path" ? item.points[0] : item.point;
export const pathData = (points: MapPoint[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x * 1000},${p.y * 1000}`).join(" ");
export function arrowPoints(item: RouteAnnotation): MapPoint[] {
  if (!item.arrow || item.points.length < 2) return [];
  const b = item.points.at(-1)!;
  const a = [...item.points].reverse().find((p) => Math.hypot(b.x - p.x, b.y - p.y) > 0.00001);
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
    : a.kind === "icon"
      ? a.caption || "图标标记"
      : a.arrow
        ? "箭头走线"
        : "折线 / 画笔";
}
