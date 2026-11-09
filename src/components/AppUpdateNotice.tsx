import { useState, useSyncExternalStore } from "react";
import { appUpdateGuards, useAppUpdate, useCountryUpdateStatus } from "../app-update-react";
import { vehicleStore } from "../vehicle-store";
import "./AppUpdateNotice.css";

/** Mount once in the shared shell; country is optional and never causes data loading. */
export function AppUpdateNotice({ country }: { country?: string }) {
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
    <aside className="wt-app-update" aria-label="版本与资料更新">
      {visible && (
        <>
          <output className="wt-app-update-copy">
            <strong>页面版本已更新</strong>
            <span>刷新后使用新版，当前页面可继续使用。</span>
            {reasons.length > 0 && <span>请先保存或完成同步：{reasons.join("、")}。</span>}
            {blocked && reasons.length > 0 && (
              <span>已阻止刷新，请先保存后再更新，或继续编辑。</span>
            )}
          </output>
          <div className="wt-app-update-actions">
            <button
              type="button"
              onClick={() => {
                if (!appUpdateGuards.requestReload(() => location.reload())) setBlocked(true);
              }}
            >
              刷新页面
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed(update.available);
                setBlocked(false);
              }}
            >
              {reasons.length ? "继续编辑" : "稍后"}
            </button>
          </div>
        </>
      )}
      {(data?.updating || data?.error) && (
        <output className="wt-app-update-data">
          {data.updating
            ? "正在检查当前国家资料更新，页面版本不受影响。"
            : "国家资料更新失败，继续使用已加载资料。"}
        </output>
      )}
      {country && data?.error && !data.updating && (
        <div className="wt-app-update-actions">
          <button type="button" onClick={() => void vehicleStore.revalidate(country, true)}>
            重试资料更新
          </button>
        </div>
      )}
    </aside>
  );
}
