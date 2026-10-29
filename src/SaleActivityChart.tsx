import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
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
  useLocale();

  if (!points.length)
    return compact ? (
      <button className="wt-price-trend-link" onClick={onActivate}>
        {t("暂无活动价格")}
      </button>
    ) : (
      <div className="wt-price-chart-empty">{t("此时间范围暂无活动价格")}</div>
    );
  const g = activityChartGeometry(points, compact);
  const svg = (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      preserveAspectRatio={compact ? "none" : "xMidYMid meet"}
      className={compact ? "wt-price-mini" : undefined}
      aria-label={t("{0}活动价格面积图；横轴为活动开始日期，纵轴为{1}。每次活动一个实心点。", [
        title,
        currency === "CNY" ? t("整包人民币价格") : t("金鹰价格"),
      ])}
    >
      {localize(
        !compact &&
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
                {localize(priceText(Math.round(g.max * r), currency))}
              </text>
            </g>
          )),
      )}
      <path d={g.area} className="wt-price-area" />
      <path d={g.line} className="wt-price-step" />
      {localize(
        g.dots.map(({ point, x, y }) => (
          <circle key={point.activityId} cx={x} cy={y} r={compact ? 2.5 : 4} />
        )),
      )}
      {localize(
        !compact && (
          <>
            <text x={g.left} y={g.height - 12}>
              {localize(priceDate(points[0].activityDate))}
            </text>
            {localize(
              points.length > 1 && (
                <text x={g.width - g.right} y={g.height - 12} textAnchor="end">
                  {localize(priceDate(points.at(-1)!.activityDate))}
                </text>
              ),
            )}
          </>
        ),
      )}
    </svg>
  );
  return (
    <div
      className={
        compact ? "wt-activity-chart wt-activity-chart-mini" : "wt-price-chart wt-activity-chart"
      }
    >
      {localize(
        compact ? (
          <button
            className="wt-price-trend-link"
            onClick={onActivate}
            aria-label={t("查看{0}活动价格详情", [title])}
          >
            {localize(svg)}
          </button>
        ) : (
          svg
        ),
      )}
      {localize(
        g.dots.map(({ point, x, y }) => {
          const estimate = point.evidenceKind === "official_announcement_derived";
          const value = `${estimate ? "≈ " : ""}${priceText(point.amountMinor, currency)}`;
          return (
            <span
              key={point.activityId}
              className="wt-price-point-anchor"
              style={{ left: `${(x / g.width) * 100}%`, top: `${(y / g.height) * 100}%` }}
            >
              <GameTip
                label={localize(point.activityTitle)}
                triggerLabel={`${localize(point.activityTitle)} · ${priceDate(point.activityDate)} · ${value}`}
                className="wt-price-point-tip"
                icon={<span aria-hidden="true" />}
                onActivate={compact ? onActivate : undefined}
              >
                <p>
                  {localize(priceDate(point.activityDate))} —{" "}
                  {localize(priceDate(point.activityEnd))}
                </p>
                <p>
                  {localize(value)} ·{" "}
                  {localize(estimate ? t("公告折扣估算，当时实售价未核实") : t("活动最低记录价"))}
                </p>
                {localize(
                  point.checkedAt && (
                    <p>
                      {t("核验日期")} {localize(priceDate(point.checkedAt))}
                    </p>
                  ),
                )}
              </GameTip>
            </span>
          );
        }),
      )}
    </div>
  );
}
