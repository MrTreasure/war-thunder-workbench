export type HallQuality = {
  version: "quality-v1";
  score: number;
  evaluations: number;
  lowSample: boolean;
  dataStatus: "catalog-verified" | "needs-review" | "unknown" | "invalid";
};
export const qualityExplanation =
  "优先展示资料已核对的方案，再参考赞踩比例和评价数量；评价较少时保守排序，同等条件近期发布优先。资料核对不代表当前游戏版本。";
export function qualitySummary(quality: HallQuality | undefined, up?: number, down?: number) {
  const count = quality?.evaluations ?? (up !== undefined && down !== undefined ? up + down : null);
  const sample =
    count === null
      ? "评价数未知"
      : count === 0
        ? "暂无评价"
        : `${count} 条评价${count < 5 ? " · 评价较少" : ""}`;
  const status =
    quality?.dataStatus === "catalog-verified"
      ? "当前资料目录已核对"
      : quality?.dataStatus === "needs-review"
        ? "资料待核对"
        : quality?.dataStatus === "invalid"
          ? "资料版本或配置需重新核对"
          : "来源核对状态未知";
  return `${sample} · ${status}`;
}
export function assertQualitySort(
  items: { quality?: HallQuality }[],
  sort: string,
  actual?: string,
) {
  if (sort === "quality-v1" && actual !== sort)
    throw new Error("服务端尚未提供全局质量排序，请选择最新发布。");
  if (sort === "quality-v1" && items.some((item) => item.quality?.version !== "quality-v1"))
    throw new Error("质量排序依据缺失，请稍后重试。");
}
