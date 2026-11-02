import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { GameSelect } from "./components/GameSelect";
import { availableWeaponFamilies, weaponTypes } from "./loadout-weapon-filters";
export function LoadoutWeaponFilters({
  names,
  type,
  family,
  onChange,
}: {
  names: string[];
  type: string;
  family: string;
  onChange: (type: string, family: string) => void;
}) {
  useLocale();
  const families = availableWeaponFamilies(names, type);
  return (
    <div className="wt-mount-weapon-filters">
      <label>
        {t("武器类型")}
        <GameSelect value={type} onValueChange={(value) => onChange(value, "")}>
          <option value="">{t("全部类型")}</option>
          {weaponTypes
            .filter((item) => names.some((name) => item.matches.test(name)))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {t(item.label)}
              </option>
            ))}
        </GameSelect>
      </label>
      <label>
        {t("型号系列")}
        <GameSelect value={family} onValueChange={(value) => onChange(type, value)}>
          <option value="">{t("全部系列")}</option>
          {families.map((item) => (
            <option key={item.id} value={item.id}>
              {t(item.label)}
            </option>
          ))}
        </GameSelect>
      </label>
    </div>
  );
}
