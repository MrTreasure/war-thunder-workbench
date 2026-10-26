/* Interactive SVG map owns arrow-key pan and Home reset; native HTML has no map widget. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { GameSelect } from "./components/GameSelect";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GroundThumbnail, GroundSvgImage, rotateAsset } from "./map-assets";
import { MapEditor, editorIconAssets } from "./MapEditor";
import type { MapEditorHandle } from "./MapEditor";
import type { EditorContext, MapProject } from "./map-editor-model";
import { renderMapPng } from "./map-editor-export";
import { mapView } from "./map-editor-model";
import { CONTOUR_IMAGE_TRANSFORM, referenceGrid } from "./ground-map-projection";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import atlas from "../data/ground-maps.json";
import { recommendedRoute, hasRecommendedRoutes } from "./map-recommendations";
import { Route } from "./routes/_workbench.maps";
import { Route as DetailRoute } from "./routes/_workbench.maps_.$mapId";

type GroundMap = (typeof atlas.maps)[number];
const normalize = (s: string) =>
  s.normalize("NFKC").toLowerCase().replaceAll("日曜", "日耀").replaceAll("马奇诺", "马其诺");
export function MapAtlas() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/maps" });
  const query = search.q || "";
  const onlyGuides = !!search.hasGuides;
  const setQuery = (q: string) =>
    void navigate({ search: { ...search, q: q || undefined }, replace: true, resetScroll: false });
  const setOnlyGuides = (value: boolean) =>
    void navigate({
      search: { ...search, hasGuides: value || undefined },
      replace: true,
      resetScroll: false,
    });
  const selected = atlas.maps.find(
    (m) => m.id === search.map || m.legacyGuideIds.includes(search.map || ""),
  );
  const cards = atlas.maps
    .flatMap((map) => map.thumbnails.map((thumb) => ({ map, thumb })))
    .filter(
      ({ map, thumb }) =>
        normalize(
          [map.name, map.english, map.id, thumb.name, ...map.guides.map((g) => g.title)].join(" "),
        ).includes(normalize(query)) &&
        (!onlyGuides || map.guides.length || hasRecommendedRoutes(map.id)),
    );
  if (selected)
    return (
      <Navigate
        to="/maps/$mapId"
        params={{ mapId: selected.id }}
        search={{ side: search.side, q: search.q, hasGuides: search.hasGuides }}
        replace
      />
    );
  return (
    <main className="ground-page" aria-label="陆战地图">
      <header className="ground-heading">
        <div>
          <h1>陆战地图</h1>
          <p>从地图读懂战场，选择布局查看地形与点位。</p>
        </div>
        <div className="ground-count">
          <strong>{atlas.maps.length}</strong> 张地图{" "}
          <span> / {atlas.maps.reduce((n, m) => n + m.layouts.length, 0)} 种任务布局</span>
        </div>
      </header>
      <div className="ground-searchbar">
        <label>
          <span className="sr-only">搜索地图</span>
          <input
            type="search"
            placeholder="搜索地图名称、英文名或攻略"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button aria-pressed={onlyGuides} onClick={() => setOnlyGuides(!onlyGuides)}>
          仅看有关联攻略
        </button>
        <span>{cards.length} 个三点占领布局</span>
      </div>
      <section className="ground-gallery" aria-label="地图列表">
        {cards.map(({ map, thumb }) => (
          <Link
            className="ground-card"
            key={thumb.layoutId}
            to="/maps/$mapId"
            params={{ mapId: map.id }}
            search={{ side: thumb.layoutId, q: search.q, hasGuides: search.hasGuides }}
          >
            <div className="ground-card-image">
              <GroundThumbnail
                asset={thumb.image}
                alt={`${map.name} ${thumb.name} 点位缩略图`}
                width={thumb.width}
                height={thumb.height}
                loading="lazy"
                decoding="async"
              />
              {hasRecommendedRoutes(map.id) ? (
                <span className="ground-guide-badge">推荐走线</span>
              ) : map.guides.length > 0 ? (
                <span className="ground-guide-badge">攻略 {map.guides.length}</span>
              ) : null}
            </div>
            <div className="ground-card-caption">
              <strong>{map.name}</strong>
              <span>{thumb.name}</span>
              <small>
                {map.layouts.length} 种任务布局 <b aria-hidden="true">→</b>
              </small>
            </div>
          </Link>
        ))}
      </section>
      {!cards.length && (
        <div className="ground-empty">
          <h2>没有找到这张地图</h2>
          <p>试试地图简称或英文名称。</p>
          <button
            onClick={() => {
              setQuery("");
              setOnlyGuides(false);
            }}
          >
            显示全部地图
          </button>
        </div>
      )}
      <p className="ground-source-note">
        列表展示导出资料中的三点占领布局；详情可切换全部已收录任务。点位为简报参考位置，关联攻略请结合原帖的地图版本阅读。
      </p>
    </main>
  );
}
export function GroundMapPage() {
  const { mapId } = DetailRoute.useParams();
  const search = DetailRoute.useSearch();
  const navigate = useNavigate({ from: "/maps/$mapId" });
  const map = atlas.maps.find((m) => m.id === mapId);
  const back = (
    <Link className="ground-back" to="/maps" search={{ q: search.q, hasGuides: search.hasGuides }}>
      ← 地图列表
    </Link>
  );
  if (!map)
    return (
      <main className="ground-page">
        <header className="ground-heading">
          <h1>地图未找到</h1>
          {back}
        </header>
        <p>这张地图尚未收录，请返回列表选择。</p>
      </main>
    );
  return (
    <main className="ground-page ground-detail-page" aria-label={`${map.name}地图详情`}>
      <GroundDetail
        key={map.id}
        back={back}
        map={map}
        layoutId={search.side}
        team={search.team || 1}
        chooseTeam={(team) =>
          void navigate({
            params: { mapId },
            search: { ...search, team: team === 2 ? 2 : undefined },
            replace: true,
            resetScroll: false,
          })
        }
        openProject={(project) =>
          void navigate({
            params: { mapId: project.mapId },
            search: { ...search, side: project.layoutId, team: project.team === 2 ? 2 : undefined },
            resetScroll: true,
          })
        }
        choose={(side) =>
          void navigate({
            params: { mapId },
            search: { ...search, side },
            replace: true,
            resetScroll: false,
          })
        }
      />
    </main>
  );
}
function GroundDetail({
  back,
  map,
  layoutId,
  team,
  chooseTeam,
  openProject,
  choose,
}: {
  back: ReactNode;
  map: GroundMap;
  layoutId?: string;
  team: 1 | 2;
  chooseTeam: (team: 1 | 2) => void;
  openProject: (project: MapProject) => void;
  choose: (id: string) => void;
}) {
  const layout = map.layouts.find((l) => l.id === layoutId) || map.layouts[0];
  const [contours, setContours] = useState(true),
    [points, setPoints] = useState(true),
    [grid, setGrid] = useState(false),
    [cropped, setCropped] = useState(true);
  const [recommendations, setRecommendations] = useState(true);
  const route = recommendedRoute(map.id, layout.id, team);
  const [routeState, setRouteState] = useState({ id: "", status: "loading" });
  const [routeRetry, setRouteRetry] = useState(0);
  const routeKey = `${route?.id || "none"}:${routeRetry}`;
  const routeStatus = routeState.id === routeKey ? routeState.status : "loading";
  const [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [sourceChoice, setSourceChoice] = useState(0);
  const [contourLoaded, setContourLoaded] = useState(false);
  const alternateSource = () => {
    setSourceChoice((v) => (v + 1) % 3);
    setLoaded(false);
    setContourLoaded(false);
    setFailed(false);
    setRetryVersion((v) => v + 1);
  };
  const clipId = useId();
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setAspect(rect.width / rect.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svg]);
  const [editorHost, setEditorHost] = useState<SVGGElement | null>(null);
  const [editing, setEditing] = useState(false);
  const editorRef = useRef<MapEditorHandle>(null);
  const startPan = (e: { pointerId: number; clientX: number; clientY: number }) => {
    svg?.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: x - originX, oy: y - originY };
  };
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const crop = cropped && layout.crop ? layout.crop : [0, 0, 1, 1];
  const { x, y, w, h, originX, originY } = mapView(crop, zoom, offset, aspect);
  const mapFrame = {
    x: crop[0] * 1000,
    y: crop[1] * 1000,
    w: (crop[2] - crop[0]) * 1000,
    h: (crop[3] - crop[1]) * 1000,
  };
  const markerScale = mapFrame.w / zoom;
  const gridLines = [];
  if (grid) {
    const lines = referenceGrid(map.bounds, map.grid.default_reference);
    for (const { position, label } of lines.vertical)
      gridLines.push(
        <g key={`x${label}`}>
          <path d={`M${position} 0V1000`} />
          <text x={position + 3} y={mapFrame.y + 18 / zoom}>
            {label}
          </text>
        </g>,
      );
    for (const { position, label } of lines.horizontal)
      gridLines.push(
        <g key={`z${label}`}>
          <path d={`M0 ${position}H1000`} />
          <text x={mapFrame.x + 4 / zoom} y={position + 15 / zoom}>
            {label}
          </text>
        </g>,
      );
  }
  const mapControls = (
    <div className="ground-controls">
      <label>
        <span>布局</span>
        <GameSelect
          aria-label="任务布局"
          value={layout.id}
          onValueChange={(value) => {
            reset();
            editorRef.current?.finish();
            choose(value);
          }}
        >
          {map.layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {map.thumbnails.find((t) => t.layoutId === l.id)?.name || l.name}
              {map.layouts.filter((v) => v.name === l.name).length > 1 &&
              !map.thumbnails.some((t) => t.layoutId === l.id)
                ? ` · 布局 ${map.layouts.filter((v) => v.name === l.name).findIndex((v) => v.id === l.id) + 1}`
                : ""}
            </option>
          ))}
        </GameSelect>
      </label>
      <label>
        <span>己方</span>
        <GameSelect
          aria-label="己方出生侧"
          value={team}
          onValueChange={(value) => {
            editorRef.current?.finish();
            chooseTeam(Number(value) as 1 | 2);
          }}
        >
          <option value={1}>队伍 1</option>
          <option value={2}>队伍 2</option>
        </GameSelect>
      </label>
      <div className="ground-layer-toggles">
        <button aria-pressed={recommendations} onClick={() => setRecommendations((v) => !v)}>
          推荐走线
        </button>
        {[
          ["等高线", contours, setContours],
          ["点位", points, setPoints],
          ["参考网格", grid, setGrid],
          ["布局范围", cropped, setCropped],
        ].map(([name, value, set]) => (
          <button
            key={name as string}
            aria-pressed={value as boolean}
            onClick={() => {
              reset();
              (set as (v: boolean) => void)(!value);
            }}
          >
            {name as string}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <section className="ground-detail" data-editing={editing} aria-label="地图与任务布局">
      <div className="ground-detail-body">
        <div className="ground-workspace" data-editing={editing}>
          <div className="ground-detail-toolbar">
            <div className="ground-map-identity">
              {back}
              <h1>
                {map.name}
                <small>{map.english}</small>
              </h1>
            </div>
            {mapControls}
            <button
              className="ground-edit-toggle"
              aria-pressed={editing}
              onClick={() => {
                if (editing) editorRef.current?.finish();
                setEditing((v) => !v);
              }}
            >
              {editing ? "完成编辑" : "编辑走线"}
            </button>
            <a
              className="ground-original"
              href={map.base.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              原图 ↗
            </a>
          </div>
          <div className="ground-stage" data-zoomed={zoom > 1} data-editing={editing}>
            <svg
              ref={setSvg}
              role="application"
              tabIndex={0}
              onKeyDown={(e) => {
                if (editing) return;
                const delta = 40 / zoom;
                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                  e.preventDefault();
                  setOffset((o) => ({
                    x: o.x + (e.key === "ArrowLeft" ? -delta : e.key === "ArrowRight" ? delta : 0),
                    y: o.y + (e.key === "ArrowUp" ? -delta : e.key === "ArrowDown" ? delta : 0),
                  }));
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  reset();
                }
              }}
              viewBox={`${x} ${y} ${w} ${h}`}
              aria-label={`${map.name} ${layout.name}，可拖动查看，使用下方按钮缩放`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                startPan(e);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const rect = svg!.getBoundingClientRect();
                const scale = Math.min(rect.width / w, rect.height / h);
                setOffset({
                  x: d.ox - (e.clientX - d.x) / scale,
                  y: d.oy - (e.clientY - d.y) / scale,
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={mapFrame.x} y={mapFrame.y} width={mapFrame.w} height={mapFrame.h} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                <GroundSvgImage
                  key={`base-${retryVersion}`}
                  asset={rotateAsset(map.base, sourceChoice)}
                  x={0}
                  y={0}
                  width={1000}
                  height={1000}
                  preserveAspectRatio="none"
                  onLoad={() => setLoaded(true)}
                  onFailure={() => setFailed(true)}
                />
                {contours && (
                  <GroundSvgImage
                    key={`contours-${retryVersion}`}
                    asset={rotateAsset(map.contourImage, sourceChoice)}
                    x={0}
                    y={0}
                    width={1000}
                    height={1000}
                    preserveAspectRatio="none"
                    transform={CONTOUR_IMAGE_TRANSFORM}
                    opacity={0.8}
                    onLoad={() => setContourLoaded(true)}
                    onFailure={() => setFailed(true)}
                  />
                )}
                {recommendations && route && (
                  <g
                    className="ground-recommended-layer"
                    pointerEvents="none"
                    aria-label="推荐走线图层"
                  >
                    <image
                      key={routeKey}
                      href={route.url}
                      width={route.width}
                      height={route.height}
                      transform={`matrix(${route.matrix.join(" ")})`}
                      preserveAspectRatio="none"
                      onLoad={() => setRouteState({ id: routeKey, status: "loaded" })}
                      onError={() => setRouteState({ id: routeKey, status: "error" })}
                    />
                  </g>
                )}
                {grid && (
                  <g
                    className="ground-grid-lines"
                    style={{ fontSize: 16 / zoom, strokeWidth: 1 / zoom }}
                  >
                    {gridLines}
                  </g>
                )}
                {points &&
                  layout.marks.map((mark, i) => {
                    const size = markerScale * (mark.kind === "spawn" ? 0.047 : 0.029);
                    const key =
                      mark.kind === "spawn"
                        ? mark.team === team
                          ? "spawn_ally"
                          : "spawn_enemy"
                        : `capture_${mark.label.toLowerCase()}`;
                    const icon = atlas.icons[key as keyof typeof atlas.icons];
                    return icon ? (
                      <GroundSvgImage
                        key={`${i}-${retryVersion}`}
                        asset={rotateAsset(icon, sourceChoice)}
                        onFailure={() => setFailed(true)}
                        x={mark.x * 1000 - size / 2}
                        y={mark.y * 1000 - size / 2}
                        width={size}
                        height={size}
                      >
                        <title>
                          {mark.label}
                          {mark.team ? ` · 队伍 ${mark.team}` : ""}
                        </title>
                      </GroundSvgImage>
                    ) : (
                      <text
                        key={i}
                        x={mark.x * 1000}
                        y={mark.y * 1000}
                        fill="#efede5"
                        textAnchor="middle"
                        fontSize={size}
                      >
                        {mark.label}
                      </text>
                    );
                  })}
              </g>
              <g ref={setEditorHost} />
            </svg>
            {(!loaded || (contours && !contourLoaded)) && !failed && (
              <p className="ground-map-status">
                {loaded ? "正在加载地形图层…" : "正在加载高清地图…"}
                <button onClick={alternateSource}>尝试备用线路</button>
              </p>
            )}
            {failed && (
              <p className="ground-map-status" role="alert">
                图层暂时无法加载。
                <button
                  onClick={() => {
                    setFailed(false);
                    setLoaded(false);
                    setRetryVersion((v) => v + 1);
                  }}
                >
                  重试加载
                </button>
                <a href={map.base.url} target="_blank" rel="noopener noreferrer">
                  打开原图 ↗
                </a>
              </p>
            )}
            {recommendations && (
              <output className="ground-route-note">
                {route ? (
                  <>
                    <a
                      href={route.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={route.title}
                    >
                      推荐走线 · {route.label} · 原攻略 ↗
                    </a>
                    <span>玩家经验重绘，仅供参考；布局与版本以原帖为准。</span>
                    {routeStatus === "loading" && <span>正在加载推荐走线…</span>}
                    {routeStatus === "error" && (
                      <span role="alert">
                        推荐走线加载失败。
                        <button onClick={() => setRouteRetry((v) => v + 1)}>重试走线</button>
                      </span>
                    )}
                  </>
                ) : (
                  <span>当前布局与出生侧暂无匹配的推荐走线。</span>
                )}
              </output>
            )}
            <MapEditor
              drawingView={{ x, y, w, h, crop, contours, grid, points }}
              key={`${map.id}:${layout.id}:${team}`}
              ref={editorRef}
              active={editing}
              close={() => {
                setEditing(false);
                requestAnimationFrame(() =>
                  document.querySelector<HTMLButtonElement>(".ground-edit-toggle")?.focus(),
                );
              }}
              mapControls={mapControls}
              context={{ mapId: map.id, layoutId: layout.id, team }}
              mapName={map.name}
              svg={svg}
              host={editorHost}
              viewWidth={w}
              view={{ x, y, w, h }}
              pan={startPan}
              knownContext={(c: EditorContext) =>
                atlas.maps.some(
                  (m) => m.id === c.mapId && m.layouts.some((l) => l.id === c.layoutId),
                )
              }
              openProject={openProject}
              describeContext={(c) => {
                const m = atlas.maps.find((v) => v.id === c.mapId);
                const l = m?.layouts.find((v) => v.id === c.layoutId);
                return `${m?.name || "地图"} · ${l?.name || "任务布局"} · 队伍 ${c.team}`;
              }}
              exportImage={(items, resolution, signal, progress) =>
                renderMapPng(
                  {
                    recommendation:
                      recommendations && route
                        ? {
                            asset: { url: route.url },
                            width: route.width,
                            height: route.height,
                            matrix: route.matrix,
                          }
                        : undefined,
                    base: rotateAsset(map.base, sourceChoice),
                    contourImage: rotateAsset(map.contourImage, sourceChoice),
                    view: { x, y, w, h },
                    mapFrame,
                    markerScale,
                    contours,
                    points,
                    grid,
                    team,
                    zoom,
                    bounds: map.bounds,
                    reference: map.grid.default_reference,
                    marks: layout.marks,
                    builtinIcons: atlas.icons,
                    editorIcons: editorIconAssets,
                  },
                  items,
                  resolution,
                  signal,
                  progress,
                )
              }
            />
            <div className="ground-zoom">
              <button
                aria-label="缩小地图"
                disabled={zoom <= 1}
                onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="放大地图"
                disabled={zoom >= 8}
                onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
              >
                ＋
              </button>
              <button onClick={reset}>复位</button>
            </div>
          </div>
        </div>
        <div className="ground-map-meta">
          <span>
            <i className="ground-ally" /> 己方出生点
          </span>
          <span>
            <i className="ground-enemy" /> 敌方出生点
          </span>
          <span>◇ 占领点</span>
          <span>等高距 5 m · 主等高距 25 m</span>
        </div>
        <details className="ground-notes">
          <summary>地形与坐标说明</summary>
          <p>
            地形高度 {map.contours.height_range_m.map((n) => n.toFixed(1)).join(" ~ ")}{" "}
            m，为世界坐标
            Y，并非已校准海拔。等高线仅表示地形，不包含建筑、桥梁或通行性判断。点位为任务简报参考位置，并非精确出生范围。
          </p>
          <p>
            参考网格使用地图文件中的间距，字母自上向下、数字自左向右；未与实际对局校准，切换布局不会重置编号。原始地形采样间距{" "}
            {map.contours.native_sample_m} m。
          </p>
        </details>
        <section className="ground-related">
          <h3>
            关联攻略 <span>{map.guides.length}</span>
          </h3>
          {map.guides.length ? (
            <>
              <p>同一地图的不同布局、季节及更新版本可能有差异，以原帖为准。</p>
              <div>
                {map.guides.map((g) => (
                  <a key={g.source} href={g.source} target="_blank" rel="noopener noreferrer">
                    <span>{g.title}</span>
                    <small>{g.edition} · 原帖 ↗</small>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p>暂未收录这张地图的关联攻略。</p>
          )}
        </section>
      </div>
    </section>
  );
}
