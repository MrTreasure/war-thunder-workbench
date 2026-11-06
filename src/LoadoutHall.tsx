import { useEffect, useState } from "react";
import bootstrap from "./generated/bootstrap.json";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import type { LoadoutPlan } from "./loadouts";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { GameSelect } from "./components/GameSelect";
import { LoadoutVoteButtons } from "./LoadoutVoteButtons";
import { useWorkbenchAccount } from "./WorkbenchAccount";
export function LoadoutHall({ onUse }: { onUse: (plan: LoadoutPlan) => void }) {
  const account = useWorkbenchAccount();
  const viewerId = account.session?.user?.id || "";
  const [items, setItems] = useState<LoadoutShare[]>([]),
    [country, setCountry] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadoutRequest<{ items: LoadoutShare[] }>(
      `recommendations?country=${country}&offset=${offset}`,
      undefined,
      controller.signal,
    )
      .then(
        (value) => {
          if (!controller.signal.aborted) setItems(value.items);
        },
        (e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "大厅读取失败。");
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, offset, revision, viewerId]);
  const nation = (value: string) =>
    value ? (
      <span className="wt-mount-country">
        <img
          src={bootstrap.flags[value as keyof typeof bootstrap.flags]}
          alt=""
          width={24}
          height={18}
        />
        {bootstrap.countries[value as keyof typeof bootstrap.countries]}
      </span>
    ) : null;
  return (
    <section className="wt-mount-hall">
      <div className="wt-mount-section-heading">
        <h3>挂载大厅</h3>
        <GameSelect
          aria-label="国家筛选"
          value={country}
          renderOption={nation}
          renderValue={nation}
          onValueChange={(value) => {
            setLoading(true);
            setError("");
            setCountry(value);
            setOffset(0);
          }}
        >
          <option value="">全部国家</option>
          {Object.entries(bootstrap.countries).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>
      </div>
      {loading && <p aria-live="polite">正在读取大厅…</p>}
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
        <p className="wt-mount-empty">暂无挂载推荐。保存配置后，可打上用途标签并发布到大厅。</p>
      )}
      <div className="wt-mount-recommendation-list">
        {items.map((item) => (
          <LoadoutPlanCard
            key={item.id}
            title={item.plan.name}
            vehicle={item.vehicle}
            preview={item.preview}
            tags={item.tags}
            meta={
              <>
                {item.plan.preset ? "来源预设" : `${item.plan.mounts.length} 个挂点`} · 资料{" "}
                {item.plan.sourceDate.slice(0, 10)}
              </>
            }
          >
            <LoadoutVoteButtons
              item={item}
              onChange={(value) =>
                setItems((rows) =>
                  rows.map((row) => (row.id === item.id ? { ...row, ...value } : row)),
                )
              }
            />
            <button onClick={() => onUse(item.plan)}>查看并使用</button>
          </LoadoutPlanCard>
        ))}
      </div>
      <div className="wt-mount-pagination">
        <button disabled={!offset || loading} onClick={() => setOffset((n) => Math.max(0, n - 24))}>
          上一页
        </button>
        <button disabled={loading || items.length < 24} onClick={() => setOffset((n) => n + 24)}>
          下一页
        </button>
      </div>
    </section>
  );
}
