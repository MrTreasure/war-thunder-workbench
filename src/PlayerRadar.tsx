import { GameTip } from "./components/GameTip";
import { useId } from "react";
import type { RadarAxis } from "./player-stats-api";
import { statsRatio } from "./player-stats-api";
export function PlayerRadar({ axes }: { axes: RadarAxis[] }) {
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
          六维能力画像
          <GameTip label="六维能力画像">
            比值按 x/(1+x) 换算，胜率直接使用百分比。缺失项目留空，不代表零分；不是全服百分位。
          </GameTip>
        </h2>
        <span>同一模式</span>
      </div>
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- This labelled inline SVG is the chart, not a replaceable HTML image. */}
      <svg viewBox="0 0 320 280" role="img" aria-labelledby={id}>
        <title id={id}>六维统计画像，各项真实数值可在下方展开查看</title>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={points(88 * r)}
            fill="none"
            stroke="currentColor"
            opacity={r === 1 ? 0.5 : 0.2}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = xy(i, 88);
          return (
            <line key={i} x1={160} y1={140} x2={x} y2={y} stroke="currentColor" opacity=".2" />
          );
        })}
        {complete && (
          <polygon points={values.map((v) => v!.join(",")).join(" ")} className="wt-radar-area" />
        )}
        {values.map(
          (v, i) => v && <circle key={i} cx={v[0]} cy={v[1]} r={3} className="wt-radar-dot" />,
        )}
        {axes.map((a, i) => {
          const [x, y] = xy(i, 116);
          return (
            <text
              key={a.label}
              x={x}
              y={y}
              textAnchor={x < 150 ? "end" : x > 170 ? "start" : "middle"}
              dominantBaseline="middle"
            >
              {a.label}
              <tspan x={x} dy="16">
                {a.score == null ? "—" : a.score.toFixed(0)}
              </tspan>
            </text>
          );
        })}
      </svg>
      <details>
        <summary>查看数值</summary>
        <div className="wt-radar-values">
          {axes.map((a) => (
            <div key={a.label}>
              <span>{a.label}</span>
              <span>
                {statsRatio(a.value)}
                {a.unit}
              </span>
              <i style={{ width: a.score == null ? "0%" : a.score + "%" }} />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
