import { useLocale } from "../i18n/react";
import { localize, t } from "../i18n/core";
import { statsRequest, notifyStatsAccountLogin } from "../player-stats-api";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import { useId, useRef, useState } from "react";

export function StatsAccountMenu({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => Promise<void>;
}) {
  useLocale();

  const { refreshSession } = useWorkbenchAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
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
        {editing ? (
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
                setEditing(false);
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : t("保存失败，请重试。"));
              } finally {
                setSaving(false);
              }
            }}
          >
            <label htmlFor={`${id}-username`}>{t("用户名")}</label>
            <input
              id={`${id}-username`}
              autoComplete="username"
              minLength={2}
              maxLength={32}
              required
              value={draft}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
            />
            <small>{t("2–32 个字符，保存时检查重名和内容安全。")}</small>
            <div>
              <button type="submit" disabled={saving}>
                {saving ? t("正在保存…") : t("保存")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
              >
                {t("取消")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(name);
              setEditing(true);
              setError("");
            }}
          >
            {t("修改用户名")}
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
          {localize(busy ? "正在退出…" : "退出登录")}
        </button>
        {localize(error && <small role="alert">{localize(error)}</small>)}
      </div>
    </>
  );
}
