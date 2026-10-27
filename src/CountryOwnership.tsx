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
  premiumOwned?: number | null;
  premiumTotal?: number | null;
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
    premiumOwned: counters.some((c) => c.premiumOwned == null)
      ? null
      : counters.reduce((n, c) => n + c.premiumOwned!, 0),
    premiumTotal: counters.some((c) => c.premiumTotal == null)
      ? null
      : counters.reduce((n, c) => n + c.premiumTotal!, 0),
    researchOwned: counters.reduce((n, c) => n + c.researchOwned, 0),
    researchElite: counters.reduce((n, c) => n + c.researchElite, 0),
    researchable: counters.some((c) => c.researchable == null)
      ? null
      : counters.reduce((n, c) => n + c.researchable!, 0),
  };
}
export function CountryOwnership({ profile }: { profile: PlayerProfile }) {
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
          throw Error("军种统计身份校验失败，请刷新玩家资料。");
        setData(value);
      })
      .catch((failure) => {
        if (!c.signal.aborted)
          setError(failure instanceof Error ? failure.message : "暂时无法读取完整军种统计。");
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
          各国拥有载具
          <GameTip label="各国拥有载具">
            <p>
              常规载具展示已拥有 /
              当前可研发总数；高级载具单独统计金鹰、礼包及目录中其他高级载具的已拥有 /
              收录总数。高级载具不参与常规科技树毕业判定；完全体状态不等于高级载具。包含未出战载具，组合载具去重计数。
            </p>
            <p>全部军种合计陆军、空军、直升机、海军与近海舰队。未知数量显示“—”，不视为零。</p>
            {data && (
              <p>
                完整车库 {statsDate(data.fetchedAt)} · 可研发目录{" "}
                {statsDate(data.researchCheckedAt)}
              </p>
            )}
          </GameTip>
        </h2>
        <GameSelect
          disabled={profile.localOnly}
          aria-label="各国拥有载具军种"
          value={category}
          onValueChange={setCategory}
        >
          <option value="all">全部军种</option>
          {Object.entries(statsCategoryNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>

        {(busy || error) && (
          <PlayerReadStatus
            read={{ data, busy, error, retry: reload }}
            label="车库统计"
            localOnly={profile.localOnly}
          />
        )}
      </div>
      <div className="wt-ownership-legend" aria-hidden="true">
        <span>常规载具 · 已拥有 / 总数</span>
        <span>高级载具 · 已拥有 / 总数</span>
      </div>
      <div className="wt-record-countries wt-country-breakdown">
        {countries.map((country) => {
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
                {country.name}
                {graduated && (
                  <b
                    className="wt-country-graduated"
                    title="当前常规科技树可研发载具已全部拥有；礼包、金鹰和其他特种载具不参与毕业判定。"
                  >
                    毕业
                  </b>
                )}
              </span>
              <span className="wt-country-owned-count" aria-label="常规载具">
                <b>{num(count?.researchOwned)}</b>
                <small> / {num(count?.researchable)}</small>
              </span>
              <small className="wt-country-elite" aria-label="高级载具">
                <img src={statsGoldenEaglesIcon} alt="" />
                <strong>{num(count?.premiumOwned)}</strong>
                <span className="wt-country-elite-total"> / {num(count?.premiumTotal)}</span>
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
