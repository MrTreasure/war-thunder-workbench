import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import type { Vehicle } from "./models";
import { supportedLoadoutWeapons, supportedWeaponGroups } from "./supported-loadout-weapons";
import { loadoutWeaponName } from "./intl-loadout-presentation";
import { GameTip } from "./components/GameTip";
import { LoadoutWeaponDetails } from "./LoadoutWeaponDetails";
export function SupportedLoadoutWeapons({
  unit,
  compact = false,
}: {
  unit: Vehicle;
  compact?: boolean;
}) {
  useLocale();
  const data = unit.wikiDetails?.loadouts;
  const weapons = supportedLoadoutWeapons(data);
  return (
    <section
      className={`wt-supported-weapons ${compact ? "is-compact" : ""}`}
      aria-label={t("{0} \u652F\u6301\u6302\u8F7D\u7684\u6B66\u5668", [unit.name])}
    >
      <div className="wt-ground-section-heading">
        <h3>{t("\u652F\u6301\u6302\u8F7D\u7684\u6B66\u5668\u4E0E\u8BBE\u5907")}</h3>
        <span>
          {weapons.length ? t("{0} \u79CD", [weapons.length]) : t("\u8D44\u6599\u72B6\u6001")}
        </span>
      </div>
      {weapons.length ? (
        <>
          <div className="wt-supported-weapon-groups">
            {supportedWeaponGroups(weapons).map((group) => (
              <div className="wt-supported-weapon-group" key={t(group.label)}>
                <h4>
                  {t(group.label)}
                  <small>{group.items.length}</small>
                </h4>
                <ul>
                  {group.items.map((weapon) => (
                    <li key={weapon.key}>
                      <GameTip
                        label={loadoutWeaponName(weapon.name)}
                        triggerLabel={t("\u67E5\u770B {0} \u8BE6\u7EC6\u4FE1\u606F", [
                          loadoutWeaponName(weapon.name),
                        ])}
                        className="wt-supported-weapon-trigger"
                        icon={
                          <>
                            {weapon.imageUrl && (
                              <img
                                src={weapon.imageUrl}
                                width={28}
                                height={28}
                                loading="lazy"
                                alt=""
                              />
                            )}
                            <span>{loadoutWeaponName(weapon.name)}</span>
                          </>
                        }
                      >
                        <LoadoutWeaponDetails option={weapon} />
                      </GameTip>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="wt-dossier-empty">
          {data?.status === "none"
            ? t("\u6765\u6E90\u660E\u786E\u5217\u51FA\u65E0\u5916\u6302\u9009\u9879\u3002")
            : data?.status === "parse_failed"
              ? t(
                  "\u6302\u8F7D\u8D44\u6599\u9700\u8981\u6838\u5BF9\uFF0C\u6682\u4E0D\u5C55\u793A\u672A\u9A8C\u8BC1\u9009\u9879\u3002",
                )
              : t(
                  "\u6765\u6E90\u672A\u63D0\u4F9B\u53EF\u6838\u9A8C\u7684\u6302\u8F7D\u6B66\u5668\u6E05\u5355\u3002",
                )}
        </p>
      )}
    </section>
  );
}
