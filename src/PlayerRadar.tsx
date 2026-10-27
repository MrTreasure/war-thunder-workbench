import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
import { GameTip } from "./components/GameTip";
import { useId } from "react";
import type { RadarAxis } from "./player-stats-api";
import { statsRatio } from "./player-stats-api";
export function PlayerRadar({ axes }: { axes: RadarAxis[] }) {
  useLocale();
  const locale = useLocale();

  const id = useId();
  const xy = (i: number, r: number) => [
    160 + Math.cos(-Math.PI / 2 + (i * Math.PI) / 3) * r,
    140 + Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) * r,
  ];
  const points = (r: number) => axes.map((_, i) => xy(i, r).join(",")).join(" ");
  const values = axes.map((a, i) =>
    a.score == null ? null : xy(i, Math.max(0, Math.min(100, a.score)) * 0.88),
  );
  const complete = values.every((v) => v !== null);
  return (
    <section className="wt-record-panel wt-radar">
      <div className="wt-record-heading">
        <h2>
          {t("六维能力画像")}
          <GameTip label={t("六维能力画像")}>
            {t(
              "比值按 x/(1+x) 换算，胜率直接使用百分比。缺失项目留空，不代表零分；不是全服百分位。",
            )}
          </GameTip>
        </h2>
        <span>{t("同一模式")}</span>
      </div>
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- This labelled inline SVG is the chart, not a replaceable HTML image. */}
      <svg viewBox="0 0 320 280" role="img" aria-labelledby={id}>
        <title id={id}>{t("六维统计画像，各项真实数值可在下方展开查看")}</title>
        {localize(
          [0.25, 0.5, 0.75, 1].map((r) => (
            <polygon
              key={r}
              points={points(88 * r)}
              fill="none"
              stroke="currentColor"
              opacity={r === 1 ? 0.5 : 0.2}
            />
          )),
        )}
        {localize(
          axes.map((_, i) => {
            const [x, y] = xy(i, 88);
            return (
              <line key={i} x1={160} y1={140} x2={x} y2={y} stroke="currentColor" opacity=".2" />
            );
          }),
        )}
        {localize(
          complete && (
            <polygon points={values.map((v) => v!.join(",")).join(" ")} className="wt-radar-area" />
          ),
        )}
        {localize(
          values.map(
            (v, i) => v && <circle key={i} cx={v[0]} cy={v[1]} r={3} className="wt-radar-dot" />,
          ),
        )}
        {localize(
          axes.map((a, i) => {
            const [x, y] = xy(i, 116);
            const fullLabel = t(a.label);
            const compactKeys: Record<string, string> = {
              胜率: "雷达：胜率",
              "Win rate": "雷达：胜率",
              对空表现: "雷达：对空",
              对空效率: "雷达：对空",
              "对空 K/D": "雷达：对空",
              "Air performance": "雷达：对空",
              对地表现: "雷达：对地",
              对地效率: "雷达：对地",
              "对地 K/D": "雷达：对地",
              "Ground performance": "雷达：对地",
              "综合 K/D": "雷达：综合",
              "综合K/D": "雷达：综合",
              "Overall K/D": "雷达：综合",
              出击表现: "雷达：出击",
              出击效率: "雷达：出击",
              "Sortie performance": "雷达：出击",
              场均击毁: "雷达：场均",
              "Kills / battle": "雷达：场均",
            };
            const compact = compactKeys[a.label] ? t(compactKeys[a.label]) : fullLabel;
            const label =
              locale === "zh-CN"
                ? fullLabel
                : Array.from(compact).length > 9
                  ? Array.from(compact).slice(0, 8).join("") + "…"
                  : compact;
            return (
              <text
                key={a.label}
                x={x}
                y={y}
                textAnchor={x < 150 ? "end" : x > 170 ? "start" : "middle"}
                dominantBaseline="middle"
                aria-label={fullLabel}
              >
                <title>{fullLabel}</title>
                {label}
                <tspan x={x} dy="16">
                  {localize(a.score == null ? "—" : a.score.toFixed(0))}
                </tspan>
              </text>
            );
          }),
        )}
      </svg>
      <details>
        <summary>{t("查看数值")}</summary>
        <div className="wt-radar-values">
          {localize(
            axes.map((a) => (
              <div key={a.label}>
                <span>{localize(a.label)}</span>
                <span>
                  {localize(statsRatio(a.value))}
                  {localize(a.unit)}
                </span>
                <i style={{ width: a.score == null ? "0%" : a.score + "%" }} />
              </div>
            )),
          )}
        </div>
      </details>
    </section>
  );
}
