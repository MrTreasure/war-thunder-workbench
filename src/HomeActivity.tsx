import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { statsQueryHistory } from "./player-stats-api";
import { homeQueryQuota, homeRecentQueries } from "./home-activity-model";
import { GameIcon } from "./components/GameIcon";
import { PlayerAvatar } from "./PlayerAvatar";
import { Modal } from "./Modal";
import "./home-activity.css";

/** Uses the existing browser history; record access is rechecked by the stats restore route. */
export function HomeActivity() {
  useLocale();
  const { session, initializing, identityVersion } = useWorkbenchAccount();
  return (
    <HomeActivityContent
      key={`${identityVersion}:${session?.user?.id || "guest"}`}
      initializing={initializing}
    />
  );
}
function HomeActivityContent({ initializing }: { initializing: boolean }) {
  useLocale();
  const { session } = useWorkbenchAccount();
  const [history, setHistory] = useState(statsQueryHistory);
  const [quotaOpen, setQuotaOpen] = useState(false);
  useEffect(() => {
    const read = () => setHistory(statsQueryHistory());
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);
  const recent = homeRecentQueries(history);
  const quota = homeQueryQuota(session);
  const showCredits =
    quota?.creditsEnabled && (quota.creditRemaining === null || (quota.creditRemaining ?? 0) > 0);
  return (
    <div className="wt-home-activity">
      <section className="wt-home-section" aria-labelledby="wt-home-recent-title">
        <header>
          <h3 id="wt-home-recent-title">
            <GameIcon name="details" />
            {t("本机最近战绩")}
          </h3>
          <Link to="/stats" search={{}} preload={false}>
            {t("战绩查询 →")}
          </Link>
        </header>
        {localize(
          initializing ? (
            <p className="wt-home-empty">{t("正在恢复账号…")}</p>
          ) : recent.length ? (
            <ul>
              {localize(
                recent.map((item) => (
                  <li key={item.uid}>
                    <PlayerAvatar
                      url={item.avatar}
                      name={item.nickname}
                      frameKey={item.avatarFrameKey}
                    />
                    <div className="wt-home-recent-identity">
                      <strong>{localize(item.nickname)}</strong>
                      <span>
                        UID {localize(item.uid)} ·{localize(" ")}
                        {localize(
                          item.collectedAt
                            ? `采集于 ${new Date(item.collectedAt).toLocaleString(getLocale())}`
                            : "采集时间未知",
                        )}
                      </span>
                    </div>
                    <Link to="/stats" search={item.restore || {}} preload={false}>
                      {localize(item.restore ? "查看详情" : "前往查询")}
                    </Link>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="wt-home-empty">
              {t("本机还没有保存的查询记录。前往战绩查询，查询后可在这里继续查看。")}
            </p>
          ),
        )}
        <p className="wt-home-activity-note">
          {t("最多展示本机最近4条记录；查看已有记录不发起新查询，记录失效后请手动查询。")}
        </p>
      </section>
      <section className="wt-home-section" aria-labelledby="wt-home-quota-title">
        <header>
          <h3 id="wt-home-quota-title">
            <GameIcon name="crew" />
            {t("查询额度")}
          </h3>
        </header>
        <div className="wt-home-activity-balances">
          <button
            type="button"
            className="wt-home-activity-quota"
            disabled={!quota || initializing}
            onClick={() => setQuotaOpen(true)}
          >
            <span>{t("今日免费查询")}</span>
            <strong>
              {localize(
                initializing || !quota
                  ? "读取中…"
                  : quota.dailyRemaining === null
                    ? "不限次数"
                    : `剩余 ${quota.dailyRemaining} 次`,
              )}
            </strong>
          </button>
          {localize(
            showCredits && (
              <button
                type="button"
                className="wt-home-activity-quota"
                onClick={() => setQuotaOpen(true)}
              >
                <span>{t("累计通用查询点")}</span>
                <strong>
                  {localize(
                    quota.creditRemaining === null ? "不限点数" : `${quota.creditRemaining} 点`,
                  )}
                </strong>
              </button>
            ),
          )}
        </div>
        <p className="wt-home-activity-note">
          {t("每日免费次数按北京时间恢复。通用查询点累计保留，不按日刷新；先使用免费次数。")}
        </p>
        <div className="wt-home-activity-rewards">
          <strong>{t("绑定奖励")}</strong>
          <p>{t("绑定小黑盒账号，增加20点通用查询点；绑定游戏角色账号，增加10点通用查询点。")}</p>
          <p>{t("绑定奖励一次性发放，解绑重绑不重复领取。是否到账以当前账号实际余额为准。")}</p>
          <p>{t("小黑盒绑定请打开右上角账号菜单；游戏角色绑定请在对应玩家战绩页操作。")}</p>
        </div>
      </section>
      {localize(
        quotaOpen && quota && session && (
          <Modal title={t("查询额度说明")} close={() => setQuotaOpen(false)}>
            <div className="wt-home-activity-explanation">
              <h3>{t("每日免费查询")}</h3>
              <p>
                {localize(
                  quota.dailyLimit === null
                    ? "当前身份不限免费查询次数。"
                    : `今日免费上限 ${quota.dailyLimit} 次，已用 ${session.query.used} 次，处理中预占 ${session.query.reserved} 次。`,
                )}
                {localize(" ")}
                {t("每日按北京时间恢复，缓存命中不消耗新查询次数。")}
              </p>
              {localize(
                showCredits && (
                  <>
                    <h3>{t("累计通用查询点")}</h3>
                    <p>
                      {localize(
                        quota.creditRemaining === null
                          ? "当前账号通用点数不限。"
                          : `当前可用 ${quota.creditRemaining} 点，已用 ${session.credits?.used ?? 0} 点，处理中预占 ${session.credits?.reserved ?? 0} 点。`,
                      )}
                      {localize(" ")}
                      {t("该余额累计保留，不每日重置。")}
                    </p>
                    {localize(
                      quota.queryCost != null && quota.queryCost > 0 && (
                        <p>
                          {t("免费次数用完后，每次新查询消耗")}
                          {localize(quota.queryCost)}
                          {localize(" ")}
                          {t("点。战报、估值等功能按当前服务端规则共用通用点数。")}
                        </p>
                      ),
                    )}
                  </>
                ),
              )}
              <p>{t("绑定小黑盒奖励20点，绑定游戏角色奖励10点；奖励说明不代表当前账号已领取。")}</p>
            </div>
          </Modal>
        ),
      )}
    </div>
  );
}
