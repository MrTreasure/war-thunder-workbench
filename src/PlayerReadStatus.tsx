import { statsDate } from "./player-stats-api";

/** Supplementary failures stay with their controls while saved statistics remain visible. */
export function PlayerReadStatus({
  read,
  label,
  localOnly = false,
}: {
  read: {
    busy: boolean;
    error: string;
    data: { fetchedAt?: string | null } | null;
    retry: () => void;
  };
  label: string;
  localOnly?: boolean;
}) {
  const status = read.busy
    ? "正在读取…"
    : read.error
      ? "暂不可用"
      : read.data?.fetchedAt
        ? `采集于 ${statsDate(read.data.fetchedAt)}`
        : "基础战绩已可查看";
  return (
    <output className="wt-player-read-status" data-error={!!read.error || undefined}>
      {read.error && !localOnly ? (
        <button
          type="button"
          onClick={read.retry}
          disabled={read.busy}
          title={read.error}
          aria-label={`${label}暂不可用，重试。${read.error}`}
        >
          <span aria-hidden="true">↻</span> {label} · {status}
        </button>
      ) : (
        <span title={read.error || undefined}>
          {label} · {status}
        </span>
      )}
    </output>
  );
}
