import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
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
  useLocale();
  const entry = homeVehiclePresentation(plan.vehicleId);
  const vehicle =
    summary?.vehicle || (entry?.card ? { ...entry.card, country: plan.country } : undefined);
  return (
    <Modal title={t("模拟挂载详情")} close={close} className="wt-home-prerequisites-modal">
      <div className="wt-home-prerequisites-content">
        {localize(error && <p role="alert">{localize(error)}</p>)}
        <LoadoutPlanCard
          title={localize(plan.name || "未命名挂载")}
          vehicle={vehicle}
          preview={summary?.preview}
          meta={localize(
            <>
              {localize(plan.preset ? "预设组合" : `${plan.mounts.length} 个挂点`)}
              {t("· 来源")}
              {localize(" ")}
              {localize(plan.sourceDate.slice(0, 10))}
              {t("· 更新于")}
              {localize(" ")}
              {localize(new Date(plan.updatedAt).toLocaleString(getLocale()))}
            </>,
          )}
        >
          {localize(null)}
        </LoadoutPlanCard>
      </div>
    </Modal>
  );
}
