import { GameButton, GameLinkButton } from "./GameButton";

type CompareAction = { run: () => void; added?: boolean; full?: boolean };
/** Callers supply only actions supported by their current vehicle context. */
export function VehicleActions({
  onDetails,
  onResearch,
  onParts,
  onLineup,
  loadoutHref,
  compare,
  researchDisabled = false,
}: {
  onDetails?: () => void;
  onResearch?: () => void;
  onParts?: () => void;
  onLineup?: () => void;
  loadoutHref?: string;
  compare?: CompareAction;
  researchDisabled?: boolean;
}) {
  return (
    <>
      {onDetails && (
        <GameButton icon="details" onClick={onDetails}>
          载具详情
        </GameButton>
      )}
      {onResearch && (
        <GameButton
          tone="primary"
          icon="research"
          onClick={onResearch}
          disabled={researchDisabled}
          title={researchDisabled ? "独立获取载具不接入常规研发路线" : undefined}
        >
          研发载具
        </GameButton>
      )}
      {onParts && (
        <GameButton icon="performance" onClick={onParts}>
          研发配件
        </GameButton>
      )}
      {compare && (
        <GameButton icon="compare" onClick={compare.run} disabled={compare.added || compare.full}>
          {compare.added ? "已加入对比" : compare.full ? "对比已满（5辆）" : "加入对比"}
        </GameButton>
      )}
      {onLineup && <GameButton onClick={onLineup}>用于队列</GameButton>}
      {loadoutHref && (
        <GameLinkButton icon="loadout" href={loadoutHref}>
          模拟挂载
        </GameLinkButton>
      )}
    </>
  );
}
