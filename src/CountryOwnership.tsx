import { t, localize } from "./i18n/core";

import { useLocale } from "./i18n/react";
import { useEffect, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { GameTip } from "./components/GameTip";
import { PlayerReadStatus } from "./PlayerReadStatus";
import {
  statsRequest,
  statsDate,
  statsNumber as num,
  statsGoldenEaglesIcon,
  statsCategoryNames,
} from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
type Counter = {
  researchable: number | null;
  researchOwned: number;
  researchElite: number;
};
type OwnershipData = {
  uid: string;
  snapshotId: string;
  fetchedAt: string;
  researchCheckedAt: string;
  countries: {
    id: string;
    name: string;
    flag: string;
    unclassified: number;
    categories: Record<string, Counter>;
  }[];
};
function allCategories(categories: Record<string, Counter>): Counter | null {
  const counters = Object.entries(categories)
    .filter(([id]) => Object.hasOwn(statsCategoryNames, id))
    .map(([, value]) => value);
  if (!counters.length) return null;
  return {
    researchOwned: counters.reduce((n, c) => n + c.researchOwned, 0),
    researchElite: counters.reduce((n, c) => n + c.researchElite, 0),
    researchable: counters.some((c) => c.researchable == null)
      ? null
      : counters.reduce((n, c) => n + c.researchable!, 0),
  };
}
export function CountryOwnership({ profile }: { profile: PlayerProfile }) {
  useLocale();

  const [category, setCategory] = useState("all");
  const [data, setData] = useState<OwnershipData | null>(null);
  const [busy, setBusy] = useState(!profile.localOnly),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (profile.localOnly || data) return;
    const c = new AbortController();
    void statsRequest<OwnershipData>(
      `players/${encodeURIComponent(profile.snapshotId)}/ownership`,
      undefined,
      c.signal,
    )
      .then((value) => {
        if (c.signal.aborted) return;
        if (
          value.uid !== profile.uid ||
          value.snapshotId !== profile.snapshotId ||
          !Array.isArray(value.countries)
        )
          throw Error(t("军种统计身份校验失败，请刷新玩家资料。"));
        setData(value);
      })
      .catch((failure) => {
        if (!c.signal.aborted)
          setError(failure instanceof Error ? failure.message : t("暂时无法读取完整军种统计。"));
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [data, profile.uid, profile.snapshotId, profile.localOnly, retry]);
  const reload = () => {
    setBusy(true);
    setError("");
    setRetry((v) => v + 1);
  };
  const countries = data?.countries || profile.countries;
  return (
    <section className="wt-record-panel wt-record-country-panel">
      <div className="wt-record-heading wt-country-heading">
        <h2>
          {t("各国拥有载具")}
          <GameTip label={t("各国拥有载具")}>
            <p>
              {t(
                "已研发与精英均以当前常规科技树可研发总数为分母；包含未出战载具，金鹰、礼包及其他特种载具不计入进度与毕业。组合载具按一个项目计数。",
              )}
            </p>
            <p>
              {t("全部军种合计陆军、空军、直升机、海军与近海舰队。未知数量显示“—”，不视为零。")}
            </p>
            {localize(
              data && (
                <p>
                  {t("完整车库")}
                  {localize(statsDate(data.fetchedAt))}
                  {t("· 可研发目录")}
                  {localize(" ")}
                  {localize(statsDate(data.researchCheckedAt))}
                </p>
              ),
            )}
          </GameTip>
        </h2>
        <GameSelect
          disabled={profile.localOnly}
          aria-label={t("各国拥有载具军种")}
          value={category}
          onValueChange={setCategory}
        >
          <option value="all">{t("全部军种")}</option>
          {localize(
            Object.entries(statsCategoryNames).map(([id, name]) => (
              <option key={id} value={id}>
                {localize(name)}
              </option>
            )),
          )}
        </GameSelect>
        <span>{t("已研发 / 总数 · 精英 / 总数")}</span>
        {localize(
          (busy || error) && (
            <PlayerReadStatus
              read={{ data, busy, error, retry: reload }}
              label={t("车库统计")}
              localOnly={profile.localOnly}
            />
          ),
        )}
      </div>
      <div className="wt-record-countries wt-country-breakdown">
        {localize(
          countries.map((country) => {
            const source = data?.countries.find((c) => c.id === country.id);
            const count = source
              ? category === "all"
                ? allCategories(source.categories)
                : source.categories[category]
              : null;
            const graduated =
              !!count &&
              count.researchable != null &&
              count.researchable > 0 &&
              count.researchOwned >= count.researchable;
            return (
              <div key={country.id}>
                <img className="wt-record-country-flag" src={country.flag} alt="" />
                <span className="wt-country-name">
                  {localize(country.name)}
                  {localize(
                    graduated && (
                      <b
                        className="wt-country-graduated"
                        title={t(
                          "当前常规科技树可研发载具已全部拥有；礼包、金鹰和其他特种载具不参与毕业判定。",
                        )}
                      >
                        {t("毕业")}
                      </b>
                    ),
                  )}
                </span>
                <span className="wt-country-owned-count">
                  <b>{localize(num(count?.researchOwned))}</b>
                  <small> / {localize(num(count?.researchable))}</small>
                </span>
                <small className="wt-country-elite">
                  <img src={statsGoldenEaglesIcon} alt="" />
                  <span>{t("精英")}</span>
                  <strong>{localize(num(count?.researchElite))}</strong>
                  <span className="wt-country-elite-total">
                    {" "}
                    / {localize(num(count?.researchable))}
                  </span>
                </small>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
