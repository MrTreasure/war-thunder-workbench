import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import type { WikiLoadouts } from "./models";
import { presetKey } from "./loadouts";
import { loadoutWeaponName, loadoutParameterValue } from "./intl-loadout-presentation";
export function LoadoutPresets({
  data,
  onUse,
}: {
  data: WikiLoadouts;
  onUse?: (key: string) => void;
}) {
  useLocale();
  return (
    <section className="wt-mount-defaults" aria-label={t("默认与预设挂载")}>
      <div className="wt-mount-section-heading">
        <h3>{t("默认与预设挂载")}</h3>
        <span>{t("Wiki 来源方案")}</span>
      </div>
      {!data.presets.length ? (
        <p className="wt-mount-note">
          {t("当前 Wiki 未提供该机的默认预设；挂点兼容表与默认方案分别记录。")}
        </p>
      ) : (
        <div className="wt-mount-default-list">
          {data.presets.map((preset) => (
            <article key={preset.id}>
              <header>
                <h4>{t(preset.label)}</h4>
                {onUse && (
                  <button onClick={() => onUse(presetKey(preset))}>{t("使用此预设")}</button>
                )}
              </header>
              <ul>
                {preset.items.map((item, index) => (
                  <li key={index}>
                    <strong>
                      {loadoutWeaponName(item.name)} × {item.count ?? t("未知")}
                    </strong>
                    {!!item.parameters?.length && (
                      <dl className="wt-mount-weapon-parameters">
                        {item.parameters.map((p) => (
                          <div key={p.id}>
                            <dt>{p.label}</dt>
                            <dd>{loadoutParameterValue(p.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
