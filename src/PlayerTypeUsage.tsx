import { useLocale } from "./i18n/react";
import { t, localize, getLocale } from "./i18n/core";
import { PlayerReadStatus } from "./PlayerReadStatus";
import { GameTip } from "./components/GameTip";
import { useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { statsDate, statsNumber as num } from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
import { usePlayerRead } from "./player-rankings-api";
import type { PlayerDetails } from "./player-rankings-api";

export function PlayerTypeUsage({
  profile,
  mode,
  active,
}: {
  profile: PlayerProfile;
  mode: string;
  active: boolean;
}) {
  useLocale();
  const read = usePlayerRead<PlayerDetails>(profile, "details", active);
  const [group, setGroup] = useState("pvp_played"),
    [expanded, setExpanded] = useState(false);
  const groups = read.data?.usage.filter((value) => value.mode === mode) || [];
  const selected = groups.find((value) => value.id === group) || groups[0];
  const roles = [...(selected?.roles || [])].sort((a, b) => b.seconds - a.seconds);
  const total = roles.reduce((sum, role) => sum + role.seconds, 0);
  const maximum = Math.max(1, ...roles.map((role) => role.seconds));
  const hours = (seconds: number) =>
    (seconds / 3600).toLocaleString(getLocale(), { maximumFractionDigits: 1 });
  const longest = roles[0];
  const hasSorties = roles.some((role) => role.sorties != null),
    hasAir = roles.some((role) => role.airKills != null);
  const hasGround = roles.some((role) => role.groundKills != null),
    hasNaval = roles.some((role) => (role.navalKills || 0) > 0);
  return (
    <section className="wt-record-panel wt-type-usage">
      <header className="wt-type-heading">
        <div>
          <h2>
            {t("载具类型与游玩时长")}
            <GameTip label={t("载具类型与游玩时长")}>
              {t(
                "分类使用时长不含排队时间；占比以已返回分类的时长合计为基数，玩法场次不可按载具类型相加。未返回的数据记为“—”。",
              )}
              {localize(
                read.data && (
                  <span>
                    {t("采集于")}
                    {localize(statsDate(read.data.fetchedAt))}
                  </span>
                ),
              )}
            </GameTip>
          </h2>
        </div>
        {localize(
          groups.length > 0 && (
            <GameSelect
              aria-label={t("分类统计玩法")}
              value={selected?.id || "pvp_played"}
              onValueChange={(value) => {
                setGroup(value);
                setExpanded(false);
              }}
            >
              {localize(
                groups.map((value) => (
                  <option value={value.id} key={value.id}>
                    {localize(value.label)}
                  </option>
                )),
              )}
            </GameSelect>
          ),
        )}
        {localize(
          (read.busy || read.error) && (
            <PlayerReadStatus read={read} label={t("分类统计")} localOnly={profile.localOnly} />
          ),
        )}
      </header>
      {localize(
        read.busy && !read.data && (
          <output className="wt-rank-loading">{t("正在补充分类统计…")}</output>
        ),
      )}
      {localize(
        roles.length > 0 ? (
          <>
            <div className="wt-type-summary">
              <span>
                {t("已记录时长")}
                {localize(" ")}
                <b>
                  {localize(hours(total))} <small>{t("小时")}</small>
                </b>
              </span>
              <span>
                {t("常用类型")}
                <b>{localize(longest.label)}</b>
              </span>
              <span>
                {t("玩法场次")}
                <b>{localize(num(selected?.battles))}</b>
              </span>
              <span>
                {t("胜场")}
                <b>{localize(num(selected?.wins))}</b>
              </span>
            </div>
            <div className="wt-type-table-scroll">
              <table className="wt-type-table">
                <thead>
                  <tr>
                    <th scope="col">{t("载具类型")}</th>
                    <th scope="col">{t("游玩时长")}</th>
                    <th scope="col">{t("时长占比")}</th>
                    {localize(hasSorties && <th scope="col">{t("出击")}</th>)}
                    {localize(hasAir && <th scope="col">{t("对空击毁")}</th>)}
                    {localize(hasGround && <th scope="col">{t("对地击毁")}</th>)}
                    {localize(hasNaval && <th scope="col">{t("对海击毁")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {localize(
                    (expanded ? roles : roles.slice(0, 8)).map((role) => (
                      <tr key={role.id}>
                        <th scope="row">{localize(role.label)}</th>
                        <td
                          aria-label={t("{0} {1} 小时", [
                            localize(role.label),
                            localize(hours(role.seconds)),
                          ])}
                        >
                          <div className="wt-type-duration">
                            <span>
                              {localize(hours(role.seconds))} <small>{t("小时")}</small>
                            </span>
                            <div aria-hidden="true">
                              <i style={{ width: `${(role.seconds / maximum) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td>{localize(((role.seconds / total) * 100).toFixed(1))}%</td>
                        {localize(hasSorties && <td>{localize(num(role.sorties))}</td>)}
                        {localize(hasAir && <td>{localize(num(role.airKills))}</td>)}
                        {localize(hasGround && <td>{localize(num(role.groundKills))}</td>)}
                        {localize(hasNaval && <td>{localize(num(role.navalKills))}</td>)}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            {localize(
              roles.length > 8 && (
                <button
                  className="wt-record-link wt-type-expand"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {localize(
                    expanded ? t("收起分类") : t("展开全部 {0} 类", [localize(roles.length)]),
                  )}
                </button>
              ),
            )}
          </>
        ) : (
          !read.busy && !read.error && (
            <p className="wt-record-fine">{t("此模式暂无已核实的分类游玩记录。")}</p>
          )
        ),
      )}
    </section>
  );
}
