export function RefreshTextAction({
  busy,
  disabled,
  refresh,
  label,
  busyLabel,
  title,
  highlighted = false,
}: {
  busy: boolean;
  disabled: boolean;
  refresh: () => void;
  label: string;
  busyLabel: string;
  title: string;
  highlighted?: boolean;
}) {
  return (
    <span className="wt-record-refresh-action">
      <button
        type="button"
        className="wt-record-player-refresh"
        data-expired={highlighted || undefined}
        aria-busy={busy}
        title={title}
        disabled={disabled}
        onClick={refresh}
      >
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            d="M16.5 7A7 7 0 1 0 17 11M16.5 2.5V7H12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span aria-live="polite">{busy ? busyLabel : label}</span>
      </button>
    </span>
  );
}
