import { GameSelect } from "./GameSelect";
import { getLocale, locales, setLocale, t } from "../i18n/core";
import { useLocale } from "../i18n/react";
import languages from "../../data/languages.json";

function LanguageLabel({
  value,
  expanded = false,
}: {
  value: keyof typeof languages;
  expanded?: boolean;
}) {
  const language = languages[value];
  return (
    <span className="wt-language-label" lang={value}>
      <span className="wt-language-flag" aria-hidden="true">
        {language.flag}
      </span>
      <span className="wt-language-code">{language.code}</span>
      {expanded && (
        <span className="wt-language-name">
          <span aria-hidden="true">— </span>
          {language.name}
        </span>
      )}
    </span>
  );
}

export function LanguageSwitch() {
  const locale = useLocale();
  return (
    <div className="wt-language-control" title="语言 / Language / Язык / 言語">
      <GameSelect
        className="wt-language-select"
        menuClassName="wt-language-menu"
        menuAlign="end"
        value={locale}
        displayValue={<LanguageLabel value={locale} />}
        renderOption={(option) => (
          <LanguageLabel value={option.value as keyof typeof languages} expanded />
        )}
        aria-label={t("切换语言")}
        onValueChange={(next) => {
          if (locales.some((value) => value === next))
            setLocale(next as ReturnType<typeof getLocale>);
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value} lang={value}>
            {languages[value].code} — {languages[value].name}
          </option>
        ))}
      </GameSelect>
    </div>
  );
}
