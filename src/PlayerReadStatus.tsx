import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
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
  useLocale();
  const status = read.busy
    ? t("正在读取…")
    : read.error
      ? t("暂不可用")
      : read.data?.fetchedAt
        ? t("采集于 {0}", [localize(statsDate(read.data.fetchedAt))])
        : t("基础战绩已可查看");
  return (
    <output className="wt-player-read-status" data-error={!!read.error || undefined}>
      {localize(
        read.error && !localOnly ? (
          <button
            type="button"
            onClick={read.retry}
            disabled={read.busy}
            title={read.error}
            aria-label={t("{0}暂不可用，重试。{1}", [localize(label), localize(read.error)])}
          >
            <span aria-hidden="true">↻</span> {localize(label)} · {localize(status)}
          </button>
        ) : (
          <span title={read.error || undefined}>
            {localize(label)} · {localize(status)}
          </span>
        ),
      )}
    </output>
  );
}
