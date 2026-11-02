import type { WikiLoadoutOption } from "./models";
import { loadoutParameterValue } from "./loadout-presentation";
import { missileBrief } from "./loadout-weapon-details";
export function LoadoutWeaponBrief({ option }: { option: WikiLoadoutOption }) {
  const fields = missileBrief(option.parameters);
  return (
    <dl className="wt-mount-weapon-brief" aria-label="武器主要参数">
      {fields.map((field) => (
        <div key={field.id}>
          <dt className={field.id === "guidance" ? "sr-only" : undefined}>{field.label}</dt>
          <dd>{field.value ? loadoutParameterValue(field.value) : "未知"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function LoadoutWeaponDetails({ option }: { option: WikiLoadoutOption }) {
  return (
    <>
      <p className="wt-mount-source-name">来源名称：{option.name}</p>
      <dl className="wt-mount-weapon-parameters" aria-label="完整武器参数">
        {option.parameters.map((parameter) => (
          <div key={parameter.id}>
            <dt>{parameter.label}</dt>
            <dd>{loadoutParameterValue(parameter.value)}</dd>
          </div>
        ))}
      </dl>
      {!option.parameters.length && <p>来源未提供详细武器参数。</p>}
      {option.source && (
        <a href={option.source} target="_blank" rel="noopener noreferrer">
          查看官方 Wiki 来源 ↗
        </a>
      )}
    </>
  );
}
