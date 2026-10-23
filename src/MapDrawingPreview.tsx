import { localize, t } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useId, useState } from "react";
import atlas from "../data/ground-maps.json";
import icons from "../data/map-editor-icons.json";
import { AnnotationShape } from "./MapAnnotation";
import { GroundSvgImage } from "./map-assets";
import { tacticalSymbolIds } from "./map-editor-symbols";
import { parseProject } from "./map-editor-model";
import { CONTOUR_IMAGE_TRANSFORM, referenceGrid } from "./ground-map-projection";
import type { DrawingView } from "./map-drawing-log";
const iconIds = new Set([...icons.icons.map((i) => i.id), ...tacticalSymbolIds]);
export function parseDrawingPreview(project: unknown) {
  return parseProject(project, iconIds, (context) =>
    atlas.maps.some(
      (map) =>
        map.id === context.mapId && map.layouts.some((layout) => layout.id === context.layoutId),
    ),
  );
}
/** Read-only SVG reconstruction. No screenshots or generated images are fetched or saved. */
export function MapDrawingPreview({
  project: input,
  view,
  fit = false,
}: {
  project: unknown;
  view: DrawingView;
  fit?: boolean;
}) {
  useLocale();
  const clip = useId().replaceAll(":", "");
  const [failed, setFailed] = useState(false);
  const project = parseDrawingPreview(input);
  const map = atlas.maps.find((map) => map.id === project.mapId)!;
  const layout = map.layouts.find((layout) => layout.id === project.layoutId)!;
  const crop = view.crop;
  const extent = [crop[0], crop[1], crop[2], crop[3]];
  for (const item of project.items.filter((item) => !item.hidden)) {
    const ps = item.kind === "path" || item.kind === "shape" ? item.points : [item.point];
    for (const point of ps) {
      extent[0] = Math.min(extent[0], point.x - 0.1);
      extent[1] = Math.min(extent[1], point.y - 0.1);
      extent[2] = Math.max(extent[2], point.x + 0.15);
      extent[3] = Math.max(extent[3], point.y + 0.1);
    }
  }
  const box = fit
    ? [
        extent[0] * 1000,
        extent[1] * 1000,
        (extent[2] - extent[0]) * 1000,
        (extent[3] - extent[1]) * 1000,
      ]
    : [view.x, view.y, view.w, view.h];
  const grid = referenceGrid(map.bounds, map.grid.default_reference);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {failed && (
        <output style={{ padding: 8 }}>{t("底图素材加载失败，绘制数据仍可查看。")}</output>
      )}
      <svg
        viewBox={box.join(" ")}
        preserveAspectRatio="xMidYMid meet"
        aria-label={t("{0} · {1} · 队伍 {2}走线预览", [
          localize(map.name),
          localize(layout.name),
          project.team,
        ])}
        style={{ width: "100%", flex: 1, minHeight: 0, background: "#141c23" }}
      >
        <defs>
          <clipPath id={clip}>
            <rect
              x={crop[0] * 1000}
              y={crop[1] * 1000}
              width={(crop[2] - crop[0]) * 1000}
              height={(crop[3] - crop[1]) * 1000}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <GroundSvgImage
            asset={{ url: map.base.url }}
            x={0}
            y={0}
            width={1000}
            height={1000}
            onFailure={() => setFailed(true)}
          />
          {view.contours && (
            <GroundSvgImage
              asset={{ url: map.contourImage.url }}
              x={0}
              y={0}
              width={1000}
              height={1000}
              transform={CONTOUR_IMAGE_TRANSFORM}
              opacity={0.8}
              onFailure={() => setFailed(true)}
            />
          )}
          {view.grid && (
            <g stroke="#e0e6db" strokeOpacity={0.3} strokeWidth={1} fill="#e0e6db" fontSize={14}>
              {grid.vertical.map((line) => (
                <g key={`x${line.label}`}>
                  <path d={`M${line.position} 0V1000`} />
                  <text x={line.position + 3} y={crop[1] * 1000 + 18} stroke="none">
                    {line.label}
                  </text>
                </g>
              ))}
              {grid.horizontal.map((line) => (
                <g key={`y${line.label}`}>
                  <path d={`M0 ${line.position}H1000`} />
                  <text x={crop[0] * 1000 + 3} y={line.position + 16} stroke="none">
                    {line.label}
                  </text>
                </g>
              ))}
            </g>
          )}
          {view.points &&
            layout.marks.map((mark, i) => {
              const key =
                mark.kind === "spawn"
                  ? mark.team === project.team
                    ? "spawn_ally"
                    : "spawn_enemy"
                  : `capture_${mark.label.toLowerCase()}`;
              const asset = atlas.icons[key as keyof typeof atlas.icons];
              const size = (crop[2] - crop[0]) * 1000 * (mark.kind === "spawn" ? 0.047 : 0.029);
              return asset ? (
                <GroundSvgImage
                  key={i}
                  asset={{ url: asset.url }}
                  x={mark.x * 1000 - size / 2}
                  y={mark.y * 1000 - size / 2}
                  width={size}
                  height={size}
                />
              ) : (
                <text key={i} x={mark.x * 1000} y={mark.y * 1000} fill="#eee9df" fontSize={size}>
                  {mark.label}
                </text>
              );
            })}
        </g>
        <g pointerEvents="none">
          {project.items
            .filter((item) => !item.hidden)
            .map((item) => (
              <AnnotationShape key={item.id} item={item} selected={false} hitWidth={0} cdnOnly />
            ))}
        </g>
      </svg>
    </div>
  );
}
