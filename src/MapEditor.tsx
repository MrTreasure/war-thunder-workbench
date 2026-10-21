/* Interactive SVG drawing surface has keyboard alternatives in the HTML object list. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from "react";
import type { PointerEvent, Ref } from "react";
import { createPortal } from "react-dom";
import catalog from "../data/map-editor-icons.json";
import { GroundSvgImage, GroundThumbnail } from "./map-assets";
import { Modal } from "./Modal";
import { downloadBlob } from "./map-editor-export";
import {
  annotationName,
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
  EditorContext,
  HistoryAction,
  MapPoint,
  MapProject,
  RouteAnnotation,
} from "./map-editor-model";

const icons = new Map(catalog.icons.map((i) => [i.id, i]));
const iconIds = new Set(icons.keys());
export const editorIconAssets = Object.fromEntries(catalog.icons.map((i) => [i.id, i.asset]));
export type MapEditorHandle = { finish: () => Annotation[] };
type Tool = "pan" | "select" | "arrow" | "route" | "pen" | "icon" | "text";
type Props = {
  ref?: Ref<MapEditorHandle>;
  active: boolean;
  context: EditorContext;
  mapName: string;
  host: SVGGElement | null;
  svg: SVGSVGElement | null;
  viewWidth: number;
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
  | { kind: "pen" };
const defaults = { color: "#e4c477", width: 0.003, dashed: false, size: 0.035, fontSize: 0.018 };
const id = () => crypto.randomUUID();
export function MapEditor({
  ref,
  active,
  context,
  mapName,
  host,
  svg,
  viewWidth,
  pan,
  knownContext,
  openProject,
  describeContext,
  exportImage,
}: Props) {
  const [initial] = useState(() => readProject(context, iconIds));
  const [coarsePointer] = useState(() => window.matchMedia("(pointer:coarse)").matches);
  const hitWidth = viewWidth * (coarsePointer ? 0.12 : 0.018);
  const [history, setHistory] = useState(() => createHistory(initial.items));
  const historyRef = useRef(history);
  const [tool, setTool] = useState<Tool>("select"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [settings, setSettings] = useState(defaults);
  const [replaceIcon, setReplaceIcon] = useState(false);
  const [iconId, setIconId] = useState("army_tank"),
    [iconGroup, setIconGroup] = useState("单位与队伍");
  const [pending, setPendingState] = useState<RouteAnnotation | null>(null);
  const pendingRef = useRef<RouteAnnotation | null>(null);
  const [hover, setHover] = useState<MapPoint | null>(null),
    [preview, setPreview] = useState<Annotation[] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const [panel, setPanel] = useState<"style" | "icons" | "layers" | null>(null),
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
  const setPending = (p: RouteAnnotation | null) => {
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
    setHover(null);
    let result = historyRef.current.present;
    if (moving?.kind === "move") result = moving.result;
    if (stroke && stroke.points.length >= 2) result = [...result, stroke];
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
  }
  function select(item: Annotation) {
    setSelectedId(item.id);
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
    setSelectedId(null);
    setPanel(next === "icon" ? "icons" : null);
  }
  function changeStyle(key: "color" | "width" | "dashed", value: string | number | boolean) {
    if (selected) {
      patch({ [key]: value }, `${selected.id}:${key}`);
      return;
    }
    setSettings((s) => ({ ...s, [key]: value }));
    if (pendingRef.current) setPending({ ...pendingRef.current, [key]: value });
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
    if (tool === "icon") {
      add({ ...base, kind: "icon", point, iconId, size: settings.size, rotation: 0, caption: "" });
      setTool("select");
      setPanel("style");
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
    if (e.detail >= 2) return;
    const stroke = pendingRef.current;
    if (stroke && stroke.points.length >= 3000) {
      setNotice("单条走线最多 3000 个点，请先完成当前走线");
      return;
    }
    setPending(
      stroke
        ? { ...stroke, points: [...stroke.points, point] }
        : {
            ...base,
            kind: "path",
            points: [point],
            width: settings.width,
            dashed: settings.dashed,
            arrow: tool === "arrow",
          },
    );
    setHover(point);
  }
  function pointerMove(e: PointerEvent<SVGGElement>) {
    if (!active) return;
    e.stopPropagation();
    const point = toPoint(e);
    if (!point) return;
    const g = gesture.current;
    if (g?.kind === "move") {
      g.result = g.original.map((a) =>
        a.id === g.id ? moveAnnotation(a, point.x - g.start.x, point.y - g.start.y) : a,
      );
      setPreview(g.result);
      return;
    }
    const stroke = pendingRef.current;
    if (g?.kind === "pen" && stroke) {
      if (
        stroke.points.length < 3000 &&
        Math.hypot(point.x - stroke.points.at(-1)!.x, point.y - stroke.points.at(-1)!.y) > 0.0006
      )
        setPending({ ...stroke, points: [...stroke.points, point] });
    } else if (stroke) setHover(point);
  }
  function pointerUp(e: PointerEvent<SVGGElement>) {
    if (!active) return;
    e.stopPropagation();
    if (gesture.current) finish();
  }
  function cancelGesture() {
    gesture.current = null;
    setPreview(null);
    setPending(null);
    setHover(null);
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
        remove();
      }
    }
    if (
      selected &&
      !selected.locked &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    ) {
      e.preventDefault();
      const step = e.shiftKey ? 0.01 : 0.001;
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
    if (stroke && stroke.points.length >= 2) {
      try {
        writeProject(makeProject(context, [...historyRef.current.present, stroke]));
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
    if (active && selectedId) textField.current?.focus();
  }, [active, selectedId]);
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
  const currentDraft = pending
    ? {
        ...pending,
        points: hover && tool !== "pen" ? [...pending.points, hover] : pending.points,
      }
    : null;
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
          if (active && (tool === "route" || tool === "arrow")) {
            e.preventDefault();
            e.stopPropagation();
            finish();
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
              ["select", "选择"],
              ["pan", "平移"],
              ["arrow", "箭头"],
              ["route", "折线"],
              ["pen", "画笔"],
              ["icon", "图标"],
              ["text", "文字"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} aria-pressed={tool === value} onClick={() => chooseTool(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="map-editor-actions" role="toolbar" aria-label="走线文件与历史操作">
          <button
            disabled={!history.past.length || !!busy}
            onClick={() => {
              cancelGesture();
              change({ type: "undo" });
            }}
          >
            撤销
          </button>
          <button
            disabled={!history.future.length || !!busy}
            onClick={() => {
              cancelGesture();
              change({ type: "redo" });
            }}
          >
            重做
          </button>
          <button
            onClick={() => {
              const items = finish();
              persist(items);
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
            导入
          </button>
          <button onClick={exportFile}>编辑文件</button>
          <select
            aria-label="图片导出尺寸"
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
          >
            <option value={2048}>2K 图片</option>
            <option value={4096}>4K 图片</option>
          </select>
          <button disabled={!!busy} onClick={() => void exportPng()}>
            导出图片
          </button>
          <button
            aria-pressed={panel === "style"}
            onClick={() => setPanel(panel === "style" ? null : "style")}
          >
            样式
          </button>
          <button
            aria-pressed={panel === "layers"}
            onClick={() => setPanel(panel === "layers" ? null : "layers")}
          >
            图层 {history.present.length}
          </button>
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
          <aside className="map-editor-inspector" aria-label="标注编辑面板">
            <header>
              <strong>
                {panel === "icons"
                  ? "战雷原生图标"
                  : panel === "layers"
                    ? "标注图层"
                    : selected
                      ? annotationName(selected)
                      : "绘制样式"}
              </strong>
              <button aria-label="收起编辑面板" onClick={() => setPanel(null)}>
                ×
              </button>
            </header>
            {panel === "icons" ? (
              <>
                <div className="map-editor-icon-tabs">
                  {[...new Set(catalog.icons.map((i) => i.group))].map((group) => (
                    <button
                      key={group}
                      aria-pressed={iconGroup === group}
                      onClick={() => setIconGroup(group)}
                    >
                      {group}
                    </button>
                  ))}
                </div>
                <p>{replaceIcon ? "选择图标替换当前标记。" : "选择图标后，点击地图放置。"}</p>
                <div className="map-editor-icon-grid">
                  {catalog.icons
                    .filter((i) => i.group === iconGroup)
                    .map((icon) => (
                      <button
                        key={icon.id}
                        title={`${icon.label} · ${icon.id}`}
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
                        <GroundThumbnail
                          asset={icon.asset}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                        />
                        <span>{icon.label}</span>
                      </button>
                    ))}
                </div>
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
                <label>
                  颜色
                  <input
                    type="color"
                    value={selected?.color || settings.color}
                    disabled={selected?.locked}
                    onChange={(e) => changeStyle("color", e.target.value)}
                    onBlur={() => change({ type: "endGroup" })}
                  />
                </label>
                {(!selected || selected.kind === "path") && (
                  <>
                    <label>
                      线条粗细
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={(selected?.kind === "path" ? selected.width : settings.width) * 1000}
                        disabled={selected?.locked}
                        onChange={(e) => changeStyle("width", Number(e.target.value) / 1000)}
                        onBlur={() => change({ type: "endGroup" })}
                      />
                    </label>
                    <label className="map-editor-check">
                      <input
                        type="checkbox"
                        checked={selected?.kind === "path" ? selected.dashed : settings.dashed}
                        disabled={selected?.locked}
                        onChange={(e) => changeStyle("dashed", e.target.checked)}
                      />
                      虚线
                    </label>
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
                {selected && selected.kind !== "path" && (
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
                            value={Number((anchorPoint(selected)[axis] * 100).toFixed(2))}
                            disabled={selected.locked}
                            onChange={(e) => {
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
                    : "点击添加拐点，完成后结束走线"
                  : tool === "icon"
                    ? "点击地图放置原生图标"
                    : tool === "text"
                      ? "点击地图添加文字"
                      : notice}
              </span>
              {pending && (
                <>
                  <button disabled={pending.points.length < 2} onClick={() => finish()}>
                    完成走线
                  </button>
                  <button onClick={cancelGesture}>取消</button>
                </>
              )}
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
          d={pathData(item.points)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(item.width * 1000, hitWidth)}
          pointerEvents="stroke"
        />
        <path
          d={pathData(item.points)}
          fill="none"
          stroke={item.color}
          strokeWidth={item.width * 1000}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={item.dashed ? `${item.width * 4000} ${item.width * 3000}` : undefined}
          pointerEvents="none"
        />
        {triangle.length > 0 && (
          <polygon
            points={triangle.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
            fill={item.color}
          />
        )}
        {outline}
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
  const icon = icons.get(item.iconId);
  if (!icon) return null;
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
        <GroundSvgImage
          asset={icon.asset}
          x={anchor.x * 1000 - size / 2}
          y={anchor.y * 1000 - size / 2}
          width={size}
          height={size}
        />
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
