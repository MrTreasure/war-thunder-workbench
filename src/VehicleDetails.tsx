import { t, localize, vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useCallback, useState } from "react";
import { VehicleTags } from "./VehicleTags";
import { VehicleTile } from "./VehicleTile";
import type { Catalog, Mode, Vehicle } from "./models";
import { VehicleImage } from "./VehicleImage";
import { VehicleWikiFacts } from "./VehicleWikiFacts";
import { VehicleBattleRatings } from "./VehicleBattleRatings";
import { VehiclePerformance } from "./VehiclePerformance";
import { VehicleLoadouts } from "./VehicleLoadouts";
import { GameIcon } from "./components/GameIcon";
import { GameButton, GameLinkButton } from "./components/GameButton";
import { GameTabs, type GameTab } from "./components/GameTabs";
import { VehicleSaleCartAction } from "./VehicleSaleCartAction";
type DetailTab = "tags" | "performance" | "statistics" | "loadouts" | "information" | "route";
export function VehicleDetails({
  unit,
  catalog,
  country,
  category,
  mode,
  path,
  onImage,
  onVehicle,
  onParts,
  onSelect,
}: {
  unit: Vehicle;
  catalog: Catalog;
  country: string;
  category: string;
  mode: Mode;
  path: Vehicle[];
  onImage: () => void;
  onVehicle: () => void;
  onParts: () => void;
  onSelect: (id: string) => void;
}) {
  useLocale();
  const [choice, setChoice] = useState<{ id: string; tab: DetailTab } | null>(null);
  const [resolved, setResolved] = useState<{ id: string; count: number } | null>(null);
  const onTagsResolved = useCallback(
    (count: number) => {
      setResolved((previous) =>
        previous?.id === unit.id && previous.count === count ? previous : { id: unit.id, count },
      );
    },
    [unit.id],
  );
  const setTab = (tab: DetailTab) => setChoice({ id: unit.id, tab });
  const [performanceMode, setPerformanceMode] = useState<"ab" | "rb">(mode === "ab" ? "ab" : "rb");
  const id = `vehicle-${unit.id}-sections`;
  const items: GameTab<DetailTab>[] = [
    { value: "tags", label: t("载具标签"), icon: "details" },
    { value: "performance", label: t("性能对比"), icon: "performance" },
    { value: "statistics", label: t("性能数值"), icon: "details" },
    ...(["aviation", "helicopters"].includes(category)
      ? [{ value: "loadouts" as const, label: t("武器挂载"), icon: "loadout" as const }]
      : []),
    { value: "information", label: t("资料与收益"), icon: "details" },
    ...(unit.side === "research"
      ? [{ value: "route" as const, label: t("研发路线"), icon: "route" as const }]
      : []),
  ];
  const ready = choice?.id === unit.id || resolved?.id === unit.id;
  const selectedTab =
    choice?.id === unit.id
      ? choice.tab
      : resolved?.id === unit.id && resolved.count > 0
        ? "tags"
        : "performance";
  const active = items.some((item) => item.value === selectedTab) ? selectedTab : "performance";
  return (
    <article className="detail wt-vehicle-sheet" aria-label={t("载具详情")}>
      <div className="wt-detail-hero">
        <button
          className="wt-detail-image"
          onClick={onImage}
          aria-label={t("放大查看 {0} 官方图片", [localize(vehicleName(unit))])}
        >
          <VehicleImage key={unit.id} unit={unit} />
          <span className="wt-detail-zoom" aria-hidden="true">
            <GameIcon name="external" />
          </span>
        </button>
        <div className="wt-detail-overview">
          <dl className="wt-detail-meta">
            <div>
              <dt>{t("国家 / 军种")}</dt>
              <dd>
                {localize(catalog.countries[country])} · {localize(catalog.categories[category])}
              </dd>
            </div>
            <div>
              <dt>{t("阶级 / 类型")}</dt>
              <dd>
                Rank {localize(unit.rank)} ·{" "}
                {localize(unit.role ? catalog.roles[unit.role] || unit.role : t("暂无资料"))}
              </dd>
            </div>
            <div>
              <dt>{t("获取类别")}</dt>
              <dd>
                {localize(
                  unit.side === "research"
                    ? t("常规研发")
                    : catalog.kinds[unit.kind] || t("特殊载具"),
                )}
              </dd>
            </div>
          </dl>
          <VehicleBattleRatings unit={unit} category={category} mode={mode} />
          <div className="wt-detail-actions">
            <GameButton
              tone="primary"
              icon="research"
              disabled={unit.side !== "research"}
              title={unit.side !== "research" ? t("独立获取载具不接入常规研发路线") : undefined}
              onClick={onVehicle}
            >
              {t("研发载具")}
            </GameButton>
            <GameButton icon="performance" onClick={onParts}>
              {t("研发配件")}
            </GameButton>
            <VehicleSaleCartAction
              key={`${country}:${category}:${unit.id}`}
              unit={unit}
              catalog={catalog}
              country={country}
              category={category}
            />
            {unit.store && (
              <GameLinkButton
                tone="ghost"
                icon="store"
                href={unit.store}
                target="_blank"
                rel="noreferrer"
              >
                {t("官方礼包 ↗")}
              </GameLinkButton>
            )}
            {unit.market && (
              <GameLinkButton
                tone="ghost"
                icon="external"
                href={unit.market}
                target="_blank"
                rel="noreferrer"
              >
                {t("市场 ↗")}
              </GameLinkButton>
            )}
          </div>
        </div>
      </div>
      <GameTabs
        id={id}
        label={t("载具详情内容")}
        value={active}
        items={items}
        onValueChange={setTab}
        className="wt-detail-tabs"
      />
      {items.map((item) => (
        <section
          key={item.value}
          role="tabpanel"
          id={`${id}-${item.value}-panel`}
          aria-labelledby={`${id}-${item.value}-tab`}
          hidden={active !== item.value}
          className="wt-detail-panel"
        >
          {item.value === "tags" ? (
            <VehicleTags key={unit.id} vehicleId={unit.id} onResolved={onTagsResolved} />
          ) : (
            active === item.value &&
            (!ready ? (
              <output className="wt-detail-pending">{t("正在读取载具标签…")}</output>
            ) : ["performance", "statistics"].includes(item.value) ? (
              <VehiclePerformance
                key={unit.id}
                unit={unit}
                category={category}
                view={item.value === "statistics" ? "table" : "chart"}
                comparisonMode={performanceMode}
                onModeChange={setPerformanceMode}
              />
            ) : item.value === "loadouts" ? (
              <VehicleLoadouts unit={unit} />
            ) : item.value === "information" ? (
              <VehicleWikiFacts unit={unit} />
            ) : (
              <section className="wt-detail-route" aria-labelledby="wt-detail-route-title">
                <div className="wt-detail-section-heading">
                  <h3 id="wt-detail-route-title">{t("必要前置路线")}</h3>
                  <span>
                    {Math.max(0, path.length - 1)}
                    {t("辆前置")}
                  </span>
                </div>
                <ol className="wt-detail-route-list">
                  {path.map((previous) => (
                    <li key={previous.id} className={previous.id === unit.id ? "is-target" : ""}>
                      <VehicleTile
                        unit={previous}
                        catalog={catalog}
                        mode={mode}
                        selected={previous.id === unit.id}
                        onSelect={() => onSelect(previous.id)}
                      />
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}
        </section>
      ))}
    </article>
  );
}
