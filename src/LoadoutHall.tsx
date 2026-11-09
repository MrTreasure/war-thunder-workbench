import { t, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
// Request state follows the current filters and account identity.
/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from "react";
import bootstrap from "./generated/bootstrap.json";
import { assertQualitySort, qualityExplanation, qualitySummary } from "./hall-quality";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import type { LoadoutPlan } from "./loadouts";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { GameSelect } from "./components/GameSelect";
import { LoadoutVoteButtons } from "./LoadoutVoteButtons";
import { useWorkbenchAccount } from "./WorkbenchAccount";
export function LoadoutHall({ onUse }: { onUse: (plan: LoadoutPlan) => void }) {
  useLocale();
  const account = useWorkbenchAccount();
  return (
    <LoadoutHallView
      key={`${account.session?.user?.id || "guest"}:${account.identityVersion}`}
      onUse={onUse}
    />
  );
}
function LoadoutHallView({ onUse }: { onUse: (plan: LoadoutPlan) => void }) {
  useLocale();
  const [items, setItems] = useState<LoadoutShare[]>([]),
    [country, setCountry] = useState(""),
    [sort, setSort] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    void loadoutRequest<{ items: LoadoutShare[]; sort?: string; hasMore?: boolean }>(
      `recommendations?country=${country}&offset=${offset}&sort=${sort}`,
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
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "大厅读取失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, offset, revision, sort]);
  const nation = (value: string) =>
    value ? (
      <span className="wt-mount-country">
        <img
          src={bootstrap.flags[value as keyof typeof bootstrap.flags]}
          alt=""
          width={24}
          height={18}
        />
        {localize(bootstrap.countries[value as keyof typeof bootstrap.countries])}
      </span>
    ) : null;
  return (
    <section className="wt-mount-hall">
      <div className="wt-mount-section-heading">
        <h3>{t("挂载大厅")}</h3>
        <GameSelect
          aria-label={t("国家筛选")}
          value={country}
          renderOption={(option) => nation(option.value)}
          renderValue={nation}
          onValueChange={(value) => {
            setLoading(true);
            setError("");
            setCountry(value);
            setOffset(0);
          }}
        >
          <option value="">{t("全部国家")}</option>
          {localize(
            Object.entries(bootstrap.countries).map(([id, name]) => (
              <option key={id} value={id}>
                {localize(name)}
              </option>
            )),
          )}
        </GameSelect>
        <GameSelect
          aria-label={t("挂载排序")}
          value={sort}
          onValueChange={(value) => {
            setSort(value);
            setOffset(0);
          }}
        >
          <option value="">{t("最新发布")}</option>
          <option value="quality-v1">{t("质量排序")}</option>
          <option value="popular">{t("最多推荐")}</option>
        </GameSelect>
      </div>
      {localize(
        sort === "quality-v1" && <p className="calc-note">{localize(qualityExplanation)}</p>,
      )}
      {localize(loading && <p aria-live="polite">{t("正在读取大厅…")}</p>)}
      {localize(
        error && (
          <p role="alert">
            {localize(error)}
            <button
              onClick={() => {
                setLoading(true);
                setError("");
                setRevision((n) => n + 1);
              }}
            >
              {t("重试")}
            </button>
          </p>
        ),
      )}
      {localize(
        !loading && !error && !items.length && (
          <p className="wt-mount-empty">
            {t("暂无挂载推荐。保存配置后，可打上用途标签并发布到大厅。")}
          </p>
        ),
      )}
      <div className="wt-mount-recommendation-list">
        {localize(
          items.map((item) => (
            <LoadoutPlanCard
              key={item.id}
              title={localize(item.plan.name)}
              vehicle={item.vehicle}
              preview={item.preview}
              tags={item.tags}
              meta={localize(
                <>
                  {localize(item.plan.preset ? "来源预设" : `${item.plan.mounts.length} 个挂点`)}
                  {t("· 资料")}
                  {localize(" ")}
                  {localize(item.plan.sourceDate?.slice(0, 10) || "未知")}
                  <br />
                  {localize(qualitySummary(item.quality, item.up, item.down))}
                </>,
              )}
            >
              <LoadoutVoteButtons
                item={item}
                onChange={() => {
                  setOffset(0);
                  setRevision((v) => v + 1);
                }}
              />
              <button onClick={() => onUse(item.plan)}>{t("查看并使用")}</button>
            </LoadoutPlanCard>
          )),
        )}
      </div>
      <div className="wt-mount-pagination">
        <button disabled={!offset || loading} onClick={() => setOffset((n) => Math.max(0, n - 24))}>
          {t("上一页")}
        </button>
        <button disabled={loading || !hasMore} onClick={() => setOffset((n) => n + 24)}>
          {t("下一页")}
        </button>
      </div>
    </section>
  );
}
