import { useState } from "react";
import { VehicleTags } from "./VehicleTags";
import { VehicleTile } from "./VehicleTile";
import type { Catalog, Mode, Vehicle } from "./models";
import { VehicleImage } from "./VehicleImage";
import { VehicleWikiFacts } from "./VehicleWikiFacts";
import { vehicleDisplayName } from "./vehicle-display-name";
import { VehicleBattleRatings } from "./VehicleBattleRatings";
import { VehiclePerformance } from "./VehiclePerformance";
import { VehicleLoadouts } from "./VehicleLoadouts";
import { GameButton, GameLinkButton } from "./components/GameButton";
import { GameTabs, type GameTab } from "./components/GameTabs";
type DetailTab = "performance" | "statistics" | "loadouts" | "information" | "route";
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
  const [tab, setTab] = useState<DetailTab>("performance");
  const [performanceMode, setPerformanceMode] = useState<"ab" | "rb">(mode === "ab" ? "ab" : "rb");
  const id = `vehicle-${unit.id}-sections`;
  const items: GameTab<DetailTab>[] = [
    { value: "performance", label: "性能对比", icon: "performance" },
    { value: "statistics", label: "性能数值", icon: "details" },
    ...(["aviation", "helicopters"].includes(category)
      ? [{ value: "loadouts" as const, label: "武器挂载", icon: "loadout" as const }]
      : []),
    { value: "information", label: "资料与收益", icon: "details" },
    ...(unit.side === "research"
      ? [{ value: "route" as const, label: "研发路线", icon: "route" as const }]
      : []),
  ];
  const active = items.some((item) => item.value === tab) ? tab : "performance";
  return (
    <article className="detail wt-vehicle-sheet" aria-label="载具详情">
      <div className="wt-detail-hero">
        <button
          className="wt-detail-image"
          onClick={onImage}
          aria-label={`放大查看 ${vehicleDisplayName(unit.name)} 官方图片`}
        >
          <VehicleImage key={unit.id} unit={unit} />
          <span>查看大图 ⛶</span>
        </button>
        <div className="wt-detail-overview">
          <dl className="wt-detail-meta">
            <div>
              <dt>国家 / 军种</dt>
              <dd>
                {catalog.countries[country]} · {catalog.categories[category]}
              </dd>
            </div>
            <div>
              <dt>阶级 / 类型</dt>
              <dd>
                Rank {unit.rank} · {unit.role ? catalog.roles[unit.role] || unit.role : "暂无资料"}
              </dd>
            </div>
            <div>
              <dt>获取类别</dt>
              <dd>
                {unit.side === "research" ? "常规研发" : catalog.kinds[unit.kind] || "特殊载具"}
              </dd>
            </div>
          </dl>
          <VehicleBattleRatings unit={unit} category={category} mode={mode} />
          <div className="wt-detail-actions">
            <GameButton
              tone="primary"
              icon="research"
              disabled={unit.side !== "research"}
              title={unit.side !== "research" ? "独立获取载具不接入常规研发路线" : undefined}
              onClick={onVehicle}
            >
              研发载具
            </GameButton>
            <GameButton icon="performance" onClick={onParts}>
              研发配件
            </GameButton>
            {unit.store && (
              <GameLinkButton
                tone="ghost"
                icon="store"
                href={unit.store}
                target="_blank"
                rel="noreferrer"
              >
                官方礼包 ↗
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
                市场 ↗
              </GameLinkButton>
            )}
          </div>
        </div>
      </div>
      <GameTabs
        id={id}
        label="载具详情内容"
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
          {active === item.value &&
            (["performance", "statistics"].includes(item.value) ? (
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
                  <h3 id="wt-detail-route-title">必要前置路线</h3>
                  <span>{Math.max(0, path.length - 1)} 辆前置</span>
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
            ))}
        </section>
      ))}
      <VehicleTags key={unit.id} vehicleId={unit.id} />
    </article>
  );
}
