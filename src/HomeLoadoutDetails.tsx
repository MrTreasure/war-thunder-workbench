import { Modal } from "./Modal";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import type { LoadoutPlan } from "./loadouts";
import type { LoadoutPreview, LoadoutVehicle } from "./loadout-shares";
import { homeVehiclePresentation } from "./home-dashboard-model";
import "./loadouts.css";

export default function HomeLoadoutDetails({
  plan,
  summary,
  error,
  close,
}: {
  plan: LoadoutPlan;
  summary?: { vehicle?: LoadoutVehicle; preview: LoadoutPreview };
  error?: string;
  close: () => void;
}) {
  const entry = homeVehiclePresentation(plan.vehicleId);
  const vehicle =
    summary?.vehicle || (entry?.card ? { ...entry.card, country: plan.country } : undefined);
  return (
    <Modal title="模拟挂载详情" close={close} className="wt-home-prerequisites-modal">
      <div className="wt-home-prerequisites-content">
        {error && <p role="alert">{error}</p>}
        <LoadoutPlanCard
          title={plan.name || "未命名挂载"}
          vehicle={vehicle}
          preview={summary?.preview}
          meta={
            <>
              {plan.preset ? "预设组合" : `${plan.mounts.length} 个挂点`} · 来源{" "}
              {plan.sourceDate.slice(0, 10)} · 更新于{" "}
              {new Date(plan.updatedAt).toLocaleString("zh-CN")}
            </>
          }
        >
          {null}
        </LoadoutPlanCard>
      </div>
    </Modal>
  );
}
