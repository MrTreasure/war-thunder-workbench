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
  const families = availableWeaponFamilies(names, type);
  return (
    <div className="wt-mount-weapon-filters">
      <label>
        武器类型
        <GameSelect value={type} onValueChange={(value) => onChange(value, "")}>
          <option value="">全部类型</option>
          {weaponTypes
            .filter((item) => names.some((name) => item.matches.test(name)))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
        </GameSelect>
      </label>
      <label>
        型号系列
        <GameSelect value={family} onValueChange={(value) => onChange(type, value)}>
          <option value="">全部系列</option>
          {families.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </GameSelect>
      </label>
    </div>
  );
}
