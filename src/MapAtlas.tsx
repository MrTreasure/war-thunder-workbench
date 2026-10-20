/* Interactive SVG map owns arrow-key pan and Home reset; native HTML has no map widget. */
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { useId, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import atlas from "../data/ground-maps.json";
import { Route } from "./routes/_workbench.maps";
import { Modal } from "./Modal";

type GroundMap = (typeof atlas.maps)[number];
const normalize = (s: string) =>
  s.normalize("NFKC").toLowerCase().replaceAll("日曜", "日耀").replaceAll("马奇诺", "马其诺");
export function MapAtlas() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/maps" });
  const [query, setQuery] = useState("");
  const [onlyGuides, setOnlyGuides] = useState(false);
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
        (!onlyGuides || map.guides.length),
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
        <button aria-pressed={onlyGuides} onClick={() => setOnlyGuides((v) => !v)}>
          仅看有关联攻略
        </button>
        <span>{cards.length} 个三点占领布局</span>
      </div>
      <section className="ground-gallery" aria-label="地图列表">
        {cards.map(({ map, thumb }) => (
          <button
            className="ground-card"
            key={thumb.layoutId}
            onClick={() => void navigate({ search: { map: map.id, side: thumb.layoutId } })}
          >
            <div className="ground-card-image">
              <img
                src={thumb.image.url}
                alt={`${map.name} ${thumb.name} 点位缩略图`}
                width={thumb.width}
                height={thumb.height}
                loading="lazy"
                decoding="async"
              />
              {map.guides.length > 0 && (
                <span className="ground-guide-badge">攻略 {map.guides.length}</span>
              )}
            </div>
            <div className="ground-card-caption">
              <strong>{map.name}</strong>
              <span>{thumb.name}</span>
              <small>
                {map.layouts.length} 种任务布局 <b aria-hidden="true">↗</b>
              </small>
            </div>
          </button>
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
      {selected && (
        <GroundDetail
          key={selected.id}
          map={selected}
          layoutId={search.side}
          choose={(id) =>
            void navigate({
              search: { map: selected.id, side: id },
              replace: true,
              resetScroll: false,
            })
          }
          close={() =>
            void navigate({ search: { map: undefined, side: undefined }, resetScroll: false })
          }
        />
      )}
    </main>
  );
}
function GroundDetail({
  map,
  layoutId,
  choose,
  close,
}: {
  map: GroundMap;
  layoutId?: string;
  choose: (id: string) => void;
  close: () => void;
}) {
  const layout = map.layouts.find((l) => l.id === layoutId) || map.layouts[0];
  const [contours, setContours] = useState(true),
    [points, setPoints] = useState(true),
    [grid, setGrid] = useState(false),
    [cropped, setCropped] = useState(true),
    [team, setTeam] = useState(1);
  const [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const clipId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const crop = cropped && layout.crop ? layout.crop : [0, 0, 1, 1];
  const baseW = (crop[2] - crop[0]) * 1000,
    baseH = (crop[3] - crop[1]) * 1000;
  const w = baseW / zoom,
    h = baseH / zoom;
  const x = crop[0] * 1000 + (baseW - w) / 2 + offset.x,
    y = crop[1] * 1000 + (baseH - h) / 2 + offset.y;
  const [x0, z0] = map.bounds[0],
    [x1, z1] = map.bounds[1];
  const origin = map.grid.default_reference.origin_xz_m,
    step = map.grid.default_reference.step_xz_m;
  const gridLines = [];
  if (grid) {
    for (let i = 0; i < 100; i++) {
      const gx = ((origin[0] + i * step[0] - x0) / (x1 - x0)) * 1000,
        gz = ((origin[1] + i * step[1] - z0) / (z1 - z0)) * 1000;
      if (gx <= 1000 && gx >= 0)
        gridLines.push(
          <g key={`x${i}`}>
            <path d={`M${gx} 0V1000`} />
            <text x={gx + 3} y={y + 18 / zoom}>
              {i + 1}
            </text>
          </g>,
        );
      if (gz <= 1000 && gz >= 0)
        gridLines.push(
          <g key={`z${i}`}>
            <path d={`M0 ${gz}H1000`} />
            <text x={x + 4 / zoom} y={gz + 15 / zoom}>
              {i < 26
                ? String.fromCharCode(65 + i)
                : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))}
            </text>
          </g>,
        );
    }
  }
  return (
    <Modal className="ground-dialog" title={map.name} subtitle={map.english} close={close}>
      <div className="ground-detail-body">
        <div className="ground-controls">
          <label>
            任务布局
            <select
              value={layout.id}
              onChange={(e) => {
                reset();
                choose(e.target.value);
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
            </select>
          </label>
          <label>
            己方出生侧
            <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
              <option value={1}>队伍 1</option>
              <option value={2}>队伍 2</option>
            </select>
          </label>
          <div className="ground-layer-toggles">
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
        <div className="ground-stage" data-zoomed={zoom > 1}>
          <svg
            ref={svg}
            role="application"
            tabIndex={0}
            onKeyDown={(e) => {
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
              svg.current?.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const rect = svg.current!.getBoundingClientRect();
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
                <rect x={x} y={y} width={w} height={h} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <image
                href={map.base.url}
                x={0}
                y={0}
                width={1000}
                height={1000}
                preserveAspectRatio="none"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
              {contours && (
                <image
                  href={map.contourImage.url}
                  x={0}
                  y={0}
                  width={1000}
                  height={1000}
                  preserveAspectRatio="none"
                  opacity={0.8}
                  onError={() => setFailed(true)}
                />
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
                  const size = w * (mark.kind === "spawn" ? 0.047 : 0.029);
                  const key =
                    mark.kind === "spawn"
                      ? mark.team === team
                        ? "spawn_ally"
                        : "spawn_enemy"
                      : `capture_${mark.label.toLowerCase()}`;
                  const icon = atlas.icons[key as keyof typeof atlas.icons];
                  return icon ? (
                    <image
                      key={i}
                      href={icon.url}
                      x={mark.x * 1000 - size / 2}
                      y={mark.y * 1000 - size / 2}
                      width={size}
                      height={size}
                    >
                      <title>
                        {mark.label}
                        {mark.team ? ` · 队伍 ${mark.team}` : ""}
                      </title>
                    </image>
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
          </svg>
          {!loaded && !failed && <p className="ground-map-status">正在加载高清地图…</p>}
          {failed && (
            <p className="ground-map-status" role="alert">
              图层加载失败，请关闭后重试。
              <a href={map.base.url} target="_blank" rel="noreferrer">
                打开原图 ↗
              </a>
            </p>
          )}
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
                  <a key={g.source} href={g.source} target="_blank" rel="noreferrer">
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
    </Modal>
  );
}
