import { useState } from "react";
import { Modal } from "../Modal";
import { HeyboxAccountDialog } from "./HeyboxAccountDialog";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { StatsAccountMenu } from "./StatsAccountMenu";
export function WorkbenchAccountControl() {
  const { session, busy, error, clearError, login, logout } = useWorkbenchAccount();
  const [methods, setMethods] = useState(false);
  const [heybox, setHeybox] = useState<"login" | "bind" | null>(null);
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
          disabled={busy}
          onClick={() => setMethods(true)}
        >
          {busy ? "登录中…" : "登录"}
        </button>
      )}
      {methods && (
        <Modal title="登录工作台" close={() => setMethods(false)} className="wt-heybox-dialog">
          <div className="wt-login-methods">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMethods(false);
                void login();
              }}
            >
              账号登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMethods(false);
                setHeybox("login");
              }}
            >
              小黑盒登录
            </button>
          </div>
        </Modal>
      )}
      {heybox && <HeyboxAccountDialog purpose={heybox} close={() => setHeybox(null)} />}
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
