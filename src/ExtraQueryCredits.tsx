import { t, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useRef, useState, type MouseEvent } from "react";
import { Modal } from "./Modal";
import { statsAvailableRequests } from "./player-stats-api";
import type { StatsConfig, StatsSession } from "./player-stats-api";

/** Balances and conversion rates come from the current user's private session. */
export function ExtraQueryCredits({
  session,
  refresh,
  config,
}: {
  session: StatsSession;
  refresh: () => Promise<unknown>;
  config: StatsConfig | null;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const credits = session.credits;
  const balance = !credits
    ? "—"
    : !credits.enabled
      ? "0"
      : credits.total === null
        ? t("不限")
        : (credits.remaining?.toLocaleString(getLocale()) ?? "—");
  const freeLabel = (value: number | null | undefined) =>
    value === null
      ? t("不限次")
      : value === undefined
        ? "—"
        : t("{0} 次", [value.toLocaleString(getLocale())]);
  const available = (kind: "query" | "report") => freeLabel(statsAvailableRequests(session, kind));
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function explain(event: MouseEvent<HTMLButtonElement>) {
    trigger.current = event.currentTarget;
    setOpen(true);
    setRefreshing(true);
    setError(false);
    void refresh()
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }
  return (
    <div className="wt-extra-query-credits">
      <button
        className="wt-record-quota-button"
        type="button"
        onClick={explain}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {session.role === "superadmin" ? t("超管") : session.user ? t("普通用户") : t("匿名用户")}
        {t(" · 剩余查询 ")}
        {available("query")}
        {t(" / 战报 ")}
        {available("report")}
      </button>
      {(session.user || session.role === "superadmin") && (
        <button
          className="wt-extra-query-credit-button"
          type="button"
          onClick={explain}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{t("额外查询点")}</span>
          <strong>{balance}</strong>
          <span aria-hidden="true">ⓘ</span>
        </button>
      )}
      {open && (
        <Modal title={t("查询额度说明")} close={close} className="wt-query-credit-dialog">
          <h3>{t("每日免费次数")}</h3>
          <table className="wt-query-free-limits">
            <thead>
              <tr>
                <th scope="col">{t("用户角色")}</th>
                <th scope="col">{t("新查询")}</th>
                <th scope="col">{t("新战报")}</th>
                <th scope="col">{t("账号估值")}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["guest", t("匿名用户")],
                  ["user", t("普通用户")],
                ] as const
              ).map(([role, label]) => (
                <tr key={role}>
                  <th scope="row">{label}</th>
                  <td>{freeLabel(config?.settings.roleLimits?.[role]?.queryLimit)}</td>
                  <td>{freeLabel(config?.settings.roleLimits?.[role]?.reportLimit)}</td>
                  <td>{freeLabel(config?.settings.roleLimits?.[role]?.valuationLimit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{t("每日免费次数在北京时间零点重置，额外查询点不重置。")}</p>
          <h3>{t("额外查询点")}</h3>
          <p className="wt-query-credit-balance">
            {t("当前可用")}{" "}
            <strong>{session.user || session.role === "superadmin" ? balance : "0"}</strong>{" "}
            {t("点")}
          </p>
          {!session.user && session.role !== "superadmin" && (
            <p>{t("登录后可使用账号中的额外查询点。")}</p>
          )}
          <p>{t("先使用各项目的每日免费次数，耗尽后才消耗共享的额外查询点。")}</p>
          <dl className="wt-query-credit-rates" aria-label={t("额外查询点使用比例")}>
            <div>
              <dt>{t("新查询")}</dt>
              <dd>{t("{0} 点／次", [credits?.costs?.query ?? "—"])}</dd>
            </div>
            <div>
              <dt>{t("新战报")}</dt>
              <dd>{t("{0} 点／次", [credits?.costs?.report ?? "—"])}</dd>
            </div>
            <div>
              <dt>{t("账号估值")}</dt>
              <dd>{t("{0} 点／次", [credits?.costs?.valuation ?? "—"])}</dd>
            </div>
          </dl>
          <ul className="wt-query-credit-notes">
            <li>{t("额外查询点累计保留，不按日重置，三个项目共用同一余额。")}</li>
            <li>{t("缓存命中不扣免费次数，也不扣额外查询点。")}</li>
            <li>{t("处理中会预占点数；任务失败或取消后释放预占。")}</li>
            <li>{t("每日免费次数不限的项目，不消耗额外查询点。")}</li>
            <li>{t("每日免费次数和额外查询点均用完后，提示“今日额度已达上限”。")}</li>
          </ul>
          {!!credits?.reserved && (
            <p>
              {t("处理中预占 {0} 点，已从可用余额中扣除。", [
                credits.reserved.toLocaleString(getLocale()),
              ])}
            </p>
          )}
          <output className="wt-query-credit-status">
            {refreshing
              ? t("正在更新余额…")
              : error
                ? t("余额更新失败，当前显示上次读取结果，请关闭后重试。")
                : t("点数和使用比例以当前账号的服务器记录为准。")}
          </output>
        </Modal>
      )}
    </div>
  );
}
