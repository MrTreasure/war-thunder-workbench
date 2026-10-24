import { useAccountWorkspace } from "../workspace-context";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { StatsAccountMenu } from "./StatsAccountMenu";
export function WorkbenchAccountControl() {
  const workspace = useAccountWorkspace();
  const { session, busy, error, clearError, login, logout } = useWorkbenchAccount();
  return (
    <div className="wt-header-account">
      {session?.user?.id ? (
        <div>
          <StatsAccountMenu
            name={session.user.displayName || session.user.email || "已登录"}
            onLogout={logout}
          />
          <small className="wt-workspace-status">{workspace?.status}</small>
        </div>
      ) : (
        <button
          type="button"
          className="wt-header-login"
          disabled={busy}
          onClick={() => void login()}
        >
          {busy ? "登录中…" : "登录"}
        </button>
      )}
      {error && (
        <div className="wt-header-auth-message" role="alert">
          <span>{error}</span>
          <button type="button" className="quiet-button" onClick={clearError}>
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
