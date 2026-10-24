import { t, localize, vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { VehicleTile } from "./VehicleTile";
import type { Catalog, Mode, Vehicle } from "./models";
import { VehicleImage } from "./VehicleImage";
import { VehicleWikiFacts } from "./VehicleWikiFacts";
import { modes, rating } from "./TreeCanvas";

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
  return (
    <article className="detail wt-vehicle-sheet" aria-label={t("载具详情")}>
      <div className="wt-detail-hero">
        <button
          className="wt-detail-image"
          onClick={onImage}
          aria-label={t("放大查看 {0} 官方图片", [localize(vehicleName(unit))])}
        >
          <VehicleImage key={unit.id} unit={unit} />
          <span>{t("查看大图 ⛶")}</span>
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
          <div className="wt-detail-ratings" aria-label={t("各模式战斗评级")}>
            {localize(
              (["ab", "rb", "sb"] as const).map((value) => (
                <span key={value} className={value === mode ? "is-current" : ""}>
                  <small>
                    {localize(modes[value])} {localize(value.toUpperCase())}
                  </small>
                  <strong>{localize(rating(unit, value))}</strong>
                </span>
              )),
            )}
          </div>
          <div className="wt-detail-actions">
            <button
              className="quiet-button"
              disabled={unit.side !== "research"}
              title={unit.side !== "research" ? t("独立获取载具不接入常规研发路线") : undefined}
              onClick={onVehicle}
            >
              {t("研发载具")}
            </button>
            <button className="quiet-button" onClick={onParts}>
              {t("研发配件")}
            </button>
            {localize(
              unit.store && (
                <a href={unit.store} target="_blank" rel="noreferrer">
                  {t("官方礼包 ↗")}
                </a>
              ),
            )}
            {localize(
              unit.market && (
                <a href={unit.market} target="_blank" rel="noreferrer">
                  {t("市场 ↗")}
                </a>
              ),
            )}
          </div>
        </div>
      </div>
      <VehicleWikiFacts unit={unit} />
      {localize(
        unit.side === "research" ? (
          <section className="wt-detail-route" aria-labelledby="wt-detail-route-title">
            <div className="wt-detail-section-heading">
              <h3 id="wt-detail-route-title">{t("必要前置路线")}</h3>
              <span>{t("{0} 辆前置", [Math.max(0, path.length - 1)])}</span>
            </div>
            <ol className="wt-detail-route-list">
              {localize(
                path.map((previous) => (
                  <li key={previous.id} className={previous.id === unit.id ? "is-target" : ""}>
                    <VehicleTile
                      unit={previous}
                      catalog={catalog}
                      mode={mode}
                      selected={previous.id === unit.id}
                      onSelect={() => onSelect(previous.id)}
                    />
                  </li>
                )),
              )}
            </ol>
            <p className="wt-detail-route-note">
              {t("按真实前置关系排列；研发仍需满足对应阶级的购车数量。")}
            </p>
          </section>
        ) : (
          <p className="wt-detail-route-note">
            {t("独立获取载具，不接入常规研发路线。是否在售以官方页面为准。")}
          </p>
        ),
      )}
    </article>
  );
}
