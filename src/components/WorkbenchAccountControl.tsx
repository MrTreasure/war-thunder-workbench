import { useState } from "react";
import { HeyboxAccountDialog } from "./HeyboxAccountDialog";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { StatsAccountMenu } from "./StatsAccountMenu";
export function WorkbenchAccountControl() {
  const { session, busy, initializing, error, clearError, login, logout } = useWorkbenchAccount();
  const [heybox, setHeybox] = useState<"bind" | null>(null);
  return (
    <div className="wt-header-account">
      {session?.user?.id ? (
        <div>
          <StatsAccountMenu
            name={session.user.displayName || session.user.email || "已登录"}
            onLogout={logout}
            onHeyboxLink={() => setHeybox("bind")}
          />
        </div>
      ) : (
        <button
          type="button"
          className="wt-header-login"
          disabled={busy || initializing}
          onClick={() => void login()}
        >
          {initializing ? "账号加载中…" : busy ? "登录中…" : "登录"}
        </button>
      )}
      {heybox && <HeyboxAccountDialog purpose="bind" close={() => setHeybox(null)} />}
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
