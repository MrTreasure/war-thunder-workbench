import { useLocale } from "../i18n/react";
import { t, localize } from "../i18n/core";
import { useState, useSyncExternalStore } from "react";
import { appUpdateGuards, useAppUpdate, useCountryUpdateStatus } from "../app-update-react";
import { vehicleStore } from "../vehicle-store";
import "./AppUpdateNotice.css";

/** Mount once in the shared shell; country is optional and never causes data loading. */
export function AppUpdateNotice({ country }: { country?: string }) {
  useLocale();
  const update = useAppUpdate();
  const reasons = useSyncExternalStore(
    appUpdateGuards.subscribe,
    appUpdateGuards.getSnapshot,
    appUpdateGuards.getSnapshot,
  );
  const data = useCountryUpdateStatus(country);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const visible = update.available && dismissed !== update.available;
  if (!visible && !data?.updating && !data?.error) return null;
  return (
    <aside className="wt-app-update" aria-label={t("版本与资料更新")}>
      {localize(
        visible && (
          <>
            <output className="wt-app-update-copy">
              <strong>{t("页面版本已更新")}</strong>
              <span>{t("刷新后使用新版，当前页面可继续使用。")}</span>
              {localize(
                reasons.length > 0 && (
                  <span>
                    {t("请先保存或完成同步：")}
                    {localize(reasons.map((reason) => localize(reason)).join(" · "))}。
                  </span>
                ),
              )}
              {localize(
                blocked && reasons.length > 0 && (
                  <span>{t("已阻止刷新，请先保存后再更新，或继续编辑。")}</span>
                ),
              )}
            </output>
            <div className="wt-app-update-actions">
              <button
                type="button"
                onClick={() => {
                  if (!appUpdateGuards.requestReload(() => location.reload())) setBlocked(true);
                }}
              >
                {t("刷新页面")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissed(update.available);
                  setBlocked(false);
                }}
              >
                {localize(reasons.length ? "继续编辑" : "稍后")}
              </button>
            </div>
          </>
        ),
      )}
      {localize(
        (data?.updating || data?.error) && (
          <output className="wt-app-update-data">
            {localize(
              data.updating
                ? "正在检查当前国家资料更新，页面版本不受影响。"
                : "国家资料更新失败，继续使用已加载资料。",
            )}
          </output>
        ),
      )}
      {localize(
        country && data?.error && !data.updating && (
          <div className="wt-app-update-actions">
            <button type="button" onClick={() => void vehicleStore.revalidate(country, true)}>
              {t("重试资料更新")}
            </button>
          </div>
        ),
      )}
    </aside>
  );
}
