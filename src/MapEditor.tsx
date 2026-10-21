/* Interactive SVG drawing surface has keyboard alternatives in the HTML object list. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import catalog from "../data/map-editor-icons.json";
import palette from "../data/map-editor-palette.json";
import lineCatalog from "../data/map-editor-lines.json";
import { GroundSvgImage, GroundThumbnail } from "./map-assets";
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
  bendPoints,
  routeDash,
  routeDecorations,
  routePoint,
  shapeBounds,
  shapeCorners,
  shapePath,
  anchorPoint,
  arrowPoints,
  clamp,
  createHistory,
  makeProject,
  MAX_FILE_BYTES,
  MAX_ITEMS,
  moveAnnotation,
  parseProject,
  pathData,
  readProject,
  reduceHistory,
  sameContext,
  serializeProject,
  writeProject,
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
  | "sniper";
type Props = {
  ref?: Ref<MapEditorHandle>;
  active: boolean;
  context: EditorContext;
  mapName: string;
  host: SVGGElement | null;
  svg: SVGSVGElement | null;
  viewWidth: number;
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
  lineStyle: "solid" as NonNullable<RouteAnnotation["lineStyle"]>,
  color: "#e4c477",
  width: 0.003,
  dashed: false,
  size: 0.035,
  fontSize: 0.018,
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
  close,
  mapControls,
  pan,
  knownContext,
  openProject,
  describeContext,
  exportImage,
}: Props) {
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
  const [panel, setPanel] = useState<"style" | "icons" | "layers" | "files" | "map" | null>(null),
    [notice, setNotice] = useState(initial.message),
    [storageError, setStorageError] = useState(false);
  const [incoming, setIncoming] = useState<MapProject | null>(null),
    [clearConfirm, setClearConfirm] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [resolution, setResolution] = useState(2048);
  const abort = useRef<AbortController | null>(null),
    file = useRef<HTMLInputElement>(null),
    textField = useRef<HTMLTextAreaElement>(null);
  const visible = preview || history.present;
  const selected = history.present.find((a) => a.id === selectedId);
  const setPending = (p: GeometryAnnotation | null) => {
    pendingRef.current = p;
    setPendingState(p);
  };
  function persist(items: Annotation[]) {
    try {
      writeProject(makeProject(context, items));
      setStorageError(false);
      setNotice(`本地草稿已保存 · ${items.length} 个标注`);
    } catch {
      setStorageError(true);
      setNotice("浏览器空间不足或禁止保存，请导出编辑文件保留结果");
    }
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
  }
  function select(item: Annotation) {
    setSelectedId(item.id);
    setSelectedPoint(null);
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
    setSettings((s) => ({ ...s, arrow: preset.arrow, lineStyle, dashed: lineStyle === "dashed" }));
    if (selected?.kind === "path")
      patch({ lineStyle, dashed: lineStyle === "dashed", arrow: preset.arrow });
    else if (tool !== "curve") setTool(preset.arrow ? "arrow" : "route");
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
    return { x: clamp(p.x / 1000), y: clamp(p.y / 1000) };
  }
  function pointerDown(e: PointerEvent<SVGGElement>) {
    if (!active || e.button !== 0) return;
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
      document.querySelector("dialog[open]") ||
      (e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true]")
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
                  x: clamp(
                    p.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
                  ),
                  y: clamp(p.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0)),
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
        writeProject(makeProject(context, stroke && hasLength ? [...items, stroke] : items));
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
  function confirmImport() {
    if (!incoming) return;
    try {
      if (sameContext(incoming, context)) {
        cancelGesture();
        apply(incoming.items);
        setSelectedId(null);
      } else {
        finish();
        writeProject(incoming);
        openProject(incoming);
      }
      setIncoming(null);
    } catch {
      setNotice("无法保存导入的草稿，请先导出当前内容并检查浏览器空间");
    }
  }
  function exportFile() {
    const items = finish();
    try {
      const body = serializeProject(makeProject(context, items));
      downloadBlob(
        new Blob([body], { type: "application/json" }),
        `${mapName}-${context.layoutId}-队伍${context.team}.wtmap.json`,
      );
      setNotice("编辑文件已导出，可再次导入继续修改");
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
      downloadBlob(blob, `${mapName}-队伍${context.team}-走线.png`);
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
        data-active={active}
        pointerEvents={active ? "auto" : "none"}
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
          <rect x={0} y={0} width={1000} height={1000} fill="transparent" data-editor-ui="true" />
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
        <div className="map-editor-tools" role="toolbar" aria-label="走线绘制工具">
          {(
            [
              ["select", "选择", "↖"],
              ["pan", "平移", "✥"],
              ["arrow", "箭头", "↗"],
              ["route", "线条", "╱"],
              ["curve", "曲线", "∿"],
              ["pen", "画笔", "〰"],
              ["shape", "形状", "▱"],
              ["danger", "危险区", "⚠"],
              ["sniper", "狙击点", "⌖"],
              ["icon", "标记", "◇"],
              ["text", "文字", "T"],
            ] as const
          ).map(([value, label, glyph]) => (
            <button
              key={value}
              title={label}
              aria-pressed={tool === value}
              onClick={() => chooseTool(value)}
            >
              <span aria-hidden="true">{glyph}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        <div className="map-editor-actions" role="toolbar" aria-label="地图编辑操作">
          <button
            className="map-editor-exit"
            onClick={() => {
              finish();
              close();
            }}
          >
            完成
          </button>
          <strong className="map-editor-title" title={`${mapName} · 队伍 ${context.team}`}>
            {mapName}
            <small>走线编辑</small>
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
          <aside className="map-editor-inspector" data-panel={panel} aria-label="标注编辑面板">
            <header>
              <strong>
                {panel === "icons"
                  ? "地图标记"
                  : panel === "layers"
                    ? "标注图层"
                    : panel === "files"
                      ? "导入与导出"
                      : panel === "map"
                        ? "底图与布局"
                        : selected
                          ? annotationName(selected)
                          : "绘制样式"}
              </strong>
              <button aria-label="收起编辑面板" onClick={() => setPanel(null)}>
                ×
              </button>
            </header>
            {panel === "files" ? (
              <div className="map-editor-fields">
                <p>每次修改自动保存到当前浏览器。导出编辑文件可在其他设备继续修改。</p>
                <button
                  onClick={() => {
                    persist(finish());
                  }}
                >
                  保存草稿
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
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(Number(e.target.value))}
                  >
                    <option value={2048}>2K 图片</option>
                    <option value={4096}>4K 图片</option>
                  </select>
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
                <button disabled={!history.present.length} onClick={() => setClearConfirm(true)}>
                  清空标注
                </button>
              </>
            ) : (
              <div className="map-editor-fields">
                {!selected && tool === "shape" && (
                  <label>
                    形状
                    <select
                      value={shapeKind}
                      onChange={(e) => {
                        finish();
                        setShapeKind(e.target.value as ShapeAnnotation["shape"]);
                        setTool("shape");
                      }}
                    >
                      <option value="rectangle">矩形</option>
                      <option value="ellipse">椭圆 / 圆</option>
                      <option value="polygon">可编辑多边形</option>
                    </select>
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
                          <select
                            value={selectedPoint ?? ""}
                            disabled={selected.locked}
                            onChange={(e) =>
                              setSelectedPoint(
                                e.target.value === "" ? null : Number(e.target.value),
                              )
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
                          </select>
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
                          <select
                            value={
                              selected?.kind === "path"
                                ? selected.lineStyle || (selected.dashed ? "dashed" : "solid")
                                : settings.lineStyle
                            }
                            disabled={selected?.locked}
                            onChange={(e) => {
                              const lineStyle = e.target.value as NonNullable<
                                RouteAnnotation["lineStyle"]
                              >;
                              setSettings((s) => ({ ...s, lineStyle }));
                              if (selected?.kind === "path")
                                patch({ lineStyle, dashed: lineStyle === "dashed" });
                            }}
                          >
                            <option value="solid">实线</option>
                            <option value="dashed">虚线</option>
                            <option value="dotted">点线 / 射界</option>
                            <option value="dashdot">点划线 / 补给</option>
                            <option value="defense">锯齿 / 防御阵线</option>
                            <option value="barrier">交叉 / 障碍封锁线</option>
                          </select>
                        </label>
                        <div className="map-editor-line-presets" aria-label="战术线预设">
                          {lineCatalog.presets.map((preset) => (
                            <button
                              key={preset.id}
                              disabled={selected?.locked}
                              onClick={() => chooseLinePreset(preset.id)}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
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
                            min={0}
                            max={100}
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
                                        ? { ...p, [axis]: clamp(Number(e.target.value) / 100) }
                                        : p,
                                    ),
                                  },
                                  `${selected.id}:point:${selectedPoint}:${axis}`,
                                );
                                return;
                              }
                              const delta =
                                clamp(Number(e.target.value) / 100) - anchorPoint(selected)[axis];
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
        <output className={`map-editor-status${storageError ? " is-error" : ""}`}>
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
                {notice}
              </span>
            </>
          )}
        </output>
      </div>
      {incoming && (
        <Modal
          title="导入走线编辑文件"
          close={() => setIncoming(null)}
          className="map-editor-import-dialog"
        >
          <p>{describeContext(incoming)}</p>
          <p>包含 {incoming.items.length} 个标注。确认后将替换该地图、布局和队伍的本地草稿。</p>
          <div className="map-editor-dialog-actions">
            <button onClick={() => setIncoming(null)}>取消</button>
            <button onClick={confirmImport}>导入并打开</button>
          </div>
        </Modal>
      )}
      {clearConfirm && (
        <Modal
          title="清空当前标注？"
          close={() => setClearConfirm(false)}
          className="map-editor-import-dialog"
        >
          <p>仅清空当前地图、布局和队伍的标注，可用撤销恢复。</p>
          <div className="map-editor-dialog-actions">
            <button onClick={() => setClearConfirm(false)}>取消</button>
            <button
              onClick={() => {
                cancelGesture();
                apply([]);
                setSelectedId(null);
                setClearConfirm(false);
              }}
            >
              清空
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
function AnnotationShape({
  item,
  selected,
  hitWidth,
}: {
  item: Annotation;
  selected: boolean;
  hitWidth: number;
}) {
  const anchor = anchorPoint(item),
    outline = selected ? (
      <circle
        data-editor-ui="true"
        cx={anchor.x * 1000}
        cy={anchor.y * 1000}
        r={hitWidth * 0.6}
        fill="none"
        stroke="#70b9ff"
        strokeWidth={hitWidth * 0.12}
      />
    ) : null;
  if (item.kind === "path") {
    const triangle = arrowPoints(item);
    return (
      <g data-annotation-id={item.id}>
        <path
          d={pathData(item.points, item.curve)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(item.width * 1000, hitWidth)}
          pointerEvents="stroke"
        />
        <path
          d={pathData(item.points, item.curve)}
          fill="none"
          stroke={item.color}
          strokeWidth={item.width * 1000}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={routeDash(item).join(" ") || undefined}
          pointerEvents="none"
        />
        {routeDecorations(item).map((points, i) => (
          <path
            key={`decoration-${i}`}
            d={pathData(points)}
            fill={item.lineStyle === "defense" ? item.color : "none"}
            stroke={item.color}
            strokeWidth={item.width * 700}
            pointerEvents="none"
          />
        ))}
        {triangle.length > 0 && (
          <polygon
            points={triangle.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
            fill={item.color}
          />
        )}
      </g>
    );
  }
  if (item.kind === "shape") {
    const bounds = shapeBounds(item),
      d = shapePath(item),
      patternId = `danger-hatch-${item.id}`;
    return (
      <g data-annotation-id={item.id}>
        {item.hatch && (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={12} height={12}>
              <path
                d="M-3 3L3 -3M0 12L12 0M9 15L15 9"
                stroke={item.color}
                strokeWidth={1.2}
                opacity={0.65}
              />
            </pattern>
          </defs>
        )}
        <path
          d={d}
          fill={item.color}
          fillOpacity={item.fillOpacity}
          stroke={item.color}
          strokeWidth={item.width * 1000}
        />
        {item.hatch && <path d={d} fill={`url(#${patternId})`} pointerEvents="none" />}
        <path
          d={d}
          fill="transparent"
          stroke="transparent"
          strokeWidth={Math.max(item.width * 1000, hitWidth)}
        />
        {item.caption && (
          <text
            x={(bounds.x + bounds.w / 2) * 1000}
            y={(bounds.y + bounds.h / 2) * 1000}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="system-ui,sans-serif"
            fontSize={16}
            fontWeight={600}
            fill={item.color}
            stroke="#171c22"
            strokeWidth={2.2}
            paintOrder="stroke"
          >
            {item.caption.split("\n").map((line, i) => (
              <tspan key={i} x={(bounds.x + bounds.w / 2) * 1000} dy={i ? 20 : 0}>
                {line}
              </tspan>
            ))}
          </text>
        )}
      </g>
    );
  }
  if (item.kind === "text")
    return (
      <g
        data-annotation-id={item.id}
        transform={`rotate(${item.rotation} ${anchor.x * 1000} ${anchor.y * 1000})`}
      >
        <rect
          x={anchor.x * 1000 - hitWidth * 0.2}
          y={anchor.y * 1000 - hitWidth * 0.2}
          width={Math.max(
            hitWidth,
            item.fontSize *
              1000 *
              Math.max(1, ...item.text.split("\n").map((line) => line.length)) *
              0.7,
          )}
          height={Math.max(hitWidth, item.fontSize * 1300 * item.text.split("\n").length)}
          fill="transparent"
        />
        <text
          x={anchor.x * 1000}
          y={anchor.y * 1000}
          fill={item.color}
          fontSize={item.fontSize * 1000}
          fontWeight={600}
          fontFamily="system-ui,sans-serif"
          dominantBaseline="text-before-edge"
          stroke="#171c22"
          strokeWidth={item.fontSize * 120}
          strokeLinejoin="round"
          paintOrder="stroke"
          pointerEvents="bounding-box"
        >
          {item.text.split("\n").map((line, i) => (
            <tspan key={i} x={anchor.x * 1000} dy={i ? item.fontSize * 1300 : 0}>
              {line || " "}
            </tspan>
          ))}
        </text>
        {outline}
      </g>
    );
  const icon = icons.get(item.iconId),
    symbol = tacticalSymbol(item.iconId);
  if (!icon && !symbol) return null;
  const size = item.size * 1000;
  return (
    <g data-annotation-id={item.id}>
      <circle
        cx={anchor.x * 1000}
        cy={anchor.y * 1000}
        r={Math.max(size * 0.6, hitWidth / 2)}
        fill="transparent"
      />
      <g transform={`rotate(${item.rotation} ${anchor.x * 1000} ${anchor.y * 1000})`}>
        <circle
          cx={anchor.x * 1000}
          cy={anchor.y * 1000}
          r={size * 0.6}
          fill={item.color + "40"}
          stroke={item.color}
          strokeWidth={1.5}
        />
        {symbol ? (
          <TacticalSymbol
            id={item.iconId}
            x={anchor.x * 1000 - size / 2}
            y={anchor.y * 1000 - size / 2}
            size={size}
            color={item.color}
          />
        ) : (
          icon && (
            <GroundSvgImage
              asset={icon.asset}
              x={anchor.x * 1000 - size / 2}
              y={anchor.y * 1000 - size / 2}
              width={size}
              height={size}
            />
          )
        )}
      </g>
      {item.caption && (
        <text
          x={anchor.x * 1000}
          y={anchor.y * 1000 + size * 0.7}
          textAnchor="middle"
          dominantBaseline="text-before-edge"
          fontFamily="system-ui,sans-serif"
          fontSize={size * 0.38}
          fontWeight={600}
          fill={item.color}
          stroke="#171c22"
          strokeWidth={size * 0.045}
          paintOrder="stroke"
        >
          {item.caption.split("\n").map((line, i) => (
            <tspan key={i} x={anchor.x * 1000} dy={i ? size * 0.38 * 1.3 : 0}>
              {line}
            </tspan>
          ))}
        </text>
      )}
      {outline}
    </g>
  );
}
