import catalog from "../data/map-editor-icons.json";
import { GroundSvgImage } from "./map-assets";
import { TacticalSymbol, tacticalSymbol } from "./map-editor-symbols";
import { fontFamily } from "./map-editor-fonts";
import { anchorPoint, arrowPoints, routeBodyData, routeDash, routeDecorations, pathData, shapeBounds, shapePath } from "./map-editor-model";
import type { Annotation, RouteAnnotation } from "./map-editor-model";
const icons = new Map(catalog.icons.map(i => [i.id, i]));
export function RouteInk({ item }: { item: RouteAnnotation }) {
  const triangle = arrowPoints(item),
    d = routeBodyData(item),
    dash = routeDash(item).join(" ") || undefined;
  return (
    <g
      pointerEvents="none"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin={item.lineStyle === "defense" ? "miter" : "round"}
    >
      <path
        d={d}
        stroke="#10191f"
        strokeOpacity={0.7}
        strokeWidth={item.width * 1000 + 1.8}
        strokeDasharray={dash}
      />
      <path d={d} stroke={item.color} strokeWidth={item.width * 1000} strokeDasharray={dash} />
      {routeDecorations(item).map((points, i) => (
        <path key={i} d={pathData(points)} stroke={item.color} strokeWidth={item.width * 1000} />
      ))}
      {triangle.length > 0 &&
        (item.arrowHead === "open" ? (
          <path
            d={pathData([triangle[1], triangle[0], triangle[2]])}
            stroke={item.color}
            strokeWidth={item.width * 1000}
          />
        ) : (
          <polygon
            points={triangle.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
            fill={item.color}
          />
        ))}
    </g>
  );
}
export function AnnotationShape({
  item,
  selected,
  hitWidth,
  cdnOnly = false,
}: {
  item: Annotation;
  selected: boolean;
  hitWidth: number;
  cdnOnly?: boolean;
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
    return (
      <g data-annotation-id={item.id}>
        <path
          d={routeBodyData(item)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(item.width * 1000, hitWidth)}
          pointerEvents="stroke"
        />
        <path
          d={pathData(item.points, item.curve)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(item.width * 1000, hitWidth)}
          pointerEvents="stroke"
        />
        <RouteInk item={item} />
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
          fontWeight={item.fontWeight ?? 600}
          fontFamily={fontFamily(item.font)}
          fontStyle={item.italic ? "italic" : "normal"}
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
              asset={cdnOnly ? { url: icon.asset.url } : icon.asset}
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
