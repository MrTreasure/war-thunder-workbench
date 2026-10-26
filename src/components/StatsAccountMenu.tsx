import { Chevron } from "./Chevron";
import { useAccountWorkspace } from "../workspace-context";
import { UnlinkGameAccount } from "../GameAccountBinding";
import { statsRequest, notifyStatsAccountLogin } from "../player-stats-api";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { Modal } from "../Modal";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { AccountAvatar } from "../AccountAvatar";
import type { AvatarOption } from "./AccountAvatarPicker";
const AccountAvatarPicker = lazy(() => import("./AccountAvatarPicker"));

export function StatsAccountMenu({
  name,
  onLogout,
  onHeyboxLink,
}: {
  name: string;
  onLogout: () => Promise<void>;
  onHeyboxLink: () => void;
}) {
  const workspace = useAccountWorkspace();
  const [unlinking, setUnlinking] = useState(false);
  const { session, refreshSession } = useWorkbenchAccount();
  const heyboxIdentity = session?.user?.linkedAccounts?.find(
    (identity) => identity.provider === "heybox",
  );
  const [avatarEditor, setAvatarEditor] = useState(false),
    [linkedAvatars, setLinkedAvatars] = useState<AvatarOption[]>([]),
    [avatarError, setAvatarError] = useState("");
  useEffect(() => {
    if (!avatarEditor) return;
    let live = true;
    void statsRequest<{ linked: AvatarOption[] }>("auth/avatars")
      .then((value) => {
        if (live) setLinkedAvatars(value.linked);
      })
      .catch((error) => {
        if (live) setAvatarError(error instanceof Error ? error.message : "关联头像暂不可用");
      });
    return () => {
      live = false;
    };
  }, [avatarEditor]);
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
        <AccountAvatar user={session?.user} />
        <span>{name}</span>
        <Chevron className="wt-account-chevron" />
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
          onClick={() => {
            panel.current?.hidePopover();
            setAvatarError("");
            setAvatarEditor(true);
          }}
        >
          修改头像
        </button>
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
          云端数据
        </button>
        <button
          type="button"
          onClick={() => {
            panel.current?.hidePopover();
            onHeyboxLink();
          }}
        >
          {heyboxIdentity ? "小黑盒 · 已关联" : "关联小黑盒账号"}
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
      {avatarEditor && (
        <Modal title="选择头像" close={() => setAvatarEditor(false)} className="wt-avatar-dialog">
          {avatarError && <p role="alert">{avatarError}</p>}
          <Suspense fallback={<p>正在准备头像…</p>}>
            <AccountAvatarPicker
              currentId={session?.user?.avatarId}
              linked={linkedAvatars}
              authenticated={!!session?.user?.id}
              onSelect={async (avatarId) => {
                await statsRequest("auth/avatar", { avatarId });
                await refreshSession();
                notifyStatsAccountLogin();
                setAvatarEditor(false);
              }}
            />
          </Suspense>
        </Modal>
      )}
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
