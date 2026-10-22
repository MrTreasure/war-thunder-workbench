import { useId, useRef, useState } from "react";

export function StatsAccountMenu({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => Promise<void>;
}) {
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
        <button
          disabled={busy}
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
        {error && <small role="alert">{error}</small>}
      </div>
    </>
  );
}
