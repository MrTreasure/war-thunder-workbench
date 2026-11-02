import { useLocale } from "./i18n/react";
import { t, getLocale } from "./i18n/core";
import type { CSSProperties } from "react";
import type { LoadoutPreview, LoadoutVehicle } from "./loadout-shares";
import { VehicleTile } from "./VehicleTile";
import { GameTip } from "./components/GameTip";
import { GameIcon } from "./components/GameIcon";
import { LoadoutWeaponDetails } from "./LoadoutWeaponDetails";
import { loadoutWeaponName, loadoutWeaponLabelWidth } from "./intl-loadout-presentation";
export function LoadoutSummaryStrip({
  vehicle,
  preview,
}: {
  vehicle?: LoadoutVehicle;
  preview?: LoadoutPreview;
}) {
  useLocale();
  return (
    <>
      <div className="wt-mount-summary-strip" aria-label={t("机型与挂载列表")}>
        {vehicle && (
          <div className="wt-mount-summary-aircraft">
            <VehicleTile
              unit={vehicle}
              showPackPrice={false}
              footerLabel={t("{0} 级", [vehicle.rank])}
            />
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
                  label={`${t(item.label)} · ${loadoutWeaponName(item.name)}`}
                  triggerLabel={t("查看{0}的挂载详情", [item.label])}
                  icon={
                    <>
                      <span className="wt-mount-preview-top">
                        <span className="wt-mount-preview-label">{t(item.label)}</span>
                        <span>× {item.count ?? t("未知")}</span>
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
                    {t("数量：")}
                    {item.count ?? t("未知")} ·{" "}
                    {item.weightKg === null
                      ? t("重量未知")
                      : t("{0} 千克", [item.weightKg.toLocaleString(getLocale())])}
                  </p>
                  <LoadoutWeaponDetails option={item} />
                </GameTip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview?.sourceChanged && (
        <p className="wt-mount-warning">{t("来源版本已更新，打开方案后重新核对挂载。")}</p>
      )}
      {!preview?.sourceChanged && !preview?.items.length && (
        <p className="wt-mount-note">{t("挂载明细暂无可用资料，请打开方案核对。")}</p>
      )}
    </>
  );
}
