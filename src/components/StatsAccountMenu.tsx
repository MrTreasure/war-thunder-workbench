import { useAccountWorkspace } from "../workspace-context";
import { UnlinkGameAccount } from "../GameAccountBinding";
import { statsRequest, notifyStatsAccountLogin } from "../player-stats-api";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { Modal } from "../Modal";
import { useEffect, useId, useRef, useState } from "react";

export function StatsAccountMenu({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => Promise<void>;
}) {
  const workspace = useAccountWorkspace();
  const [unlinking, setUnlinking] = useState(false);
  const { refreshSession } = useWorkbenchAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const closeEditor = () => {
    setEditing(false);
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        ref={trigger}
        className="wt-header-login wt-account-trigger"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        title={name}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (panel.current) {
            panel.current.style.top = `${rect.bottom + 4}px`;
            panel.current.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
          }
        }}
      >
        <span>{name}</span>
        <svg
          className="wt-account-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m3 4.5 3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        className="wt-account-popover"
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        <p>{name}</p>
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => {
            panel.current?.hidePopover();
            setDraft(name);
            setError("");
            setEditing(true);
          }}
        >
          修改用户名
        </button>

        <button
          type="button"
          onClick={() => {
            panel.current?.hidePopover();
            workspace?.open();
          }}
        >
          云端数据 · {workspace?.status}
        </button>
        {workspace?.binding && (
          <button
            type="button"
            onClick={() => {
              panel.current?.hidePopover();
              setUnlinking(true);
            }}
          >
            解除游戏账号关联
          </button>
        )}

        <button
          disabled={busy || saving}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onLogout();
              panel.current?.hidePopover();
            } catch {
              setError("退出未完成，请重试。");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "正在退出…" : "退出登录"}
        </button>
        {error && !editing && <small role="alert">{error}</small>}
      </div>
      {unlinking && <UnlinkGameAccount close={() => setUnlinking(false)} />}
      {editing && (
        <Modal title="修改用户名" close={closeEditor} className="wt-username-dialog">
          <form
            className="wt-username-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              setSaving(true);
              setError("");
              try {
                await statsRequest("auth/profile", { displayName: draft.trim() });
                await refreshSession();
                notifyStatsAccountLogin();
                closeEditor();
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "保存失败，请重试。");
              } finally {
                setSaving(false);
              }
            }}
          >
            <label htmlFor={`${id}-username`}>用户名</label>
            <input
              ref={input}
              id={`${id}-username`}
              aria-describedby={`${id}-username-help ${id}-username-error`}
              autoComplete="username"
              minLength={2}
              maxLength={32}
              required
              value={draft}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
            />
            <small id={`${id}-username-help`}>
              2–32 个字符，支持 #、@、☆ 等可见符号；保存时检查重名和内容安全。
            </small>
            <p id={`${id}-username-error`} className="wt-username-error" role="alert">
              {error}
            </p>
            <div>
              <button className="wt-username-save" type="submit" disabled={saving}>
                {saving ? "正在保存…" : "保存"}
              </button>
              <button type="button" disabled={saving} onClick={closeEditor}>
                取消
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
