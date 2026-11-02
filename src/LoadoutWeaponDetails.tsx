import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import type { WikiLoadoutOption } from "./models";
import { loadoutParameterValue } from "./intl-loadout-presentation";
import { missileBrief } from "./loadout-weapon-details";
export function LoadoutWeaponBrief({ option }: { option: WikiLoadoutOption }) {
  useLocale();
  const fields = missileBrief(option.parameters);
  return (
    <dl className="wt-mount-weapon-brief" aria-label={t("武器主要参数")}>
      {fields.map((field) => (
        <div key={field.id}>
          <dt className={field.id === "guidance" ? "sr-only" : undefined}>{t(field.label)}</dt>
          <dd>{field.value ? loadoutParameterValue(field.value) : t("未知")}</dd>
        </div>
      ))}
    </dl>
  );
}
export function LoadoutWeaponDetails({
  option,
}: {
  option: Pick<WikiLoadoutOption, "name" | "parameters" | "source">;
}) {
  useLocale();
  return (
    <>
      <p className="wt-mount-source-name">
        {t("来源名称：")}
        {option.name}
      </p>
      <dl className="wt-mount-weapon-parameters" aria-label={t("完整武器参数")}>
        {option.parameters.map((parameter) => (
          <div key={parameter.id}>
            <dt>{t(parameter.label)}</dt>
            <dd>{loadoutParameterValue(parameter.value)}</dd>
          </div>
        ))}
      </dl>
      {!option.parameters.length && <p>{t("来源未提供详细武器参数。")}</p>}
      {option.source && (
        <a href={option.source} target="_blank" rel="noopener noreferrer">
          {t("查看官方 Wiki 来源 \u2197")}
        </a>
      )}
    </>
  );
}
