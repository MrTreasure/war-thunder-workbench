import { useLocale } from "../i18n/react";
import { t, localize } from "../i18n/core";
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
  useLocale();
  return (
    <>
      {localize(
        onDetails && (
          <GameButton icon="details" onClick={onDetails}>
            {t("载具详情")}
          </GameButton>
        ),
      )}
      {localize(
        onResearch && (
          <GameButton
            tone="primary"
            icon="research"
            onClick={onResearch}
            disabled={researchDisabled}
            title={localize(researchDisabled ? "独立获取载具不接入常规研发路线" : undefined)}
          >
            {t("研发载具")}
          </GameButton>
        ),
      )}
      {localize(
        onParts && (
          <GameButton icon="performance" onClick={onParts}>
            {t("研发配件")}
          </GameButton>
        ),
      )}
      {localize(
        compare && (
          <GameButton icon="compare" onClick={compare.run} disabled={compare.added || compare.full}>
            {localize(compare.added ? "已加入对比" : compare.full ? "对比已满（5辆）" : "加入对比")}
          </GameButton>
        ),
      )}
      {localize(onLineup && <GameButton onClick={onLineup}>{t("用于队列")}</GameButton>)}
      {localize(
        loadoutHref && (
          <GameLinkButton icon="loadout" href={loadoutHref}>
            {t("模拟挂载")}
          </GameLinkButton>
        ),
      )}
    </>
  );
}
