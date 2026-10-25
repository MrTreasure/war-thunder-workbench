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
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLButtonElement>(null);
  const credits = session.credits;
  const showCredits =
    !!credits?.enabled &&
    !!(session.user || session.role === "superadmin") &&
    (credits.total === null || (credits.remaining ?? 0) > 0);

  const balance = !credits
    ? "—"
    : !credits.enabled
      ? "0"
      : credits.total === null
        ? "不限"
        : (credits.remaining?.toLocaleString("zh-CN") ?? "—");
  const freeLabel = (value: number | null | undefined) =>
    value === null ? "不限次" : value === undefined ? "—" : `${value.toLocaleString("zh-CN")} 次`;
  const available = (kind: "query" | "report") => freeLabel(statsAvailableRequests(session, kind));
  function close() {
    setOpen(false);
    requestAnimationFrame(() =>
      (trigger.current?.isConnected ? trigger.current : summary.current)?.focus(),
    );
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
        ref={summary}
        type="button"
        onClick={explain}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {session.role === "superadmin" ? "超管" : session.user ? "普通用户" : "匿名用户"}
        {" · 剩余查询 "}
        {available("query")}
        {" / 战报 "}
        {available("report")}
      </button>
      {showCredits && (
        <button
          className="wt-extra-query-credit-button"
          type="button"
          onClick={explain}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          额外查询点 {balance}
        </button>
      )}
      {open && (
        <Modal title="查询额度说明" close={close} className="wt-query-credit-dialog">
          <h3>每日免费次数</h3>
          <table className="wt-query-free-limits">
            <thead>
              <tr>
                <th scope="col">用户角色</th>
                <th scope="col">新查询</th>
                <th scope="col">新战报</th>
                <th scope="col">账号估值</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["guest", "匿名用户"],
                  ["user", "普通用户"],
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
          <p>每日免费次数在北京时间零点重置。</p>
          {showCredits && (
            <>
              <h3>额外查询点</h3>
              <p className="wt-query-credit-balance">
                当前可用{" "}
                <strong>{session.user || session.role === "superadmin" ? balance : "0"}</strong> 点
              </p>

              <p>先使用各项目的每日免费次数，耗尽后才消耗共享的额外查询点。</p>
              <dl className="wt-query-credit-rates" aria-label="额外查询点使用比例">
                <div>
                  <dt>新查询</dt>
                  <dd>{credits?.costs?.query ?? "—"} 点／次</dd>
                </div>
                <div>
                  <dt>新战报</dt>
                  <dd>{credits?.costs?.report ?? "—"} 点／次</dd>
                </div>
                <div>
                  <dt>账号估值</dt>
                  <dd>{credits?.costs?.valuation ?? "—"} 点／次</dd>
                </div>
              </dl>
              <ul className="wt-query-credit-notes">
                <li>额外查询点累计保留，不按日重置，三个项目共用同一余额。</li>
                <li>缓存命中不扣免费次数，也不扣额外查询点。</li>
                <li>处理中会预占点数；任务失败或取消后释放预占。</li>
                <li>每日免费次数不限的项目，不消耗额外查询点。</li>
                <li>每日免费次数和额外查询点均用完后，提示“今日额度已达上限”。</li>
              </ul>
              {!!credits?.reserved && (
                <p>
                  处理中预占 {credits.reserved.toLocaleString("zh-CN")} 点，已从可用余额中扣除。
                </p>
              )}
              <output className="wt-query-credit-status">
                {refreshing
                  ? "正在更新余额…"
                  : error
                    ? "余额更新失败，当前显示上次读取结果，请关闭后重试。"
                    : "点数和使用比例以当前账号的服务器记录为准。"}
              </output>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
