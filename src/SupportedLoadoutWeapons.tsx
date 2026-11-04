import type { Vehicle } from "./models";
import { supportedLoadoutWeapons, supportedWeaponGroups } from "./supported-loadout-weapons";
import { loadoutWeaponName } from "./loadout-presentation";

export function SupportedLoadoutWeapons({
  unit,
  compact = false,
}: {
  unit: Vehicle;
  compact?: boolean;
}) {
  const data = unit.wikiDetails?.loadouts;
  const weapons = supportedLoadoutWeapons(data);
  return (
    <section
      className={`wt-supported-weapons ${compact ? "is-compact" : ""}`}
      aria-label={`${unit.name} 支持挂载的武器`}
    >
      <div className="wt-ground-section-heading">
        <h3>支持挂载的武器与设备</h3>
        <span>{weapons.length ? `${weapons.length} 种` : "资料状态"}</span>
      </div>
      {weapons.length ? (
        <>
          <div className="wt-supported-weapon-groups">
            {supportedWeaponGroups(weapons).map((group) => (
              <div className="wt-supported-weapon-group" key={group.label}>
                <h4>
                  {group.label}
                  <small>{group.items.length}</small>
                </h4>
                <ul>
                  {group.items.map((weapon) => (
                    <li key={weapon.key}>
                      {weapon.imageUrl && (
                        <img src={weapon.imageUrl} width={28} height={28} loading="lazy" alt="" />
                      )}
                      {weapon.source ? (
                        <a href={weapon.source} target="_blank" rel="noreferrer">
                          {loadoutWeaponName(weapon.name)}
                        </a>
                      ) : (
                        <span>{loadoutWeaponName(weapon.name)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="calc-note">
            按型号去重；组合挂架与不同型号分别保留。列出可选挂载，不代表能同时装配。
          </p>
        </>
      ) : (
        <p className="wt-dossier-empty">
          {data?.status === "none"
            ? "来源明确列出无外挂选项。"
            : data?.status === "parse_failed"
              ? "挂载资料需要核对，暂不展示未验证选项。"
              : "来源未提供可核验的挂载武器清单。"}
        </p>
      )}
      {data && (
        <a
          className="wt-supported-weapons-source"
          href={data.source}
          target="_blank"
          rel="noreferrer"
        >
          Wiki · {data.checkedAt.slice(0, 10)} ↗
        </a>
      )}
    </section>
  );
}
