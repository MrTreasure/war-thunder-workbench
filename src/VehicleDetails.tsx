import { VehicleTile } from "./VehicleTile";
import type { Catalog, Mode, Vehicle } from "./models";
import { VehicleImage } from "./VehicleImage";
import { VehicleWikiFacts } from "./VehicleWikiFacts";
import { vehicleDisplayName } from "./vehicle-display-name";
import { VehicleBattleRatings } from "./VehicleBattleRatings";

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
            <button
              className="quiet-button"
              disabled={unit.side !== "research"}
              title={unit.side !== "research" ? "独立获取载具不接入常规研发路线" : undefined}
              onClick={onVehicle}
            >
              研发载具
            </button>
            <button className="quiet-button" onClick={onParts}>
              研发配件
            </button>
            {unit.store && (
              <a href={unit.store} target="_blank" rel="noreferrer">
                官方礼包 ↗
              </a>
            )}
            {unit.market && (
              <a href={unit.market} target="_blank" rel="noreferrer">
                市场 ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <VehicleWikiFacts unit={unit} />
      {unit.side === "research" ? (
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
          <p className="wt-detail-route-note">
            按真实前置关系排列；研发仍需满足对应阶级的购车数量。
          </p>
        </section>
      ) : (
        <p className="wt-detail-route-note">
          独立获取载具，不接入常规研发路线。是否在售以官方页面为准。
        </p>
      )}
    </article>
  );
}
