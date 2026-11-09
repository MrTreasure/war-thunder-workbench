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
  const [selected, setSelected] = useState<string | null>(null);
  const owned = ownedIds === null ? null : homeCanonicalOwned(ownedIds);
  const selectedPlan = plans.find((p) => p.key === selected);
  const prerequisites = selectedPlan ? homeResearchPrerequisites(selectedPlan.targetId) : null;
  return (
    <>
      <div className="wt-home-research-list">
        {plans.slice(0, HOME_SUMMARY_LIMIT).map((plan) => {
          const entry = homeVehiclePresentation(plan.targetId);
          const status = homeResearchStatus(plan.targetId, ownedIds);
          const progress = homeResearchProgress(plan.targetId, ownedIds);
          return (
            <article className="wt-home-research-item" key={plan.key}>
              {entry?.card ? (
                <VehicleTile
                  unit={entry.card}
                  country={entry.country}
                  countryFlag={entry.flag}
                  showRank
                  owned={owned?.has(entry.canonicalId)}
                />
              ) : (
                <strong>{plan.targetName || "名称待核验"}</strong>
              )}
              <div className="wt-home-research-actions">
                {progress ? (
                  <div className="wt-home-research-progress">
                    <div>
                      <span>前置完成度</span>
                      <strong>{progress.percent}%</strong>
                    </div>
                    <progress
                      max={100}
                      value={progress.percent}
                      aria-label={`${plan.targetName || "研发目标"}前置完成度`}
                    />
                    <span>
                      已拥有 {progress.completed} / {progress.total} 辆前置车辆
                    </span>
                  </div>
                ) : (
                  <span>前置完成度：未知</span>
                )}
                <button className="quiet-button" onClick={() => setSelected(plan.key)}>
                  {status.state === "prerequisites"
                    ? `还剩 ${status.remaining} 辆前置车辆`
                    : status.state === "researching"
                      ? "正在研发 · 查看前置"
                      : status.state === "owned"
                        ? "已拥有 · 查看前置"
                        : status.state === "garage-required"
                          ? "查看前置车辆"
                          : "前置资料待核验"}
                </button>
                {owned === null && <span>绑定角色并同步车库后查看前置进度</span>}
                <Link
                  to="/tree"
                  search={{ country: plan.country, category: plan.category, plan: true }}
                  preload={false}
                >
                  继续研发 →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {selectedPlan && (
        <Modal
          title={`${selectedPlan.targetName || "研发目标"} · 前置车辆`}
          close={() => setSelected(null)}
          className="wt-home-prerequisites-modal"
        >
          <div className="wt-home-prerequisites-content">
            {prerequisites === null ? (
              <p>前置资料待核验。</p>
            ) : prerequisites.length === 0 ? (
              <p>这辆载具没有前置车辆。</p>
            ) : (
              <>
                <p>
                  {owned
                    ? "按研发顺序展示，已拥有车辆已标注。"
                    : "按研发顺序展示；绑定角色并同步车库后可查看拥有状态。"}
                </p>
                <div className="wt-home-prerequisites-grid">
                  {prerequisites.map((id) => {
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
                          {owned === null ? "拥有状态未知" : owned.has(id) ? "已拥有" : "尚未拥有"}
                        </span>
                      </div>
                    ) : (
                      <p key={id}>载具资料待核验</p>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
