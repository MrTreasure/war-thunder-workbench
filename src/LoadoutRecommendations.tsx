import { useEffect, useState } from "react";
import type { Vehicle } from "./models";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import { loadoutRevision } from "./loadouts";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { LoadoutPresets } from "./LoadoutPresets";
import "./loadouts.css";
export function LoadoutRecommendations({ unit, country }: { unit: Vehicle; country: string }) {
  const [items, setItems] = useState<LoadoutShare[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const data = unit.wikiDetails?.loadouts;
  useEffect(() => {
    const controller = new AbortController();
    void loadoutRequest<{ items: LoadoutShare[] }>(
      `recommendations?country=${encodeURIComponent(country)}&vehicle=${encodeURIComponent(unit.id)}`,
      undefined,
      controller.signal,
    )
      .then(
        (value) => {
          if (!controller.signal.aborted) setItems(value.items);
        },
        (e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "推荐方案读取失败。");
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, unit.id, revision]);
  if (!data) return null;
  return (
    <section className="wt-mount-recommendations">
      <div className="wt-mount-section-heading">
        <h3>挂载推荐</h3>
        <a
          className="quiet-button"
          href={`#/loadouts?country=${country}&vehicle=${encodeURIComponent(unit.id)}`}
        >
          模拟挂载
        </a>
      </div>
      <LoadoutPresets data={data} />
      <h3>玩家分享</h3>
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
              meta={`资料 ${item.plan.sourceDate.slice(0, 10)}`}
            >
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
    </section>
  );
}
