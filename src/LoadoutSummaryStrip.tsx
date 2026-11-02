import type { CSSProperties } from "react";
import type { LoadoutPreview, LoadoutVehicle } from "./loadout-shares";
import { VehicleTile } from "./VehicleTile";
import { GameTip } from "./components/GameTip";
import { GameIcon } from "./components/GameIcon";
import { LoadoutWeaponDetails } from "./LoadoutWeaponDetails";
import { loadoutWeaponName, loadoutWeaponLabelWidth } from "./loadout-presentation";

export function LoadoutSummaryStrip({
  vehicle,
  preview,
}: {
  vehicle?: LoadoutVehicle;
  preview?: LoadoutPreview;
}) {
  return (
    <>
      <div className="wt-mount-summary-strip" aria-label="机型与挂载列表">
        {vehicle && (
          <div className="wt-mount-summary-aircraft">
            <VehicleTile unit={vehicle} showPackPrice={false} footerLabel={`${vehicle.rank} 级`} />
          </div>
        )}
        {!!preview?.items.length && (
          <ul className="wt-mount-preview-slots">
            {preview.items.map((item, index) => (
              <li
                key={`${item.station}-${index}`}
                style={
                  {
                    "--wt-weapon-label-width": `${loadoutWeaponLabelWidth(item.name)}em`,
                  } as CSSProperties
                }
              >
                <GameTip
                  className="wt-mount-preview-weapon"
                  label={`${item.label} · ${loadoutWeaponName(item.name)}`}
                  triggerLabel={`查看${item.label}的挂载详情`}
                  icon={
                    <>
                      <span className="wt-mount-preview-top">
                        <span className="wt-mount-preview-label">{item.label}</span>
                        <span>× {item.count ?? "未知"}</span>
                      </span>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" width={48} height={40} loading="lazy" />
                      ) : (
                        <GameIcon name="loadout" />
                      )}
                      <span className="wt-mount-preview-name">{loadoutWeaponName(item.name)}</span>
                    </>
                  }
                >
                  <p>
                    数量：{item.count ?? "未知"} ·{" "}
                    {item.weightKg === null ? "重量未知" : `${item.weightKg.toLocaleString()} 千克`}
                  </p>
                  <LoadoutWeaponDetails option={item} />
                </GameTip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview?.sourceChanged && (
        <p className="wt-mount-warning">来源版本已更新，打开方案后重新核对挂载。</p>
      )}
      {!preview?.sourceChanged && !preview?.items.length && (
        <p className="wt-mount-note">挂载明细暂无可用资料，请打开方案核对。</p>
      )}
    </>
  );
}
