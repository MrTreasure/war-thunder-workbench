import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useEffect, useState } from "react";
import bootstrap from "./generated/bootstrap.json";
import { loadoutRequest } from "./loadout-api";
import type { LoadoutShare } from "./loadout-shares";
import type { LoadoutPlan } from "./loadouts";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { GameSelect } from "./components/GameSelect";
export function LoadoutHall({ onUse }: { onUse: (plan: LoadoutPlan) => void }) {
  useLocale();
  const [items, setItems] = useState<LoadoutShare[]>([]),
    [country, setCountry] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void loadoutRequest<{
      items: LoadoutShare[];
    }>(`recommendations?country=${country}&offset=${offset}`, undefined, controller.signal)
      .then(
        (value) => {
          if (!controller.signal.aborted) setItems(value.items);
        },
        (e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : t("大厅读取失败。"));
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [country, offset, revision]);
  const nation = (value: string) =>
    value ? (
      <span className="wt-mount-country">
        <img
          src={bootstrap.flags[value as keyof typeof bootstrap.flags]}
          alt=""
          width={24}
          height={18}
        />
        {t(bootstrap.countries[value as keyof typeof bootstrap.countries])}
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
          {Object.entries(bootstrap.countries).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </GameSelect>
      </div>
      {loading && <p aria-live="polite">{t("正在读取大厅\u2026")}</p>}
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
            {t("重试")}
          </button>
        </p>
      )}
      {!loading && !error && !items.length && (
        <p className="wt-mount-empty">
          {t("暂无挂载推荐。保存配置后，可打上用途标签并发布到大厅。")}
        </p>
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
                {item.plan.preset ? t("来源预设") : t("{0} 个挂点", [item.plan.mounts.length])}
                {t("\u00B7 资料")} {item.plan.sourceDate.slice(0, 10)}
              </>
            }
          >
            <button onClick={() => onUse(item.plan)}>{t("查看并使用")}</button>
          </LoadoutPlanCard>
        ))}
      </div>
      <div className="wt-mount-pagination">
        <button disabled={!offset || loading} onClick={() => setOffset((n) => Math.max(0, n - 24))}>
          {t("上一页")}
        </button>
        <button disabled={loading || items.length < 24} onClick={() => setOffset((n) => n + 24)}>
          {t("下一页")}
        </button>
      </div>
    </section>
  );
}
