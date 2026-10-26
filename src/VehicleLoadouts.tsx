import { t, localize, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables remain keyboard-scrollable. */
import type { Vehicle } from "./models";
import { WeaponParameters } from "./components/WeaponParameters";
import { GameIcon } from "./components/GameIcon";
const amount = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export function VehicleLoadouts({ unit }: { unit: Vehicle }) {
  useLocale();
  const data = unit.wikiDetails?.loadouts;
  return (
    <section className="wt-loadouts" aria-label={t("飞机挂载资料")}>
      <div className="wt-dossier-section-heading">
        <div>
          <GameIcon name="loadout" />
          <h3>{t("武器与挂载")}</h3>
        </div>
        {data?.status === "available" && (
          <span>
            {data.hardpoints.length
              ? t("{0} 种挂载选项", [data.compatibility.length])
              : t("{0} 组预设", [data.presets.length])}
          </span>
        )}
      </div>
      {data?.status !== "available" ? (
        <p className="wt-dossier-empty">
          {data?.status === "none"
            ? t("Wiki 明确列出该机没有外挂选项。")
            : data?.status === "parse_failed"
              ? t("挂载资料需要重新核对，暂不展示未验证配置。")
              : data?.status === "not_provided"
                ? t("Wiki 未提供完整挂载资料。")
                : t("该机的挂载资料尚未采集。")}
        </p>
      ) : (
        <>
          {!!data.limits.length && (
            <dl className="wt-loadout-limits">
              {data.limits.map((limit) => (
                <div key={limit.id}>
                  <dt>{localize(limit.label)}</dt>
                  <dd>
                    {amount(limit.value)} <small>{limit.unit}</small>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {!!data.hardpoints.length && (
            <>
              <h4>
                {t("挂点兼容表")}
                <small>{t("数字表示该选项在该挂点的数量")}</small>
              </h4>
              <section
                className="wt-loadout-matrix-scroll"
                aria-label={t("挂载选项与挂点对应关系")}
                tabIndex={0}
              >
                <table className="wt-loadout-matrix">
                  <thead>
                    <tr>
                      <th scope="col">{t("挂载选项")}</th>
                      <th scope="col">{t("重量")}</th>
                      {data.hardpoints.map((point) => (
                        <th
                          scope="col"
                          key={point.id}
                          title={
                            point.side
                              ? t("{0}侧挂点", [
                                  point.side === "left"
                                    ? t("左")
                                    : point.side === "right"
                                      ? t("右")
                                      : t("中央"),
                                ])
                              : undefined
                          }
                        >
                          {point.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.compatibility.map((option) => (
                      <tr key={option.optionId}>
                        <th scope="row">
                          <span className="wt-loadout-weapon">
                            {option.imageUrl && (
                              <img
                                src={option.imageUrl}
                                width={36}
                                height={32}
                                alt=""
                                loading="lazy"
                              />
                            )}
                            {option.source ? (
                              <a
                                className="wt-loadout-name"
                                href={option.source}
                                target="_blank"
                                rel="noreferrer"
                                title={option.name}
                              >
                                {option.name} ↗
                              </a>
                            ) : (
                              <span className="wt-loadout-name" title={option.name}>
                                {option.name}
                              </span>
                            )}
                            {option.parameters.length > 0 && (
                              <WeaponParameters name={option.name} parameters={option.parameters} />
                            )}
                          </span>
                        </th>
                        <td>
                          {amount(option.weightKg)} <small>kg</small>
                        </td>
                        {data.hardpoints.map((point) => {
                          const station = option.stations.find(
                            (station) => station.hardpointId === point.id,
                          );
                          return (
                            <td key={point.id} data-compatible={!!station}>
                              {station ? amount(station.count) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {!!data.presets.length && (
            <div className="wt-loadout-presets">
              <h4>{t("Wiki 预设组合")}</h4>
              {data.presets.map((preset) => (
                <details key={preset.id}>
                  <summary>{preset.label}</summary>
                  <ul>
                    {preset.items.map((item, index) => (
                      <li key={`${item.weaponId}-${index}`}>
                        {item.source ? (
                          <a href={item.source} target="_blank" rel="noreferrer">
                            {item.name} ↗
                          </a>
                        ) : (
                          item.name
                        )}
                        {item.count !== null ? ` × ${item.count}` : ""}
                        {!!item.parameters?.length && (
                          <WeaponParameters name={item.name} parameters={item.parameters} />
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
          {!data.hardpoints.length && !data.presets.length && (
            <p className="wt-dossier-empty">
              {t("该页面列出了挂载资料，但未提供可展示的挂点矩阵或预设组合。")}
            </p>
          )}
          <p className="wt-dossier-note">
            {t(
              "挂点兼容表不等于可同时装配的完整方案。武器互斥、配件解锁与载荷限制以游戏为准；未提供的重量保持未知。",
            )}
          </p>
        </>
      )}
      {data && (
        <a className="wt-dossier-provenance" href={data.source} target="_blank" rel="noreferrer">
          {t("官方 Wiki ·")}
          {data.checkedAt.slice(0, 10)} ↗
        </a>
      )}
    </section>
  );
}
