import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Modal } from "./Modal";
import { VehicleTile } from "./VehicleTile";
import {
  HOME_SUMMARY_LIMIT,
  homeCanonicalOwned,
  homeResearchPrerequisites,
  homeResearchStatus,
  homeResearchProgress,
  homeVehiclePresentation,
  type homeDashboardSummary,
} from "./home-dashboard-model";

type Plan = ReturnType<typeof homeDashboardSummary>["plans"][number];
export function HomeResearchPlans({
  plans,
  ownedIds,
}: {
  plans: Plan[];
  ownedIds: ReadonlySet<string> | null;
}) {
  useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const owned = ownedIds === null ? null : homeCanonicalOwned(ownedIds);
  const selectedPlan = plans.find((p) => p.key === selected);
  const prerequisites = selectedPlan ? homeResearchPrerequisites(selectedPlan.targetId) : null;
  return (
    <>
      <div className="wt-home-research-list">
        {localize(
          plans.slice(0, HOME_SUMMARY_LIMIT).map((plan) => {
            const entry = homeVehiclePresentation(plan.targetId);
            const status = homeResearchStatus(plan.targetId, ownedIds);
            const progress = homeResearchProgress(plan.targetId, ownedIds);
            return (
              <article className="wt-home-research-item" key={plan.key}>
                {localize(
                  entry?.card ? (
                    <VehicleTile
                      unit={entry.card}
                      country={entry.country}
                      countryFlag={entry.flag}
                      showRank
                      owned={owned?.has(entry.canonicalId)}
                    />
                  ) : (
                    <strong>{localize(plan.targetName || "名称待核验")}</strong>
                  ),
                )}
                <div className="wt-home-research-actions">
                  {localize(
                    progress ? (
                      <div className="wt-home-research-progress">
                        <div>
                          <span>{t("前置完成度")}</span>
                          <strong>{localize(progress.percent)}%</strong>
                        </div>
                        <progress
                          max={100}
                          value={progress.percent}
                          aria-label={localize(`${plan.targetName || "研发目标"}前置完成度`)}
                        />
                        <span>
                          {t("已拥有")}
                          {localize(progress.completed)} / {localize(progress.total)}
                          {t("辆前置车辆")}
                        </span>
                      </div>
                    ) : (
                      <span>{t("前置完成度：未知")}</span>
                    ),
                  )}
                  {localize(status.state === "researching" && <span>{t("正在研发")}</span>)}
                  {localize(status.state === "owned" && <span>{t("已拥有")}</span>)}
                  {localize(owned === null && <span>{t("绑定角色并同步车库后查看前置进度")}</span>)}
                  <div className="wt-home-research-links">
                    <button
                      type="button"
                      className="wt-home-text-action"
                      onClick={() => setSelected(plan.key)}
                    >
                      {t("查看详情")}
                    </button>
                    <Link
                      to="/tree"
                      search={{ country: plan.country, category: plan.category, plan: true }}
                      preload={false}
                    >
                      {t("继续研发 →")}
                    </Link>
                  </div>
                </div>
              </article>
            );
          }),
        )}
      </div>
      {localize(
        selectedPlan && (
          <Modal
            title={localize(`${selectedPlan.targetName || "研发目标"} · 前置车辆`)}
            close={() => setSelected(null)}
            className="wt-home-prerequisites-modal"
          >
            <div className="wt-home-prerequisites-content">
              {localize(
                prerequisites === null ? (
                  <p>{t("前置资料待核验。")}</p>
                ) : prerequisites.length === 0 ? (
                  <p>{t("这辆载具没有前置车辆。")}</p>
                ) : (
                  <>
                    <p>
                      {localize(
                        owned
                          ? "按研发顺序展示，已拥有车辆已标注。"
                          : "按研发顺序展示；绑定角色并同步车库后可查看拥有状态。",
                      )}
                    </p>
                    <div className="wt-home-prerequisites-grid">
                      {localize(
                        prerequisites.map((id) => {
                          const entry = homeVehiclePresentation(id);
                          return entry?.card ? (
                            <div key={id} className="wt-home-prerequisite">
                              <VehicleTile
                                unit={entry.card}
                                country={entry.country}
                                countryFlag={entry.flag}
                                showRank
                                owned={owned?.has(id)}
                              />
                              <span>
                                {localize(
                                  owned === null
                                    ? "拥有状态未知"
                                    : owned.has(id)
                                      ? "已拥有"
                                      : "尚未拥有",
                                )}
                              </span>
                            </div>
                          ) : (
                            <p key={id}>{t("载具资料待核验")}</p>
                          );
                        }),
                      )}
                    </div>
                  </>
                ),
              )}
            </div>
          </Modal>
        ),
      )}
    </>
  );
}
