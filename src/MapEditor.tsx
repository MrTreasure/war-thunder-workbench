import { recordMapCompletion, flushMapDrawingLogs } from "./map-drawing-log";
import type { DrawingView } from "./map-drawing-log";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { AnnotationShape, RouteInk } from "./MapAnnotation";
/* Interactive SVG drawing surface has keyboard alternatives in the HTML object list. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { GameSelect } from "./components/GameSelect";
import { useBlocker } from "@tanstack/react-router";
import { MapPlansPanel } from "./MapPlansPanel";
import { MapPlanStore } from "./map-editor-plans";
import { useMapPlans } from "./use-map-plans";
import { mapFonts } from "./map-editor-fonts";
import type { MapFont } from "./map-editor-fonts";
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import catalog from "../data/map-editor-icons.json";
import palette from "../data/map-editor-palette.json";
import lineCatalog from "../data/map-editor-lines.json";
import { GroundThumbnail } from "./map-assets";
import { Modal } from "./Modal";
import {
  TacticalSymbol,
  tacticalSymbols,
  tacticalSymbolIds,
  tacticalSymbol,
} from "./map-editor-symbols";
import { downloadBlob } from "./map-editor-export";
import {
  annotationName,
  canvasCoordinate,
  CANVAS_MIN,
  CANVAS_MAX,
  bendPoints,
  routePoint,
  shapeBounds,
  shapeCorners,
  anchorPoint,
  clamp,
  createHistory,
  makeProject,
  MAX_FILE_BYTES,
  MAX_ITEMS,
  moveAnnotation,
  parseProject,
  readProject,
  reduceHistory,
  sameContext,
  serializeProject,
} from "./map-editor-model";
import type {
  Annotation,
  GeometryAnnotation,
  ShapeAnnotation,
  EditorContext,
  HistoryAction,
  MapPoint,
  MapProject,
  RouteAnnotation,
} from "./map-editor-model";

const icons = new Map(catalog.icons.map((i) => [i.id, i]));
const iconIds = new Set([...icons.keys(), ...tacticalSymbolIds]);
export const editorIconAssets = Object.fromEntries(catalog.icons.map((i) => [i.id, i.asset]));
export type MapEditorHandle = { finish: () => Annotation[] };
type Tool =
  | "pan"
  | "select"
  | "arrow"
  | "route"
  | "curve"
  | "pen"
  | "icon"
  | "text"
  | "shape"
  | "danger"
  | "sniper"
  | "tactical"
  | "defense";
type Props = {
  ref?: Ref<MapEditorHandle>;
  active: boolean;
  context: EditorContext;
  mapName: string;
  host: SVGGElement | null;
  svg: SVGSVGElement | null;
  viewWidth: number;
  view: { x: number; y: number; w: number; h: number };
  drawingView: DrawingView;
  close: () => void;
  mapControls: ReactNode;
  pan: (e: PointerEvent<SVGGElement>) => void;
  knownContext: (c: EditorContext) => boolean;
  openProject: (p: MapProject) => void;
  describeContext: (c: EditorContext) => string;
  exportImage: (
    items: Annotation[],
    resolution: number,
    signal: AbortSignal,
    progress: (loaded: number, total: number) => void,
  ) => Promise<Blob>;
};
type Gesture =
  | { kind: "move"; id: string; start: MapPoint; original: Annotation[]; result: Annotation[] }
  | {
      kind: "vertex";
      id: string;
      index: number;
      insert: boolean;
      start: MapPoint;
      path: GeometryAnnotation;
      original: Annotation[];
      result: Annotation[];
    }
  | { kind: "line"; start: MapPoint; second: boolean; moved: boolean }
  | { kind: "pen" };
const defaults = {
  arrow: false,
  curve: false,
  arrowHead: "filled" as "filled" | "open",
  lineStyle: "solid" as NonNullable<RouteAnnotation["lineStyle"]>,
  color: "#e4c477",
  width: 0.003,
  dashed: false,
  size: 0.035,
  fontSize: 0.018,
  font: "sans" as MapFont,
  fontWeight: 600 as 400 | 600 | 700,
  italic: false,
};
const id = () => crypto.randomUUID();
export function MapEditor({
  ref,
  active,
  context,
  mapName,
  host,
  svg,
  viewWidth,
  view,
  drawingView,
  close,
  mapControls,
  pan,
  knownContext,
  openProject,
  describeContext,
  exportImage,
}: Props) {
  const { session } = useWorkbenchAccount();
  useEffect(() => {
    void flushMapDrawingLogs();
    const flush = () => { void flushMapDrawingLogs(); };
    window.addEventListener("online", flush);
    const timer = window.setInterval(flush, 60000);
    return () => { window.removeEventListener("online", flush); window.clearInterval(timer); };
  }, [session?.user?.id]);
  const [initial] = useState(() => readProject(context, iconIds));
  const [coarsePointer] = useState(() => window.matchMedia("(pointer:coarse)").matches);
  const [unitsPerPixel, setUnitsPerPixel] = useState(viewWidth / 800);
  useEffect(() => {
    if (!svg) return;
    const update = () => {
      const matrix = svg.getScreenCTM();
      if (matrix) setUnitsPerPixel(1 / Math.hypot(matrix.a, matrix.b));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svg, viewWidth, active]);
  const hitWidth = unitsPerPixel * (coarsePointer ? 44 : 16);
  const handleRadius = unitsPerPixel * (coarsePointer ? 7 : 5);
  const [history, setHistory] = useState(() => createHistory(initial.items));
  const historyRef = useRef(history);
  const [tool, setTool] = useState<Tool>("select"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [settings, setSettings] = useState(defaults);
  const [shapeKind, setShapeKind] = useState<ShapeAnnotation["shape"]>("rectangle");
  const [replaceIcon, setReplaceIcon] = useState(false);
  const [iconId, setIconId] = useState("tactical_sniper"),
    [iconGroup, setIconGroup] = useState("火力与阵地");
  const [markerLibrary, setMarkerLibrary] = useState<"tactical" | "original">("tactical");
  const [markerQuery, setMarkerQuery] = useState("");
  const markerEntries = markerLibrary === "tactical" ? tacticalSymbols : catalog.icons;
  const [pending, setPendingState] = useState<GeometryAnnotation | null>(null);
  const pendingRef = useRef<GeometryAnnotation | null>(null);
  const [preview, setPreview] = useState<Annotation[] | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [panel, setPanel] = useState<
      "style" | "icons" | "layers" | "files" | "map" | "lines" | "plans" | null
    >(null),
    [notice, setNotice] = useState(initial.message),
    [storageError, setStorageError] = useState(false);
  const [incoming, setIncoming] = useState<MapProject | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [resolution, setResolution] = useState(2048);
  const [deletePlan, setDeletePlan] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const planHistories = useRef(new Map<string, ReturnType<typeof createHistory>>());
  const currentPlanId = useRef<string | null>(null);
  const plans = useMapPlans(context, initial.items, iconIds, (items, planId) => {
    if (currentPlanId.current) planHistories.current.set(currentPlanId.current, historyRef.current);
    const cached = planHistories.current.get(planId);
    const next =
      cached && JSON.stringify(cached.present) === JSON.stringify(items)
        ? cached
        : createHistory(items);
    currentPlanId.current = planId;
    historyRef.current = next;
    setHistory(next);
    gesture.current = null;
    pendingRef.current = null;
    setPendingState(null);
    setPreview(null);
    setSelectedId(null);
    setSelectedPoint(null);
    setTool("select");
    setNotice(
      initial.message.startsWith("无法读取")
        ? initial.message
        : `已载入本地方案 · ${items.length} 个标注`,
    );
  });
  const abort = useRef<AbortController | null>(null),
    file = useRef<HTMLInputElement>(null),
    textField = useRef<HTMLTextAreaElement>(null);
  const visible = preview || history.present;
  const selected = history.present.find((a) => a.id === selectedId);
  const setPending = (p: GeometryAnnotation | null) => {
    pendingRef.current = p;
    setPendingState(p);
  };
  useBlocker({
    shouldBlockFn: async () => {
      finish();
      if (!plans.hasUnsaved()) return false;
      try {
        await plans.flush();
        return false;
      } catch {
        return true;
      }
    },
    enableBeforeUnload: () => plans.hasUnsaved() || !!pendingRef.current || !!gesture.current,
  });
  function persist(items: Annotation[]) {
    plans.save(items);
    setStorageError(false);
    setNotice(`已保存 · ${items.length} 个标注`);
  }
  function change(action: HistoryAction) {
    const next = reduceHistory(historyRef.current, action);
    historyRef.current = next;
    setHistory(next);
    if (action.type !== "endGroup") persist(next.present);
  }
  function apply(items: Annotation[], group?: string) {
    try {
      parseProject(makeProject(context, items), iconIds, knownContext);
      change({ type: "commit", items, group });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法更新标注");
    }
  }
  function finish(): Annotation[] {
    const stroke = pendingRef.current;
    const moving = gesture.current;
    gesture.current = null;
    setPreview(null);
    setPending(null);

    let result = historyRef.current.present;
    if (moving?.kind === "move" || moving?.kind === "vertex") result = moving.result;
    if (
      stroke &&
      stroke.points.length >= 2 &&
      (stroke.kind !== "shape" ||
        (shapeBounds(stroke).w * 1000 > unitsPerPixel * 2 &&
          shapeBounds(stroke).h * 1000 > unitsPerPixel * 2)) &&
      stroke.points.some(
        (p) =>
          Math.hypot(p.x - stroke.points[0].x, p.y - stroke.points[0].y) * 1000 > unitsPerPixel * 2,
      )
    ) {
      result = [...result, stroke];
      setSelectedId(stroke.id);
      setSelectedPoint(null);
      setPanel("style");
      if (tool !== "pen") setTool("select");
    }
    if (result !== historyRef.current.present) apply(result);
    return historyRef.current.present;
  }
  useImperativeHandle(ref, () => ({ finish }));
  function add(item: Annotation) {
    if (historyRef.current.present.length >= MAX_ITEMS) {
      setNotice("最多支持 500 个标注，请删除部分内容后再添加");
      return;
    }
    apply([...historyRef.current.present, item]);
    setSelectedId(item.id);
    setSelectedPoint(null);
    setPanel("style");
  }
  function select(item: Annotation) {
    setSelectedId(item.id);
    setSelectedPoint(null);
    setPanel("style");
  }
  function patch(changes: Record<string, unknown>, group?: string) {
    if (!selected || selected.locked) return;
    apply(
      historyRef.current.present.map((a) =>
        a.id === selected.id ? ({ ...a, ...changes } as Annotation) : a,
      ),
      group,
    );
  }
  function remove() {
    if (!selected || selected.locked) return;
    apply(historyRef.current.present.filter((a) => a.id !== selected.id));
    setSelectedId(null);
  }
  function clearAll() {
    cancelGesture();
    apply([]);
    setSelectedId(null);
    setSelectedPoint(null);
    setTool("select");
    setNotice("已清除当前画布全部自定义标记");
  }
  function duplicate() {
    if (!selected) return;
    add({ ...moveAnnotation(selected, 0.015, 0.015), id: id(), locked: false });
  }
  function reorder(direction: number) {
    if (!selected || selected.locked) return;
    const list = [...historyRef.current.present],
      from = list.findIndex((a) => a.id === selected.id),
      to = clamp(from + direction, 0, list.length - 1);
    [list[from], list[to]] = [list[to], list[from]];
    apply(list);
  }
  function chooseTool(next: Tool) {
    finish();
    setReplaceIcon(false);
    if (next === "tactical") {
      if (panel === "lines") {
        setPanel(null);
        return;
      }
      setTool(settings.curve ? "curve" : settings.arrow ? "arrow" : "route");
      setSelectedId(null);
      setSelectedPoint(null);
      setPanel("lines");
      return;
    }
    if (next === "defense") {
      setTool("route");
      setSelectedId(null);
      setSelectedPoint(null);
      setSettings((s) => ({
        ...s,
        lineStyle: "defense",
        color: "#24ff2a",
        arrow: false,
        dashed: false,
      }));
      return;
    }
    setTool(next);
    if (next === "danger") setSettings((s) => ({ ...s, color: "#ff3020" }));
    setSelectedId(null);
    setSelectedPoint(null);
    setPanel(
      next === "icon" ? "icons" : next === "shape" ? "style" : panel === "icons" ? null : panel,
    );
  }
  function changeStyle(key: "color" | "width" | "dashed", value: string | number | boolean) {
    setSettings((s) => ({ ...s, [key]: value }));
    if (selected) patch({ [key]: value }, `${selected.id}:${key}`);
    if (pendingRef.current) setPending({ ...pendingRef.current, [key]: value });
  }
  function chooseLinePreset(presetId: string) {
    const preset = lineCatalog.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const lineStyle = preset.style as NonNullable<RouteAnnotation["lineStyle"]>;
    const arrowHead = preset.arrowHead as "filled" | "open";
    setSettings((s) => ({
      ...s,
      arrow: preset.arrow,
      arrowHead,
      color: preset.color,
      lineStyle,
      dashed: lineStyle === "dashed",
    }));
    if (selected?.kind === "path")
      patch({
        lineStyle,
        color: preset.color,
        arrowHead,
        dashed: lineStyle === "dashed",
        arrow: preset.arrow,
      });
    else setTool(settings.curve ? "curve" : preset.arrow ? "arrow" : "route");
  }
  function chooseLineCurve(curve: boolean) {
    finish();
    setSettings((s) => ({ ...s, curve }));
    if (selected?.kind === "path")
      patch({
        curve,
        ...(curve && selected.points.length === 2
          ? { points: bendPoints(selected.points[0], selected.points[1]) }
          : {}),
      });
    else setTool(curve ? "curve" : settings.arrow ? "arrow" : "route");
  }
  function resizePending(stroke: GeometryAnnotation, end: MapPoint): GeometryAnnotation {
    const start = stroke.points[0];
    return {
      ...stroke,
      points:
        stroke.kind === "shape"
          ? stroke.shape === "polygon"
            ? shapeCorners(start, end)
            : [start, end]
          : stroke.curve
            ? bendPoints(start, end)
            : [start, end],
    };
  }
  function toPoint(e: { clientX: number; clientY: number }): MapPoint | null {
    const matrix = svg?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: canvasCoordinate(p.x / 1000), y: canvasCoordinate(p.y / 1000) };
  }
  function pointerDown(e: PointerEvent<SVGGElement>) {
    if (!active || plans.loading || plans.working || e.button !== 0) return;
    e.stopPropagation();
    svg?.focus();
    if (tool === "pan") {
      pan(e);
      return;
    }
    const point = toPoint(e);
    if (!point) return;
    e.preventDefault();
    if (tool === "select") {
      const target = (e.target as Element).closest("[data-annotation-id]");
      const item = historyRef.current.present.find(
        (a) => a.id === target?.getAttribute("data-annotation-id"),
      );
      if (!item) {
        setSelectedId(null);
        setPanel(null);
        return;
      }
      select(item);
      if (item.locked) return;
      const handle = (e.target as Element).closest("[data-vertex],[data-midpoint]");
      if (handle && (item.kind === "path" || item.kind === "shape")) {
        const insert = handle.hasAttribute("data-midpoint");
        const index = Number(handle.getAttribute(insert ? "data-midpoint" : "data-vertex"));
        if (insert && item.points.length >= (item.kind === "shape" ? 128 : 3000)) {
          setNotice("单条走线最多 3000 个点");
          return;
        }
        setSelectedPoint(insert ? null : index);
        gesture.current = {
          kind: "vertex",
          id: item.id,
          index,
          insert,
          start: point,
          path: item,
          original: historyRef.current.present,
          result: historyRef.current.present,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      gesture.current = {
        kind: "move",
        id: item.id,
        start: point,
        original: historyRef.current.present,
        result: historyRef.current.present,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const base = { id: id(), color: settings.color, hidden: false, locked: false };
    if (tool === "icon" || tool === "sniper") {
      add({
        ...base,
        kind: "icon",
        point,
        iconId: tool === "sniper" ? "tactical_sniper" : iconId,
        size: settings.size,
        rotation: 0,
        caption: tool === "sniper" ? "狙击点" : tacticalSymbol(iconId)?.label || "",
      });
      setTool("select");
      return;
    }
    if (tool === "text") {
      add({
        ...base,
        kind: "text",
        point,
        text: "文字说明",
        fontSize: settings.fontSize,
        font: settings.font,
        fontWeight: settings.fontWeight,
        italic: settings.italic,
        rotation: 0,
      });
      setTool("select");
      setPanel("style");
      return;
    }
    if (historyRef.current.present.length >= MAX_ITEMS) {
      setNotice("最多支持 500 个标注");
      return;
    }
    if (tool === "shape" || tool === "danger") {
      const stroke = pendingRef.current;
      if (stroke) setPending(resizePending(stroke, point));
      else {
        const shape = tool === "danger" ? "polygon" : shapeKind;
        setPending({
          ...base,
          kind: "shape",
          color: base.color,
          shape,
          points: shape === "polygon" ? shapeCorners(point, point) : [point, point],
          width: settings.width,
          fillOpacity: 0.12,
          hatch: tool === "danger",
          caption: tool === "danger" ? "危险区域" : "",
        });
      }
      gesture.current = { kind: "line", start: point, second: !!stroke, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "pen") {
      setPending({
        ...base,
        kind: "path",
        points: [point],
        width: settings.width,
        dashed: settings.dashed,
        arrow: false,
      });
      gesture.current = { kind: "pen" };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const stroke = pendingRef.current;
    if (stroke) {
      setPending(resizePending(stroke, point));
    } else {
      setPending({
        ...base,
        kind: "path",
        points: [point, point],
        width: settings.width,
        dashed: settings.dashed,
        arrow: tool === "arrow" || (tool === "curve" && settings.arrow),
        curve: tool === "curve",
        lineStyle: settings.lineStyle,
        arrowHead: settings.arrowHead,
      });
    }
    gesture.current = { kind: "line", start: point, second: !!stroke, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent<SVGGElement>) {
    if (!active) return;
    e.stopPropagation();
    const point = toPoint(e);
    if (!point) return;
    const g = gesture.current;
    if (g?.kind === "move") {
      if (
        g.result === g.original &&
        Math.hypot(point.x - g.start.x, point.y - g.start.y) * 1000 < unitsPerPixel * 3
      )
        return;
      g.result = g.original.map((a) =>
        a.id === g.id ? moveAnnotation(a, point.x - g.start.x, point.y - g.start.y) : a,
      );
      setPreview(g.result);
      return;
    }
    if (g?.kind === "vertex") {
      if (
        g.result === g.original &&
        Math.hypot(point.x - g.start.x, point.y - g.start.y) * 1000 <
          unitsPerPixel * (g.insert ? 3 : 1)
      )
        return;
      const points = [...g.path.points];
      if (g.insert) points.splice(g.index, 0, point);
      else points[g.index] = point;
      g.result = g.original.map((a) => (a.id === g.id ? { ...g.path, points } : a));
      setSelectedPoint(g.index);
      setPreview(g.result);
      return;
    }
    const stroke = pendingRef.current;
    if (stroke && (g?.kind === "line" || (!g && tool !== "pen"))) {
      if (
        g?.kind === "line" &&
        Math.hypot(point.x - g.start.x, point.y - g.start.y) * 1000 >= unitsPerPixel * 4
      )
        g.moved = true;
      setPending(resizePending(stroke, point));
      return;
    }
    if (g?.kind === "pen" && stroke) {
      if (
        stroke.points.length < 3000 &&
        Math.hypot(point.x - stroke.points.at(-1)!.x, point.y - stroke.points.at(-1)!.y) > 0.0006
      )
        setPending({ ...stroke, points: [...stroke.points, point] });
    }
  }
  function pointerUp(e: PointerEvent<SVGGElement>) {
    if (!active) return;
    e.stopPropagation();
    const current = gesture.current;
    if (!current) return;
    pointerMove(e);
    if (current.kind === "line" && !current.second && !current.moved) {
      gesture.current = null;
      setNotice("点击终点即完成，或按 Esc 取消");
    } else finish();
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function deletePoint() {
    if (
      (selected?.kind !== "path" && selected?.kind !== "shape") ||
      selected.locked ||
      selectedPoint === null ||
      selected.points.length <= (selected.kind === "shape" ? 3 : 2)
    )
      return;
    patch({ points: selected.points.filter((_, i) => i !== selectedPoint) });
    setSelectedPoint(Math.min(selectedPoint, selected.points.length - 2));
  }
  function insertPoint() {
    if (
      (selected?.kind !== "path" && selected?.kind !== "shape") ||
      selected.locked ||
      (selected.kind === "shape" && selected.shape !== "polygon") ||
      selected.points.length >= (selected.kind === "shape" ? 128 : 3000)
    )
      return;
    const index = Math.min(selectedPoint ?? 0, selected.points.length - 2),
      a = selected.points[index],
      b = selected.points[index + 1],
      points = [...selected.points];
    points.splice(
      index + 1,
      0,
      selected.kind === "path"
        ? routePoint(selected, index, 0.5)
        : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    );
    patch({ points });
    setSelectedPoint(index + 1);
  }
  function cancelGesture() {
    gesture.current = null;
    setPreview(null);
    setPending(null);
  }
  const onKeys = useEffectEvent((e: KeyboardEvent) => {
    if (
      !active ||
      plans.loading ||
      plans.working ||
      document.querySelector("dialog[open]") ||
      (e.target as HTMLElement)?.closest(
        "input,textarea,select,[role=combobox],[role=listbox],[contenteditable=true]",
      )
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      cancelGesture();
      change({ type: e.shiftKey ? "redo" : "undo" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      cancelGesture();
      change({ type: "redo" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicate();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelGesture();
      setSelectedId(null);
      setTool("select");
      setPanel(null);
    }
    if (
      e.key === "Enter" &&
      pendingRef.current &&
      (e.target === document.body || svg?.contains(e.target as Node))
    ) {
      e.preventDefault();
      finish();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selected) {
        e.preventDefault();
        if (
          (selected.kind === "path" || selected.kind === "shape") &&
          selectedPoint !== null &&
          selected.points.length > (selected.kind === "shape" ? 3 : 2)
        )
          deletePoint();
        else remove();
      }
    }
    if (
      selected &&
      !selected.locked &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    ) {
      e.preventDefault();
      const step = e.shiftKey ? 0.01 : 0.001;
      if (
        (selected.kind === "path" || selected.kind === "shape") &&
        selectedPoint !== null &&
        selected.points[selectedPoint]
      ) {
        const p = selected.points[selectedPoint];
        patch({
          points: selected.points.map((v, i) =>
            i === selectedPoint
              ? {
                  x: canvasCoordinate(
                    p.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
                  ),
                  y: canvasCoordinate(
                    p.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0),
                  ),
                }
              : v,
          ),
        });
        return;
      }
      apply(
        historyRef.current.present.map((a) =>
          a.id === selected.id
            ? moveAnnotation(
                a,
                e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
                e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
              )
            : a,
        ),
      );
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeys(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const saveOnLeave = useEffectEvent(() => {
    const stroke = pendingRef.current;
    const moving = gesture.current;
    if (stroke || moving?.kind === "move" || moving?.kind === "vertex") {
      try {
        const items =
          moving?.kind === "move" || moving?.kind === "vertex"
            ? moving.result
            : historyRef.current.present;
        const hasLength = stroke?.points.some(
          (p) => Math.hypot(p.x - stroke.points[0].x, p.y - stroke.points[0].y) > 0.00001,
        );
        if (!plans.loading) plans.save(stroke && hasLength ? [...items, stroke] : items);
      } catch {
        /* Keep existing saved draft intact. */
      }
    }
  });
  useEffect(() => {
    const listener = () => saveOnLeave();
    window.addEventListener("pagehide", listener);
    return () => {
      window.removeEventListener("pagehide", listener);
      saveOnLeave();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (active) svg?.focus();
  }, [active, svg]);
  async function importFile(chosen: File) {
    try {
      if (chosen.size > MAX_FILE_BYTES) throw new Error("编辑文件不能超过 4 MiB");
      const parsed = parseProject(JSON.parse(await chosen.text()), iconIds, knownContext);
      setIncoming(parsed);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法读取编辑文件");
    }
  }
  async function confirmImport() {
    if (!incoming || importing) return;
    setImporting(true);
    try {
      finish();
      await plans.flush();
      const name = `导入方案 ${new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-")}`;
      if (sameContext(incoming, context)) await plans.create(name, incoming.items);
      else {
        const store = new MapPlanStore(incoming, iconIds);
        const legacy = readProject(incoming, iconIds);
        await store.load(makeProject(incoming, legacy.items));
        await store.create(name, incoming);
        openProject(incoming);
      }
      setIncoming(null);
    } catch {
      setNotice("无法保存导入的草稿，请先导出当前内容并检查浏览器空间");
    } finally {
      setImporting(false);
    }
  }
  function exportFile() {
    const items = finish();
    try {
      const body = serializeProject(makeProject(context, items));
      downloadBlob(
        new Blob([body], { type: "application/json" }),
        `${mapName}-${plans.active?.name || "走线"}-${context.layoutId}-队伍${context.team}.wtmap.json`,
      );
      setNotice("编辑文件已导出，可再次导入继续修改");
      plans.markExported();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "编辑文件导出失败");
    }
  }
  async function exportPng() {
    if (busy) return;
    const items = finish(),
      controller = new AbortController();
    abort.current = controller;
    setBusy("正在准备图片…");
    try {
      const blob = await exportImage(items, resolution, controller.signal, (loaded, total) => {
        if (!controller.signal.aborted) setBusy(`正在准备图层 ${loaded}/${total}`);
      });
      if (controller.signal.aborted) return;
      downloadBlob(blob, `${mapName}-队伍${context.team}-${plans.active?.name || "走线"}.png`);
      setNotice("图片已导出");
    } catch (error) {
      controller.abort();
      setNotice(error instanceof Error ? error.message : "图片导出失败，请保存编辑文件后重试");
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }
  const currentDraft = pending;
  const selectedGeometry = visible.find(
    (a): a is GeometryAnnotation =>
      a.id === selectedId && (a.kind === "path" || a.kind === "shape") && !a.hidden,
  );
  const rendered =
    host &&
    createPortal(
      <g
        data-map-annotations="true"
        data-active={active && !plans.loading && !plans.working}
        pointerEvents={active && !plans.loading && !plans.working ? "auto" : "none"}
        style={{
          cursor: active
            ? tool === "pan"
              ? "grab"
              : tool === "select"
                ? "default"
                : "crosshair"
            : undefined,
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={() => {
          if (gesture.current) cancelGesture();
        }}
        onDoubleClick={(e) => {
          if (!active || tool !== "select") return;
          const handle = (e.target as Element).closest("[data-vertex]");
          if (
            handle &&
            selectedGeometry &&
            !selectedGeometry.locked &&
            selectedGeometry.points.length > (selectedGeometry.kind === "shape" ? 3 : 2)
          ) {
            e.preventDefault();
            e.stopPropagation();
            const index = Number(handle.getAttribute("data-vertex"));
            apply(
              historyRef.current.present.map((a) =>
                a.id === selectedGeometry.id
                  ? {
                      ...selectedGeometry,
                      points: selectedGeometry.points.filter((_, i) => i !== index),
                    }
                  : a,
              ),
            );
            setSelectedPoint(null);
          } else if (selected?.kind === "text") {
            setPanel("style");
            requestAnimationFrame(() => textField.current?.focus());
          }
        }}
      >
        {active && (
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="transparent"
            data-editor-ui="true"
          />
        )}
        {visible
          .filter((a) => !a.hidden)
          .map((item) => (
            <AnnotationShape
              key={item.id}
              item={item}
              selected={active && item.id === selectedId}
              hitWidth={hitWidth}
            />
          ))}
        {active && tool === "select" && selectedGeometry && !selectedGeometry.locked && (
          <LineHandles
            item={selectedGeometry}
            selectedPoint={selectedPoint}
            radius={handleRadius}
            hitWidth={hitWidth}
          />
        )}
        {active && currentDraft && (
          <g opacity={0.8} data-editor-ui="true">
            <AnnotationShape item={currentDraft} selected={false} hitWidth={hitWidth} />
            {currentDraft.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x * 1000}
                cy={p.y * 1000}
                r={viewWidth * 0.004}
                fill={currentDraft.color}
              />
            ))}
          </g>
        )}
      </g>,
      host,
    );
  if (!active) return rendered;
  return (
    <>
      {rendered}
      <div className="map-editor-ui">
        <div
          className="map-editor-tools"
          role="toolbar"
          aria-label="走线绘制工具"
          inert={plans.loading || plans.working}
        >
          {(
            [
              ["select", "选择", "↖"],
              ["pan", "平移", "✥"],
              ["tactical", "战术线", "⌁"],
              ["pen", "画笔", "〰"],
              ["shape", "形状", "▱"],
              ["icon", "标记", "◇"],
              ["text", "文字", "T"],
            ] as const
          ).map(([value, label, glyph]) => (
            <button
              key={value}
              title={label}
              aria-pressed={
                value === "tactical"
                  ? ["arrow", "route", "curve"].includes(tool)
                  : value === "shape"
                    ? tool === "shape" || tool === "danger"
                    : tool === value
              }
              aria-expanded={value === "tactical" ? panel === "lines" : undefined}
              aria-controls={value === "tactical" ? "map-editor-inspector" : undefined}
              onClick={() => chooseTool(value)}
            >
              <span aria-hidden="true">{glyph}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        <div
          className="map-editor-actions"
          role="toolbar"
          aria-label="地图编辑操作"
          inert={plans.loading || plans.working}
        >
          <button
            className="map-editor-exit"
            onClick={() => {
              const completed = finish();
              const project = makeProject(context, completed);
              void recordMapCompletion({
                ownerKey: session?.user ? `user:${session.user.id}` : "guest",
                planName: plans.active?.name || "默认方案",
                project,
                view: { ...drawingView, crop: [...drawingView.crop] },
              });
              close();
            }}
          >
            完成
          </button>
          <strong className="map-editor-title" title={`${mapName} · 队伍 ${context.team}`}>
            {mapName}
            <small>{plans.active?.name || "走线编辑"}</small>
          </strong>
          <button
            title="撤销 Ctrl+Z"
            aria-label="撤销"
            disabled={!history.past.length || !!busy}
            onClick={() => {
              cancelGesture();
              change({ type: "undo" });
            }}
          >
            ↶
          </button>
          <button
            title="重做 Ctrl+Shift+Z"
            aria-label="重做"
            disabled={!history.future.length || !!busy}
            onClick={() => {
              cancelGesture();
              change({ type: "redo" });
            }}
          >
            ↷
          </button>
          <button
            className="map-editor-clear"
            disabled={!history.present.length && !pending}
            title="清除当前画布全部自定义标注，包括隐藏和锁定标注；可撤销"
            onClick={clearAll}
          >
            清除标记
          </button>
          <fieldset className="map-editor-quick-colors" aria-label="常用标注颜色">
            {palette.colors.map((color) => (
              <button
                key={color.value}
                title={color.name}
                aria-label={color.name}
                aria-pressed={(selected?.color || settings.color).toLowerCase() === color.value}
                disabled={selected?.locked}
                style={{ "--wt-swatch": color.value } as CSSProperties}
                onClick={() => changeStyle("color", color.value)}
              >
                <i />
              </button>
            ))}
          </fieldset>
          {(
            [
              ["style", "属性"],
              ["plans", "方案"],
              ["layers", "图层"],
              ["map", "底图"],
              ["files", "导出"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={panel === value}
              onClick={() => {
                finish();
                setPanel(panel === value ? null : value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          ref={file}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept=".json,.wtmap,application/json"
          aria-label="导入地图编辑文件"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen) void importFile(chosen);
          }}
        />
        {panel && (
          <aside
            id="map-editor-inspector"
            className="map-editor-inspector"
            data-panel={panel}
            aria-label="标注编辑面板"
          >
            <header>
              <strong>
                {panel === "icons"
                  ? "地图标记"
                  : panel === "lines"
                    ? "军事战术线"
                    : panel === "layers"
                      ? "标注图层"
                      : panel === "plans"
                        ? "走线方案"
                        : panel === "files"
                          ? "导入与导出"
                          : panel === "map"
                            ? "底图与布局"
                            : selected
                              ? annotationName(selected)
                              : "绘制样式"}
              </strong>
              <button
                className="map-editor-panel-close"
                aria-label="收起编辑面板"
                onClick={() => {
                  setPanel(null);
                  svg?.focus();
                }}
              >
                ×
              </button>
            </header>
            {panel === "lines" ? (
              <>
                <div className="map-editor-draw-mode" role="toolbar" aria-label="线条绘制方式">
                  {(
                    [
                      [false, "直线 / 折线"],
                      [true, "平滑曲线"],
                    ] as const
                  ).map(([curve, label]) => (
                    <button
                      key={label}
                      disabled={selected?.locked}
                      aria-pressed={
                        (selected?.kind === "path" ? !!selected.curve : settings.curve) === curve
                      }
                      onClick={() => chooseLineCurve(curve)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p>选择线型后拖动绘制；选中现有线条时直接替换样式。</p>
                <div className="map-editor-tactical-presets">
                  {lineCatalog.presets.map((preset) => (
                    <button
                      key={preset.id}
                      disabled={selected?.locked}
                      aria-pressed={
                        selected?.kind === "path"
                          ? selected.lineStyle === preset.style &&
                            selected.color.toLowerCase() === preset.color
                          : settings.lineStyle === preset.style &&
                            settings.color.toLowerCase() === preset.color
                      }
                      onClick={() => chooseLinePreset(preset.id)}
                    >
                      <svg
                        className="map-editor-line-preview"
                        viewBox="0 -30 1000 200"
                        aria-hidden="true"
                      >
                        <RouteInk
                          item={{
                            id: "preview",
                            kind: "path",
                            hidden: false,
                            locked: false,
                            color: preset.color,
                            width: 0.008,
                            points: [
                              { x: 0.04, y: 0.08 },
                              { x: 0.48, y: 0.065 },
                              { x: 0.95, y: 0.08 },
                            ],
                            dashed: preset.style === "dashed",
                            arrow: preset.arrow,
                            arrowHead: preset.arrowHead as "filled" | "open",
                            lineStyle: preset.style as NonNullable<RouteAnnotation["lineStyle"]>,
                            curve: true,
                          }}
                        />
                      </svg>
                      <strong>{preset.name}</strong>
                      <small>{preset.detail}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : panel === "plans" ? (
              <MapPlansPanel
                library={plans.library}
                disabled={plans.loading || plans.working}
                saving={plans.saving}
                error={plans.error}
                choose={async (id) => {
                  finish();
                  await plans.select(id);
                }}
                action={async (kind, name) => {
                  const items = finish();
                  if (kind === "rename") await plans.rename(name);
                  else await plans.create(name, kind === "copy" ? items : []);
                }}
                save={async () => {
                  persist(finish());
                  await plans.flush();
                }}
                remove={() => setDeletePlan(plans.active?.id || null)}
              />
            ) : panel === "files" ? (
              <div className="map-editor-fields">
                <p>当前方案的修改自动保存到此浏览器。导出编辑文件可在其他设备继续修改。</p>
                <button
                  onClick={() => {
                    persist(finish());
                  }}
                >
                  保存当前方案
                </button>
                <button
                  onClick={() => {
                    finish();
                    file.current?.click();
                  }}
                >
                  导入编辑文件
                </button>
                <button onClick={exportFile}>导出编辑文件</button>
                <label>
                  图片尺寸
                  <GameSelect
                    value={resolution}
                    onValueChange={(value) => setResolution(Number(value))}
                  >
                    <option value={2048}>2K 图片</option>
                    <option value={4096}>4K 图片</option>
                  </GameSelect>
                </label>
                <button disabled={!!busy} onClick={() => void exportPng()}>
                  导出图片
                </button>
              </div>
            ) : panel === "map" ? (
              mapControls
            ) : panel === "icons" ? (
              <>
                <div className="map-editor-library-tabs" role="toolbar" aria-label="标记图库">
                  {(
                    [
                      ["tactical", "战术符号"],
                      ["original", "战雷原生"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={markerLibrary === value}
                      onClick={() => {
                        setMarkerLibrary(value);
                        setIconGroup(
                          value === "tactical" ? tacticalSymbols[0].group : catalog.icons[0].group,
                        );
                        setMarkerQuery("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  className="map-editor-marker-search"
                  type="search"
                  aria-label="搜索地图标记"
                  placeholder="搜索标记"
                  value={markerQuery}
                  onChange={(e) => setMarkerQuery(e.target.value)}
                />
                <div className="map-editor-icon-tabs">
                  {[...new Set(markerEntries.map((i) => i.group))].map((group) => (
                    <button
                      key={group}
                      aria-pressed={iconGroup === group}
                      onClick={() => setIconGroup(group)}
                    >
                      {group}
                    </button>
                  ))}
                </div>
                <p>{replaceIcon ? "选择标记替换当前标注。" : "选择标记后，点击地图放置。"}</p>
                <div className="map-editor-icon-grid">
                  {markerEntries
                    .filter((i) =>
                      markerQuery ? i.label.includes(markerQuery.trim()) : i.group === iconGroup,
                    )
                    .map((icon) => (
                      <button
                        key={icon.id}
                        title={icon.label}
                        aria-label={icon.label}
                        aria-pressed={iconId === icon.id}
                        onClick={() => {
                          setIconId(icon.id);
                          if (replaceIcon && selected?.kind === "icon") {
                            patch({ iconId: icon.id });
                            setReplaceIcon(false);
                            setPanel("style");
                            setTool("select");
                          } else setTool("icon");
                        }}
                      >
                        {"asset" in icon ? (
                          <GroundThumbnail
                            asset={icon.asset}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                          />
                        ) : (
                          <svg
                            className="map-editor-symbol-preview"
                            viewBox="0 0 32 32"
                            aria-hidden="true"
                          >
                            <TacticalSymbol id={icon.id} />
                          </svg>
                        )}
                        <span>{icon.label}</span>
                      </button>
                    ))}
                </div>
                {!markerEntries.some((i) =>
                  markerQuery ? i.label.includes(markerQuery.trim()) : i.group === iconGroup,
                ) && <p>没有找到匹配标记。</p>}
              </>
            ) : panel === "layers" ? (
              <>
                <p>点击图层选择；锁定后可避免误拖动。</p>
                <ol className="map-editor-layer-list">
                  {history.present.map((a) => (
                    <li key={a.id}>
                      <button
                        aria-pressed={a.id === selectedId}
                        onClick={() => {
                          select(a);
                          setTool("select");
                        }}
                      >
                        {annotationName(a)}
                      </button>
                      <button
                        aria-label={`${a.hidden ? "显示" : "隐藏"}${annotationName(a)}`}
                        onClick={() =>
                          apply(
                            historyRef.current.present.map((v) =>
                              v.id === a.id ? { ...v, hidden: !v.hidden } : v,
                            ),
                          )
                        }
                      >
                        {a.hidden ? "显示" : "隐藏"}
                      </button>
                      <button
                        aria-label={`${a.locked ? "解锁" : "锁定"}${annotationName(a)}`}
                        onClick={() =>
                          apply(
                            historyRef.current.present.map((v) =>
                              v.id === a.id ? { ...v, locked: !v.locked } : v,
                            ),
                          )
                        }
                      >
                        {a.locked ? "解锁" : "锁定"}
                      </button>
                    </li>
                  ))}
                </ol>
                <button disabled={!history.present.length} onClick={clearAll}>
                  清空标注
                </button>
              </>
            ) : (
              <div className="map-editor-fields">
                {!selected && (tool === "shape" || tool === "danger") && (
                  <label>
                    形状
                    <GameSelect
                      value={tool === "danger" ? "danger" : shapeKind}
                      onValueChange={(value) => {
                        if (value === "danger") {
                          chooseTool("danger");
                          return;
                        }
                        finish();
                        setShapeKind(value as ShapeAnnotation["shape"]);
                        setTool("shape");
                      }}
                    >
                      <option value="rectangle">矩形</option>
                      <option value="ellipse">椭圆 / 圆</option>
                      <option value="polygon">可编辑多边形</option>
                      <option value="danger">危险区域（多边形）</option>
                    </GameSelect>
                    <small>拖出范围后，拖动控制点调整形状。</small>
                  </label>
                )}
                {selected && (
                  <label className="map-editor-check">
                    <input
                      type="checkbox"
                      checked={selected.locked}
                      onChange={(e) =>
                        apply(
                          historyRef.current.present.map((a) =>
                            a.id === selected.id ? { ...a, locked: e.target.checked } : a,
                          ),
                        )
                      }
                    />
                    锁定当前标注
                  </label>
                )}
                <fieldset className="map-editor-color-presets" aria-label="战雷常用颜色">
                  {palette.colors.map((color) => (
                    <button
                      key={color.value}
                      aria-label={color.name}
                      title={color.name}
                      aria-pressed={
                        (selected?.color || settings.color).toLowerCase() === color.value
                      }
                      disabled={selected?.locked}
                      style={{ "--wt-swatch": color.value } as CSSProperties}
                      onClick={() => changeStyle("color", color.value)}
                    >
                      <i />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </fieldset>
                <label>
                  自定义颜色
                  <input
                    type="color"
                    value={selected?.color || settings.color}
                    disabled={selected?.locked}
                    onChange={(e) => changeStyle("color", e.target.value)}
                    onBlur={() => change({ type: "endGroup" })}
                  />
                </label>
                {(!selected || selected.kind === "path" || selected.kind === "shape") && (
                  <>
                    {(selected?.kind === "path" || selected?.kind === "shape") && (
                      <>
                        <p>拖实心点调整，拖空心中点加拐点。双击拐点可删除。</p>
                        <label>
                          编辑端点 / 拐点
                          <GameSelect
                            value={selectedPoint ?? ""}
                            disabled={selected.locked}
                            onValueChange={(value) =>
                              setSelectedPoint(value === "" ? null : Number(value))
                            }
                          >
                            <option value="">整体移动</option>
                            {selected.points.map((_, i) => (
                              <option key={i} value={i}>
                                {selected.kind === "shape"
                                  ? `控制点 ${i + 1}`
                                  : i === 0
                                    ? "起点"
                                    : i === selected.points.length - 1
                                      ? "终点"
                                      : `拐点 ${i}`}
                              </option>
                            ))}
                          </GameSelect>
                        </label>
                        <div className="map-editor-selection-actions">
                          <button
                            disabled={
                              selected.locked ||
                              (selected.kind === "shape" && selected.shape !== "polygon") ||
                              selected.points.length >= (selected.kind === "shape" ? 128 : 3000)
                            }
                            onClick={insertPoint}
                          >
                            添加拐点
                          </button>
                          <button
                            disabled={
                              selected.locked ||
                              selectedPoint === null ||
                              selected.points.length <= (selected.kind === "shape" ? 3 : 2)
                            }
                            onClick={deletePoint}
                          >
                            删除拐点
                          </button>
                        </div>
                      </>
                    )}
                    <label>
                      线条粗细
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={
                          (selected?.kind === "path" || selected?.kind === "shape"
                            ? selected.width
                            : settings.width) * 1000
                        }
                        disabled={selected?.locked}
                        onChange={(e) => changeStyle("width", Number(e.target.value) / 1000)}
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    {(!selected || selected.kind === "path") && (
                      <>
                        <label>
                          战术线样式
                          <GameSelect
                            value={
                              selected?.kind === "path"
                                ? selected.lineStyle || (selected.dashed ? "dashed" : "solid")
                                : settings.lineStyle
                            }
                            disabled={selected?.locked}
                            onValueChange={(value) => {
                              const lineStyle = value as NonNullable<RouteAnnotation["lineStyle"]>;
                              setSettings((s) => ({ ...s, lineStyle }));
                              if (selected?.kind === "path")
                                patch({ lineStyle, dashed: lineStyle === "dashed" });
                            }}
                          >
                            <option value="solid">实线</option>
                            <option value="dashed">虚线</option>
                            <option value="dotted">点线 / 射界</option>
                            <option value="dashdot">点划线 / 补给</option>
                            <option value="defense">折齿 / 工事防御线</option>
                            <option value="front">弧齿 / 前沿阵线</option>
                            <option value="antitank">三角齿 / 反坦克壕线</option>
                            <option value="advance">中空宽箭头 / 进攻轴线</option>
                            <option value="barrier">交叉 / 障碍封锁线</option>
                          </GameSelect>
                        </label>
                        <button onClick={() => setPanel("lines")}>查看全部战术线型</button>
                        {selected?.kind === "path" && (
                          <label className="map-editor-check">
                            <input
                              type="checkbox"
                              checked={!!selected.curve}
                              disabled={selected.locked}
                              onChange={(e) =>
                                patch({
                                  curve: e.target.checked,
                                  ...(e.target.checked && selected.points.length === 2
                                    ? { points: bendPoints(selected.points[0], selected.points[1]) }
                                    : {}),
                                })
                              }
                            />
                            平滑曲线
                          </label>
                        )}
                      </>
                    )}
                    {selected?.kind === "path" && (
                      <>
                        {["defense", "front", "antitank"].includes(selected.lineStyle || "") && (
                          <label className="map-editor-check">
                            <input
                              type="checkbox"
                              checked={!!selected.flip}
                              disabled={selected.locked}
                              onChange={(e) => patch({ flip: e.target.checked })}
                            />
                            翻转阵线朝向
                          </label>
                        )}
                        {selected.arrow && selected.lineStyle !== "advance" && (
                          <label>
                            箭头形式
                            <GameSelect
                              value={selected.arrowHead || "filled"}
                              disabled={selected.locked}
                              onValueChange={(value) => patch({ arrowHead: value })}
                            >
                              <option value="open">军事方向箭头（开口）</option>
                              <option value="filled">实心箭头</option>
                            </GameSelect>
                          </label>
                        )}
                      </>
                    )}
                    {selected?.kind === "path" && selected.lineStyle !== "advance" && (
                      <label className="map-editor-check">
                        <input
                          type="checkbox"
                          checked={selected.arrow}
                          disabled={selected.locked}
                          onChange={(e) => patch({ arrow: e.target.checked })}
                        />
                        末端箭头
                      </label>
                    )}
                  </>
                )}
                {selected?.kind === "shape" && (
                  <>
                    <label>
                      区域说明
                      <textarea
                        value={selected.caption}
                        maxLength={300}
                        disabled={selected.locked}
                        onChange={(e) =>
                          patch({ caption: e.target.value }, `${selected.id}:caption`)
                        }
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <label>
                      填充透明度
                      <input
                        type="range"
                        min={0}
                        max={60}
                        value={selected.fillOpacity * 100}
                        disabled={selected.locked}
                        onChange={(e) =>
                          patch(
                            { fillOpacity: Number(e.target.value) / 100 },
                            `${selected.id}:fillOpacity`,
                          )
                        }
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <label className="map-editor-check">
                      <input
                        type="checkbox"
                        checked={selected.hatch}
                        disabled={selected.locked}
                        onChange={(e) => patch({ hatch: e.target.checked })}
                      />
                      危险区斜线填充
                    </label>
                  </>
                )}
                {selected?.kind === "icon" && (
                  <>
                    <label>
                      图标大小
                      <input
                        type="range"
                        min={8}
                        max={200}
                        value={selected.size * 1000}
                        disabled={selected.locked}
                        onChange={(e) =>
                          patch({ size: Number(e.target.value) / 1000 }, `${selected.id}:size`)
                        }
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <label>
                      文字说明
                      <textarea
                        value={selected.caption}
                        maxLength={300}
                        disabled={selected.locked}
                        onChange={(e) =>
                          patch({ caption: e.target.value }, `${selected.id}:caption`)
                        }
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <button
                      disabled={selected.locked}
                      onClick={() => {
                        setIconId(selected.iconId);
                        const original = icons.get(selected.iconId),
                          tactical = tacticalSymbol(selected.iconId);
                        setMarkerLibrary(tactical ? "tactical" : "original");
                        setIconGroup(tactical?.group || original?.group || "单位与队伍");
                        setMarkerQuery("");
                        setReplaceIcon(true);
                        setPanel("icons");
                      }}
                    >
                      更换图标
                    </button>
                  </>
                )}
                {selected?.kind === "text" && (
                  <>
                    <label>
                      文字说明
                      <textarea
                        ref={textField}
                        value={selected.text}
                        maxLength={1000}
                        disabled={selected.locked}
                        onChange={(e) => patch({ text: e.target.value }, `${selected.id}:text`)}
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <label>
                      字体
                      <GameSelect
                        value={selected.font || "sans"}
                        disabled={selected.locked}
                        onValueChange={(font) => {
                          setSettings((value) => ({ ...value, font: font as MapFont }));
                          patch({ font });
                        }}
                      >
                        {mapFonts.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </GameSelect>
                    </label>
                    <label>
                      字重
                      <GameSelect
                        value={selected.fontWeight ?? 600}
                        disabled={selected.locked}
                        onValueChange={(weight) => {
                          const fontWeight = Number(weight) as 400 | 600 | 700;
                          setSettings((value) => ({ ...value, fontWeight }));
                          patch({ fontWeight });
                        }}
                      >
                        <option value={400}>常规</option>
                        <option value={600}>半粗</option>
                        <option value={700}>加粗</option>
                      </GameSelect>
                    </label>
                    <label className="map-editor-check">
                      <input
                        type="checkbox"
                        checked={!!selected.italic}
                        disabled={selected.locked}
                        onChange={(event) => {
                          setSettings((value) => ({ ...value, italic: event.target.checked }));
                          patch({ italic: event.target.checked });
                        }}
                      />
                      斜体
                    </label>
                    <small>字体显示取决于设备中可用的字体，导出图片沿用当前设置。</small>
                    <label>
                      字号
                      <input
                        type="range"
                        min={8}
                        max={100}
                        value={selected.fontSize * 1000}
                        disabled={selected.locked}
                        onChange={(e) =>
                          patch(
                            { fontSize: Number(e.target.value) / 1000 },
                            `${selected.id}:fontSize`,
                          )
                        }
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                  </>
                )}
                {selected && selected.kind !== "path" && selected.kind !== "shape" && (
                  <label>
                    旋转角度
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={selected.rotation}
                      disabled={selected.locked}
                      onChange={(e) =>
                        patch({ rotation: Number(e.target.value) }, `${selected.id}:rotation`)
                      }
                      onBlur={() => change({ type: "endGroup" })}
                    />
                  </label>
                )}
                {selected && (
                  <>
                    <div className="map-editor-coordinate-fields">
                      {(["x", "y"] as const).map((axis) => (
                        <label key={axis}>
                          {axis.toUpperCase()} %
                          <input
                            type="number"
                            min={CANVAS_MIN * 100}
                            max={CANVAS_MAX * 100}
                            step={0.1}
                            value={Number(
                              (
                                (((selected.kind === "path" || selected.kind === "shape") &&
                                selectedPoint !== null
                                  ? selected.points[selectedPoint]
                                  : null) || anchorPoint(selected))[axis] * 100
                              ).toFixed(2),
                            )}
                            disabled={selected.locked}
                            onChange={(e) => {
                              if (
                                (selected.kind === "path" || selected.kind === "shape") &&
                                selectedPoint !== null
                              ) {
                                patch(
                                  {
                                    points: selected.points.map((p, i) =>
                                      i === selectedPoint
                                        ? {
                                            ...p,
                                            [axis]: canvasCoordinate(Number(e.target.value) / 100),
                                          }
                                        : p,
                                    ),
                                  },
                                  `${selected.id}:point:${selectedPoint}:${axis}`,
                                );
                                return;
                              }
                              const delta =
                                canvasCoordinate(Number(e.target.value) / 100) -
                                anchorPoint(selected)[axis];
                              apply(
                                historyRef.current.present.map((a) =>
                                  a.id === selected.id
                                    ? moveAnnotation(
                                        a,
                                        axis === "x" ? delta : 0,
                                        axis === "y" ? delta : 0,
                                      )
                                    : a,
                                ),
                                `${selected.id}:${axis}`,
                              );
                            }}
                            onBlur={() => change({ type: "endGroup" })}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="map-editor-selection-actions">
                      <button disabled={selected.locked} onClick={() => reorder(1)}>
                        上移一层
                      </button>
                      <button disabled={selected.locked} onClick={() => reorder(-1)}>
                        下移一层
                      </button>
                      <button onClick={duplicate}>复制</button>
                      <button disabled={selected.locked} onClick={remove}>
                        删除
                      </button>
                    </div>
                    <p>也可选中标注后使用方向键微调；Shift 加速。</p>
                  </>
                )}
              </div>
            )}
          </aside>
        )}
        <output className={`map-editor-status${storageError || plans.error ? " is-error" : ""}`}>
          {busy ? (
            <>
              {busy}
              <button onClick={() => abort.current?.abort()}>取消导出</button>
            </>
          ) : (
            <>
              <span>
                {pending
                  ? tool === "pen"
                    ? "松开完成画笔"
                    : "松开完成线条；也可点击起点、终点"
                  : tool === "arrow" || tool === "route" || tool === "curve"
                    ? "拖出线条，松开后直接编辑端点"
                    : tool === "danger" || tool === "shape"
                      ? "拖出区域，松开后调整形状"
                      : tool === "sniper"
                        ? "点击地图添加狙击点"
                        : tool === "icon"
                          ? "点击地图放置原生图标"
                          : tool === "text"
                            ? "点击地图添加文字"
                            : selectedGeometry
                              ? "拖实心点调整 · 拖空心点加拐点 · 拖线移动"
                              : "选择标注编辑；按 Esc 取消选择"}
              </span>
              <span className="map-editor-save-state" aria-live="polite">
                {plans.loading
                  ? "正在读取本地方案…"
                  : plans.error ||
                    (plans.working
                      ? "正在切换方案…"
                      : plans.saving
                        ? "正在保存方案…"
                        : plans.active
                          ? `${plans.active.name} · ${notice}`
                          : notice)}
              </span>
            </>
          )}
        </output>
      </div>
      {incoming && (
        <Modal
          title="导入走线编辑文件"
          close={() => {
            if (!importing) setIncoming(null);
          }}
          className="map-editor-import-dialog"
        >
          <p>{describeContext(incoming)}</p>
          <p>
            包含 {incoming.items.length}{" "}
            个标注。确认后将保存为该地图、布局和队伍下的新方案，已有方案会保留。
          </p>
          <div className="map-editor-dialog-actions">
            <button disabled={importing} onClick={() => setIncoming(null)}>
              取消
            </button>
            <button
              disabled={importing || plans.working || plans.loading}
              onClick={() => void confirmImport()}
            >
              {importing ? "正在导入…" : "导入并打开"}
            </button>
          </div>
        </Modal>
      )}
      {deletePlan && (
        <Modal
          title="删除走线方案"
          close={() => setDeletePlan(null)}
          className="map-editor-import-dialog"
        >
          <p>确认删除“{plans.active?.name}”？其他方案不受影响。需要保留时，请先导出编辑文件。</p>
          <div className="map-editor-dialog-actions">
            <button disabled={plans.working} onClick={() => setDeletePlan(null)}>
              取消
            </button>
            <button
              disabled={plans.working}
              onClick={() => {
                if (deletePlan !== plans.active?.id) {
                  setDeletePlan(null);
                  return;
                }
                finish();
                void plans
                  .remove()
                  .then(() => {
                    planHistories.current.delete(deletePlan);
                    setDeletePlan(null);
                  })
                  .catch(() => {});
              }}
            >
              删除方案
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function LineHandles({
  item,
  selectedPoint,
  radius,
  hitWidth,
}: {
  item: GeometryAnnotation;
  selectedPoint: number | null;
  radius: number;
  hitWidth: number;
}) {
  return (
    <g data-annotation-id={item.id} data-editor-ui="true">
      {(item.kind === "shape" && item.shape !== "polygon"
        ? []
        : item.kind === "shape"
          ? [...item.points.slice(1), item.points[0]]
          : item.points.slice(1)
      ).map((p, i) => {
        const a = item.points[i];
        if (
          Math.hypot(p.x - a.x, p.y - a.y) * 1000 < radius * 8 ||
          item.points.length >= (item.kind === "shape" ? 128 : 3000)
        )
          return null;
        const middle =
          item.kind === "path"
            ? routePoint(item, i, 0.5)
            : { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
        const x = middle.x * 1000,
          y = middle.y * 1000;
        return (
          <g key={`mid-${i}`} data-midpoint={i + 1} style={{ cursor: "copy" }}>
            <title>拖动添加拐点</title>
            <circle cx={x} cy={y} r={hitWidth / 2} fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={radius * 0.8}
              fill="#20272f"
              stroke="#70b9ff"
              strokeWidth={radius * 0.3}
              pointerEvents="none"
            />
          </g>
        );
      })}
      {item.points.map((p, i) => {
        // Dense freehand paths retain their points; avoid covering the stroke with handles.
        if (
          i > 0 &&
          i < item.points.length - 1 &&
          i !== selectedPoint &&
          Math.hypot(p.x - item.points[i - 1].x, p.y - item.points[i - 1].y) * 1000 < radius * 4
        )
          return null;
        return (
          <g key={`point-${i}`} data-vertex={i} style={{ cursor: "move" }}>
            <title>
              {i === 0 ? "起点" : i === item.points.length - 1 ? "终点" : `拐点 ${i}`}：拖动调整位置
            </title>
            <circle cx={p.x * 1000} cy={p.y * 1000} r={hitWidth / 2} fill="transparent" />
            <circle
              cx={p.x * 1000}
              cy={p.y * 1000}
              r={i === selectedPoint ? radius * 1.25 : radius}
              fill={i === selectedPoint ? "#70b9ff" : "#dcecff"}
              stroke="#2a6fba"
              strokeWidth={radius * 0.3}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
