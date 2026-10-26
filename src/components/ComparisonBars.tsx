/** Small-multiple bars: each metric has a zero baseline and visible text values. */
export interface ComparisonSeries {
  id: string;
  label: string;
  value: number | null;
  basis?: string | null;
}
export function ComparisonBars({
  series,
  formatValue,
}: {
  series: readonly ComparisonSeries[];
  formatValue: (value: number) => string;
}) {
  const known = series.flatMap((item) => (item.value === null ? [] : [item.value]));
  const maximum = Math.max(0, ...known);
  const groups: { items: ComparisonSeries[]; value: number | null }[] = [];
  for (const item of series) {
    const existing = groups.find((group) => group.value === item.value);
    if (existing) existing.items.push(item);
    else groups.push({ items: [item], value: item.value });
  }
  return (
    <ul className="wt-comparison-bars" aria-label="四种状态对比数值">
      {groups.map((group) => (
        <li
          key={group.items.map((item) => item.id).join("-")}
          data-series={group.items[0].id}
          data-unknown={group.value === null || undefined}
          title={group.items
            .map((item) => `${item.label}：${item.basis || "Wiki 未提供可靠数值"}`)
            .join("\n")}
        >
          <span className="wt-comparison-label">
            {group.items.length === series.length
              ? "全部状态"
              : group.items.map((item) => item.label).join("／")}
          </span>
          <span className="wt-comparison-track" aria-hidden="true">
            {group.value !== null && (
              <span
                className="wt-comparison-fill"
                style={{ width: `${maximum > 0 ? Math.max(0, group.value / maximum) * 100 : 0}%` }}
              />
            )}
          </span>
          <span className="wt-comparison-value">
            {group.value === null ? "待核对" : formatValue(group.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
