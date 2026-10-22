import { useEffect, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import {
  statsRequest,
  statsDate,
  statsNumber as num,
  statsGoldenEaglesIcon,
  statsCategoryNames,
} from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
type Counter = {
  owned: number | null;
  elite: number | null;
  knownOwned: number;
  knownElite: number;
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
export function CountryOwnership({ profile }: { profile: PlayerProfile }) {
  const [category, setCategory] = useState("all");
  const [data, setData] = useState<OwnershipData | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const needsBreakdown = category !== "all";
  useEffect(() => {
    if (!needsBreakdown || data) return;
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
        setBusy(false);
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
  }, [needsBreakdown, data, profile.uid, profile.snapshotId, retry]);
  return (
    <section className="wt-record-panel wt-record-country-panel">
      <div className="wt-record-heading wt-country-heading">
        <h2>各国拥有载具</h2>
        <GameSelect
          disabled={profile.localOnly}
          aria-label="各国拥有载具军种"
          value={category}
          onValueChange={(selected) => {
            setCategory(selected);
            if (selected === "all") {
              setBusy(false);
              setError("");
            } else if (!data && !busy) {
              setBusy(true);
              setError("");
              setRetry((v) => v + 1);
            }
          }}
        >
          <option value="all">全部军种</option>
          {Object.entries(statsCategoryNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>
        <span>{needsBreakdown ? "已研发 / 可研发 · 精英" : "拥有 / 精英 · 官方公开数量"}</span>
      </div>
      {!needsBreakdown ? (
        <div className="wt-record-countries">
          {profile.countries
            .filter((c) => c.owned != null && c.owned > 0)
            .map((c) => (
              <div key={c.id}>
                <img className="wt-record-country-flag" src={c.flag} alt="" />
                <span>{c.name}</span>
                <b>{num(c.owned)}</b>
                <small className="wt-country-elite" title={`精英载具 ${num(c.elite)} 辆`}>
                  <img src={statsGoldenEaglesIcon} alt="" />
                  <span>精英</span>
                  <strong>{num(c.elite)}</strong>
                </small>
              </div>
            ))}
        </div>
      ) : (
        <>
          {busy && !data && (
            <output className="wt-record-fine wt-country-loading">
              正在读取完整车库军种统计，包含未出战载具…
            </output>
          )}
          {error && (
            <output className="wt-country-error">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setBusy(true);
                  setError("");
                  setRetry((v) => v + 1);
                }}
              >
                重试统计
              </button>
            </output>
          )}
          {data && (
            <>
              <div className="wt-record-countries wt-country-breakdown">
                {data.countries.map((c) => {
                  const count = c.categories[category];
                  if (!count) return null;
                  const graduated =
                    count.researchable != null &&
                    count.researchable > 0 &&
                    count.researchOwned >= count.researchable;
                  return (
                    <div key={c.id}>
                      <img className="wt-record-country-flag" src={c.flag} alt="" />
                      <span className="wt-country-name">
                        {c.name}
                        {graduated && (
                          <b
                            className="wt-country-graduated"
                            title="当前常规科技树可研发载具已全部拥有；礼包、金鹰和其他特种载具不参与毕业判定。"
                          >
                            毕业
                          </b>
                        )}
                      </span>
                      <span
                        className="wt-country-owned-count"
                        title={`常规研发已拥有 ${num(count.researchOwned)} 辆；军种总拥有 ${count.owned == null ? "至少 " + num(count.knownOwned) : num(count.owned)} 辆；${count.researchable == null ? "暂无常规科技树" : "可研发 " + num(count.researchable) + " 辆"}`}
                      >
                        <b>{num(count.researchOwned)}</b>
                        <small>
                          {" "}
                          / {count.researchable == null ? "—" : num(count.researchable)}
                        </small>
                      </span>
                      <small
                        className="wt-country-elite"
                        title={`常规可研发载具中的精英 ${num(count.researchElite)} 辆`}
                      >
                        <img src={statsGoldenEaglesIcon} alt="" />
                        <span>精英</span>
                        <strong>{num(count.researchElite)}</strong>
                      </small>
                    </div>
                  );
                })}
              </div>
              <p className="wt-record-fine">
                仅统计当前常规科技树已拥有载具，包含未出战载具；金鹰、礼包及其他特种载具不计入进度与毕业。组合载具按一个项目计数。
              </p>
              <p className="wt-record-fine">
                完整车库 {statsDate(data.fetchedAt)} · 可研发目录{" "}
                {statsDate(data.researchCheckedAt)}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
