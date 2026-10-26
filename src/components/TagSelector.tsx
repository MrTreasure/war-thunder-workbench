import { useId, useState } from "react";
import { GameTag, gameTagChoiceGroups, gameTagTones, type GameTagTone } from "./GameTag";
import policy from "../../data/game-tag-access.json";
import "./tag-selector.css";
export type TagChoice = { id: string; tone: GameTagTone };
export type TagOption = {
  id: string;
  label: string;
  group: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceNote?: string;
};
export const freeTagTones = gameTagChoiceGroups.slice(0, 2).flatMap((group) => group.tones);
export function tagRequirement(tone: GameTagTone) {
  const rule = policy.levels.find((rule) => rule.tone === tone);
  return rule
    ? `绑定游戏账号 · ${rule.level} 级`
    : tone === "king"
      ? "100 级 · 历史战斗满 1000 次"
      : tone === "rainbow"
        ? "现有超级管理员权限"
        : "默认可选";
}
/** Controlled, account-independent selector. Callers provide trusted eligibility and options. */
export function TagSelector({
  options,
  value,
  onChange,
  allowedTones = freeTagTones,
  max = 3,
  disabled = false,
}: {
  options: readonly TagOption[];
  value: readonly TagChoice[];
  onChange: (value: TagChoice[]) => void;
  allowedTones?: readonly GameTagTone[];
  max?: number;
  disabled?: boolean;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [nextTone, setNextTone] = useState<GameTagTone>("original");
  const current = value.find((item) => item.id === active);
  const tone = current?.tone ?? (allowedTones.includes(nextTone) ? nextTone : "original");
  const selected = options.find((option) => option.id === active);
  const matches = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div className="wt-tag-selector" aria-label="标签选择器">
      <div className="wt-tag-selected" aria-label="已选标签">
        <span>
          已选 {value.length}/{max}
        </span>
        {value.map((choice) => (
          <div key={choice.id}>
            <GameTag
              tone={choice.tone}
              selected={active === choice.id}
              disabled={disabled}
              onClick={() => setActive(choice.id)}
            >
              {options.find((option) => option.id === choice.id)?.label || choice.id}
            </GameTag>
            <button
              type="button"
              disabled={disabled}
              aria-label={`移除${options.find((option) => option.id === choice.id)?.label || choice.id}`}
              onClick={() => {
                onChange(value.filter((item) => item.id !== choice.id));
                if (active === choice.id) setActive(null);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="wt-tag-selector-columns">
        <section>
          <label htmlFor={`${uid}-search`}>选择文案</label>
          <input
            id={`${uid}-search`}
            type="search"
            placeholder="搜索称号或队列文案"
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="wt-tag-option-scroll">
            {[...new Set(matches.map((option) => option.group))].map((group) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {matches
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={value.some((item) => item.id === option.id)}
                      disabled={
                        disabled ||
                        (!value.some((item) => item.id === option.id) && value.length >= max)
                      }
                      onClick={() => {
                        setActive(option.id);
                        if (!value.some((item) => item.id === option.id))
                          onChange([
                            ...value,
                            {
                              id: option.id,
                              tone: allowedTones.includes(nextTone) ? nextTone : "original",
                            },
                          ]);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
              </fieldset>
            ))}
            {!matches.length && <p>没有匹配的文案</p>}
          </div>
          {selected?.sourceUrl && (
            <a className="wt-tag-source" href={selected.sourceUrl} target="_blank" rel="noreferrer">
              出处：{selected.sourceTitle || selected.label} ↗
              {selected.sourceNote ? ` · ${selected.sourceNote}` : ""}
            </a>
          )}
        </section>
        <section>
          <h4>{current ? `为「${selected?.label || "当前标签"}」选择样式` : "选择新标签的样式"}</h4>
          {gameTagChoiceGroups.map((group) => (
            <fieldset key={group.label}>
              <legend>{group.label}</legend>
              <div className="wt-tag-style-options">
                {group.tones.map((id) => (
                  <div key={id} title={tagRequirement(id)}>
                    <GameTag
                      tone={id}
                      selected={tone === id}
                      disabled={disabled || !allowedTones.includes(id)}
                      onClick={() => {
                        setNextTone(id);
                        if (current)
                          onChange(
                            value.map((item) =>
                              item.id === current.id ? { ...item, tone: id } : item,
                            ),
                          );
                      }}
                    >
                      {gameTagTones[id].label}
                    </GameTag>
                    {!allowedTones.includes(id) && <small>{tagRequirement(id)}</small>}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      </div>
      <details>
        <summary>材质解锁规则</summary>
        <p>
          绑定游戏账号后，青铜 1 级、白银 25 级、黄金 50 级、翡翠 75 级、钻石 100
          级，逐级保留。王者额外需要历史战斗满 1000
          次。七彩仅供现有超级管理员选择。称号文案不代表游戏内已获得该称号。
        </p>
      </details>
    </div>
  );
}
