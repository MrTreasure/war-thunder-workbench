import { useLocale } from "../i18n/react";
import { localize, t } from "../i18n/core";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { StatsAccountMenu } from "./StatsAccountMenu";
export function WorkbenchAccountControl() {
  useLocale();

  const { session, busy, error, clearError, login, logout } = useWorkbenchAccount();
  return (
    <div className="wt-header-account">
      {session?.user?.id ? (
        <div>
          <StatsAccountMenu
            name={session.user.displayName || session.user.email || "已登录"}
            onLogout={logout}
          />
        </div>
      ) : (
        <button
          type="button"
          className="wt-header-login"
          disabled={busy}
          onClick={() => void login()}
        >
          {localize(busy ? "登录中…" : "登录")}
        </button>
      )}
      {localize(
        error && (
          <div className="wt-header-auth-message" role="alert">
            <span>{localize(error)}</span>
            <button type="button" className="quiet-button" onClick={clearError}>
              {t("关闭")}
            </button>
          </div>
        ),
      )}
    </div>
  );
}
