import definitions from "../data/comparison-purpose.json" with { type: "json" };
import { spadedValue, type VehicleMetricRow } from "./vehicle-compare.ts";
export const vehiclePurposes = definitions.vehicle;
export const missilePurposes = definitions.missile;
export function purposeMetric(row: VehicleMetricRow, ids: string[]) {
  return row.metrics.some((metric) => metric && ids.includes(metric.id.replace(/-\d+$/, "")));
}
/** Explain only like-for-like sourced endpoints, with the same known measurement altitude. */
export function vehiclePurposeSummary(rows: VehicleMetricRow[], column: number, mode: "ab" | "rb") {
  if (column === 0) return "当前基准；下列差值以此列为参照。";
  const known: string[] = [];
  let missing = 0;
  for (const row of rows) {
    const baseline = row.metrics[0];
    const metric = row.metrics[column];
    const a = spadedValue(baseline, mode),
      b = spadedValue(metric, mode);
    if (a === null || b === null || baseline?.altitudeM !== metric?.altitudeM) {
      missing++;
      continue;
    }
    const delta = b - a;
    if (delta)
      known.push(
        `${row.label}${delta > 0 ? "增加" : "减少"} ${Math.abs(delta).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${row.unit}`,
      );
  }
  return [
    known.length ? known.join("；") : "已知同条件指标无差异或不足以比较",
    missing ? `${missing} 项缺值或测定高度不同，未作摘要判断` : "",
    "没有综合评分，结合下表判断取舍。",
  ]
    .filter(Boolean)
    .join("。 ");
}
