/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables remain keyboard-scrollable. */
import type { Vehicle } from "./models";
import { GameIcon } from "./components/GameIcon";
const amount = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
export function VehicleLoadouts({ unit }: { unit: Vehicle }) {
  const data = unit.wikiDetails?.loadouts;
  return (
    <section className="wt-loadouts" aria-label="飞机挂载资料">
      <div className="wt-dossier-section-heading">
        <div>
          <GameIcon name="loadout" />
          <h3>武器与挂载</h3>
        </div>
        {data?.status === "available" && (
          <span>
            {data.hardpoints.length
              ? `${data.compatibility.length} 种挂载选项`
              : `${data.presets.length} 组预设`}
          </span>
        )}
      </div>
      {data?.status !== "available" ? (
        <p className="wt-dossier-empty">
          {data?.status === "none"
            ? "Wiki 明确列出该机没有外挂选项。"
            : data?.status === "parse_failed"
              ? "挂载资料需要重新核对，暂不展示未验证配置。"
              : data?.status === "not_provided"
                ? "Wiki 未提供完整挂载资料。"
                : "该机的挂载资料尚未采集。"}
        </p>
      ) : (
        <>
          {!!data.limits.length && (
            <dl className="wt-loadout-limits">
              {data.limits.map((limit) => (
                <div key={limit.id}>
                  <dt>{limit.label}</dt>
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
                挂点兼容表 <small>数字表示该选项在该挂点的数量</small>
              </h4>
              <section
                className="wt-loadout-matrix-scroll"
                aria-label="挂载选项与挂点对应关系"
                tabIndex={0}
              >
                <table className="wt-loadout-matrix">
                  <thead>
                    <tr>
                      <th scope="col">挂载选项</th>
                      <th scope="col">重量</th>
                      {data.hardpoints.map((point) => (
                        <th
                          scope="col"
                          key={point.id}
                          title={
                            point.side
                              ? `${point.side === "left" ? "左" : point.side === "right" ? "右" : "中央"}侧挂点`
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
                            <span>
                              {option.source ? (
                                <a href={option.source} target="_blank" rel="noreferrer">
                                  {option.name} ↗
                                </a>
                              ) : (
                                option.name
                              )}
                              {option.parameters.length > 0 && (
                                <details>
                                  <summary>武器参数</summary>
                                  <dl>
                                    {option.parameters.map((parameter) => (
                                      <div key={parameter.id}>
                                        <dt>{parameter.label}</dt>
                                        <dd>{parameter.value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </details>
                              )}
                            </span>
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
              <h4>Wiki 预设组合</h4>
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
                          <dl className="wt-preset-parameters">
                            {item.parameters.map((parameter) => (
                              <div key={parameter.id}>
                                <dt>{parameter.label}</dt>
                                <dd>{parameter.value}</dd>
                              </div>
                            ))}
                          </dl>
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
              该页面列出了挂载资料，但未提供可展示的挂点矩阵或预设组合。
            </p>
          )}
          <p className="wt-dossier-note">
            挂点兼容表不等于可同时装配的完整方案。武器互斥、配件解锁与载荷限制以游戏为准；未提供的重量保持未知。
          </p>
        </>
      )}
      {data && (
        <a className="wt-dossier-provenance" href={data.source} target="_blank" rel="noreferrer">
          官方 Wiki · {data.checkedAt.slice(0, 10)} ↗
        </a>
      )}
    </section>
  );
}
