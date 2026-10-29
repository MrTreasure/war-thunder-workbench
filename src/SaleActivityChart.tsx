import { GameTip } from "./components/GameTip";
import { priceDate, priceText } from "./sale-price-model";
import { activityChartGeometry } from "./sale-activity-prices";
import type { ActivityPricePoint } from "./sale-activity-prices";

/** Shared time-scaled area chart; tips are HTML siblings of the SVG, usable in native dialogs. */
export function SaleActivityChart({
  points,
  currency,
  title,
  compact = false,
  onActivate,
}: {
  points: ActivityPricePoint[];
  currency: "CNY" | "GE";
  title: string;
  compact?: boolean;
  onActivate?: () => void;
}) {
  if (!points.length)
    return compact ? (
      <button className="wt-price-trend-link" onClick={onActivate}>
        暂无活动价格
      </button>
    ) : (
      <div className="wt-price-chart-empty">此时间范围暂无活动价格</div>
    );
  const g = activityChartGeometry(points, compact);
  const svg = (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      preserveAspectRatio={compact ? "none" : "xMidYMid meet"}
      className={compact ? "wt-price-mini" : undefined}
      aria-label={`${title}活动价格面积图；横轴为活动开始日期，纵轴为${currency === "CNY" ? "整包人民币价格" : "金鹰价格"}。每次活动一个实心点。`}
    >
      {!compact &&
        [0, 0.5, 1].map((r) => (
          <g key={r}>
            <line
              x1={g.left}
              x2={g.width - g.right}
              y1={g.baseline - (g.baseline - g.top) * r}
              y2={g.baseline - (g.baseline - g.top) * r}
              className="wt-price-grid"
            />
            <text x={g.left - 8} y={g.baseline - (g.baseline - g.top) * r + 4} textAnchor="end">
              {priceText(Math.round(g.max * r), currency)}
            </text>
          </g>
        ))}
      <path d={g.area} className="wt-price-area" />
      <path d={g.line} className="wt-price-step" />
      {g.dots.map(({ point, x, y }) => (
        <circle key={point.activityId} cx={x} cy={y} r={compact ? 2.5 : 4} />
      ))}
      {!compact && (
        <>
          <text x={g.left} y={g.height - 12}>
            {priceDate(points[0].activityDate)}
          </text>
          {points.length > 1 && (
            <text x={g.width - g.right} y={g.height - 12} textAnchor="end">
              {priceDate(points.at(-1)!.activityDate)}
            </text>
          )}
        </>
      )}
    </svg>
  );
  return (
    <div
      className={
        compact ? "wt-activity-chart wt-activity-chart-mini" : "wt-price-chart wt-activity-chart"
      }
    >
      {compact ? (
        <button
          className="wt-price-trend-link"
          onClick={onActivate}
          aria-label={`查看${title}活动价格详情`}
        >
          {svg}
        </button>
      ) : (
        svg
      )}
      {g.dots.map(({ point, x, y }) => {
        const estimate = point.evidenceKind === "official_announcement_derived";
        const value = `${estimate ? "≈ " : ""}${priceText(point.amountMinor, currency)}`;
        return (
          <span
            key={point.activityId}
            className="wt-price-point-anchor"
            style={{ left: `${(x / g.width) * 100}%`, top: `${(y / g.height) * 100}%` }}
          >
            <GameTip
              label={point.activityTitle}
              triggerLabel={`${point.activityTitle}，${priceDate(point.activityDate)}，${value}`}
              className="wt-price-point-tip"
              icon={<span aria-hidden="true" />}
              onActivate={compact ? onActivate : undefined}
            >
              <p>
                {priceDate(point.activityDate)} — {priceDate(point.activityEnd)}
              </p>
              <p>
                {value} · {estimate ? "公告折扣估算，当时实售价未核实" : "活动最低记录价"}
              </p>
              {point.checkedAt && <p>核验日期 {priceDate(point.checkedAt)}</p>}
            </GameTip>
          </span>
        );
      })}
    </div>
  );
}
