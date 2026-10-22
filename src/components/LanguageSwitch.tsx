import { GameSelect } from "./GameSelect";
import { getLocale, locales, setLocale, t } from "../i18n/core";
import { useLocale } from "../i18n/react";
const names = { "zh-CN": "简体中文", en: "English", ru: "Русский" } as const;
const shortNames = { "zh-CN": "中", en: "EN", ru: "RU" } as const;
export function LanguageSwitch() {
  const locale = useLocale();
  return (
    <div className="wt-language-control" title="语言 / Language / Язык">
      <GameSelect
        className="wt-language-select"
        value={locale}
        displayValue={shortNames[locale]}
        aria-label={t("切换语言")}
        onValueChange={(next) => {
          if (locales.some((value) => value === next))
            setLocale(next as ReturnType<typeof getLocale>);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {names[value]}
          </option>
        ))}
      </GameSelect>
    </div>
  );
}
