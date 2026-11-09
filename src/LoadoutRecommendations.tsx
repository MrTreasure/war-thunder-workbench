// Request state follows the current filters and account identity.
/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from "react";
import type { Vehicle } from "./models";
import { assertQualitySort, qualityExplanation, qualitySummary } from "./hall-quality";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import { loadoutRevision } from "./loadouts";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { GameSelect } from "./components/GameSelect";
import { LoadoutPresets } from "./LoadoutPresets";
import "./loadouts.css";
import { LoadoutVoteButtons } from "./LoadoutVoteButtons";
import { useWorkbenchAccount } from "./WorkbenchAccount";
export function LoadoutRecommendations({ unit, country }: { unit: Vehicle; country: string }) {
  const account = useWorkbenchAccount();
  return (
    <LoadoutRecommendationsView
      key={`${account.session?.user?.id || "guest"}:${account.identityVersion}:${country}:${unit.id}`}
      unit={unit}
      country={country}
    />
  );
}
function LoadoutRecommendationsView({ unit, country }: { unit: Vehicle; country: string }) {
  const [items, setItems] = useState<LoadoutShare[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [sort, setSort] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const data = unit.wikiDetails?.loadouts;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    void loadoutRequest<{ items: LoadoutShare[]; sort?: string; hasMore?: boolean }>(
      `recommendations?country=${encodeURIComponent(country)}&vehicle=${encodeURIComponent(unit.id)}&sort=${sort}&offset=${offset}`,
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          assertQualitySort(value.items, sort, value.sort);
          setItems(value.items);
          setHasMore(value.hasMore ?? value.items.length === 24);
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "推荐方案读取失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, unit.id, revision, sort, offset]);
  if (!data) return null;
  return (
    <section className="wt-mount-recommendations">
      <div className="wt-mount-section-heading">
        <h3>挂载推荐</h3>
        <a
          className="quiet-button"
          href={`#/loadouts?country=${country}&vehicle=${encodeURIComponent(unit.id)}&sort=${sort}&offset=${offset}`}
        >
          模拟挂载
        </a>
      </div>
      <LoadoutPresets data={data} />
      <h3>玩家分享</h3>
      <GameSelect
        aria-label="推荐排序"
        value={sort}
        onValueChange={(value) => {
          setSort(value);
          setOffset(0);
        }}
      >
        <option value="">最新发布</option>
        <option value="quality-v1">质量排序</option>
        <option value="popular">最多推荐</option>
      </GameSelect>
      {sort === "quality-v1" && <p className="calc-note">{qualityExplanation}</p>}
      {loading && <p aria-live="polite">正在读取分享方案…</p>}
      {error && (
        <p role="alert">
          {error}
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              setRevision((n) => n + 1);
            }}
          >
            重试
          </button>
        </p>
      )}
      {!loading && !error && !items.length && (
        <p>暂时没有该机型的玩家分享。配置后可将方案发布到这里。</p>
      )}
      <div className="wt-mount-recommendation-list">
        {items.map((item) => {
          return (
            <LoadoutPlanCard
              key={item.id}
              title={item.plan.name}
              preview={item.preview}
              tags={item.tags}
              meta={`资料 ${item.plan.sourceDate?.slice(0, 10) || "未知"} · ${qualitySummary(item.quality, item.up, item.down)}`}
            >
              <LoadoutVoteButtons
                item={item}
                onChange={() => {
                  setOffset(0);
                  setRevision((v) => v + 1);
                }}
              />
              {!item.preview?.sourceChanged && item.plan.sourceHash !== loadoutRevision(data) && (
                <p className="wt-mount-warning">来源版本已更新，打开后需重新核对。</p>
              )}
              <a className="quiet-button" href={`#/loadouts?recommendation=${item.id}`}>
                查看并使用
              </a>
            </LoadoutPlanCard>
          );
        })}
      </div>
      <div className="wt-mount-pagination">
        <button disabled={!offset || loading} onClick={() => setOffset((n) => Math.max(0, n - 24))}>
          上一页
        </button>
        <button disabled={!hasMore || loading} onClick={() => setOffset((n) => n + 24)}>
          下一页
        </button>
      </div>
    </section>
  );
}
