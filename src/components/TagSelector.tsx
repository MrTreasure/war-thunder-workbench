import { useId, useState } from "react";
import { GameTag, gameTagChoiceGroups, gameTagTones, type GameTagTone } from "./GameTag";
import policy from "../../data/game-tag-access.json";
import "./tag-selector.css";
export type TagChoice = { id: string; tone: GameTagTone };
export type TagOption = {
  id: string;
  label: string;
  group: string;
  family?: "queue" | "titles";
  sourceUrl?: string;
  sourceTitle?: string;
  sourceNote?: string;
  active?: boolean;
  system?: boolean;
  scopes?: string[];
  revision?: number;
};
export const freeTagTones = gameTagChoiceGroups.slice(0, 2).flatMap((group) => group.tones);
export function tagRequirement(tone: GameTagTone) {
  const rule = policy.levels.find((rule) => rule.tone === tone);
  return rule
    ? `绑定账号 ${rule.level} 级`
    : tone === "king"
      ? "100 级且历史战斗满 1000 次"
      : tone === "rainbow"
        ? "超级管理员专属"
        : "默认可选";
}
function Check({ checked }: { checked: boolean }) {
  return (
    <span className="wt-tag-check" data-checked={checked} aria-hidden="true">
      {checked ? "✓" : "+"}
    </span>
  );
}
/** Controlled selector. Both text libraries start collapsed; styling is a separate action. */
export function TagSelector({
  options,
  value,
  onChange,
  allowedTones = freeTagTones,
  max = 3,
  disabled = false,
  loading = false,
  error = "",
  onRetry,
}: {
  options: readonly TagOption[];
  value: readonly TagChoice[];
  onChange: (value: TagChoice[]) => void;
  allowedTones?: readonly GameTagTone[];
  max?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const uid = useId();
  const [active, setActive] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [nextTone, setNextTone] = useState<GameTagTone>("original");
  const [query, setQuery] = useState({ queue: "", titles: "" });
  const [group, setGroup] = useState("全部");
  const current = value.find((item) => item.id === active) || value.at(-1);
  const tone = current?.tone ?? (allowedTones.includes(nextTone) ? nextTone : "original");
  const currentOption = options.find((option) => option.id === current?.id);
  const optionFamily = (option: TagOption) =>
    option.family || (option.id.startsWith("official-title-") ? "titles" : "queue");
  const groupOrder = ["推荐", "战术", "机动", "火力", "协同", "构成"];
  const orderedOptions = [...options].sort((a, b) => {
    const ai = groupOrder.indexOf(a.group),
      bi = groupOrder.indexOf(b.group);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const choose = (option: TagOption) => {
    const existing = value.find((item) => item.id === option.id);
    if (existing && max > 1) {
      onChange(value.filter((item) => item.id !== option.id));
      if (active === option.id) setActive(null);
      return;
    }
    setActive(option.id);
    if (!existing) {
      const choice = {
        id: option.id,
        tone: allowedTones.includes(nextTone) ? nextTone : ("original" as GameTagTone),
      };
      onChange(max === 1 ? [choice] : [...value, choice]);
    }
  };
  const styleChoice = (id: GameTagTone) => {
    setNextTone(id);
    if (current)
      onChange(value.map((item) => (item.id === current.id ? { ...item, tone: id } : item)));
  };
  const busy = disabled || loading || !!error;
  return (
    <div
      className="wt-tag-selector"
      aria-label="标签选择器"
      aria-busy={loading}
      data-state={loading ? "loading" : error ? "error" : value.length ? "success" : "default"}
    >
      <div className="wt-tag-selection-heading">
        <strong>{max === 1 ? "选择一个标签" : "已选标签"}</strong>
        <span>
          {value.length} / {max}
        </span>
      </div>
      <div className="wt-tag-selected" aria-label="已选标签">
        {value.length ? (
          value.map((choice) => (
            <div
              className="wt-tag-selected-item"
              key={choice.id}
              data-active={current?.id === choice.id}
            >
              <button
                type="button"
                className="wt-tag-edit"
                aria-label={`调整${options.find((option) => option.id === choice.id)?.label || choice.id}样式`}
                aria-pressed={current?.id === choice.id}
                disabled={busy}
                onClick={() => {
                  setActive(choice.id);
                  setStyleOpen(true);
                }}
              >
                <GameTag tone={choice.tone}>
                  {options.find((option) => option.id === choice.id)?.label || choice.id}
                </GameTag>
              </button>
              <button
                type="button"
                className="wt-tag-remove"
                aria-label={`移除${options.find((option) => option.id === choice.id)?.label || choice.id}`}
                disabled={busy}
                onClick={() => {
                  onChange(value.filter((item) => item.id !== choice.id));
                  if (active === choice.id) setActive(null);
                }}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <span className="wt-tag-empty">展开下方分类，选择喜欢的文案</span>
        )}
      </div>
      <div className="wt-tag-style-bar">
        <span>{current ? `「${currentOption?.label || "当前标签"}」的样式` : "新标签样式"}</span>
        <span className="wt-tag-current-tone">{gameTagTones[tone].label}</span>
        <button
          type="button"
          disabled={busy}
          aria-expanded={styleOpen}
          aria-controls={`${uid}-styles`}
          onClick={() => setStyleOpen(!styleOpen)}
        >
          {styleOpen ? "完成换样式" : "更换样式"}
          <span aria-hidden="true">{styleOpen ? "⌃" : "⌄"}</span>
        </button>
      </div>
      {styleOpen && (
        <section className="wt-tag-style-panel" id={`${uid}-styles`} aria-label="选择标签样式">
          {gameTagChoiceGroups.map((category) => {
            const available = category.tones.filter((id) => allowedTones.includes(id));
            if (!available.length) return null;
            return (
              <fieldset key={category.label}>
                <legend>{category.label}</legend>
                <div className="wt-tag-style-options">
                  {available.map((id) => (
                    <div className="wt-tag-style-option" key={id} data-selected={tone === id}>
                      <GameTag
                        tone={id}
                        selected={tone === id}
                        disabled={busy}
                        onClick={() => styleChoice(id)}
                      >
                        {gameTagTones[id].label}
                      </GameTag>
                      {tone === id && <span aria-hidden="true">✓</span>}
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {gameTagChoiceGroups
            .flatMap((group) => group.tones)
            .some((id) => !allowedTones.includes(id)) && (
            <details className="wt-tag-locked">
              <summary>查看未解锁样式</summary>
              <div>
                {gameTagChoiceGroups
                  .flatMap((group) => group.tones)
                  .filter((id) => !allowedTones.includes(id))
                  .map((id) => (
                    <div key={id}>
                      <GameTag tone={id} disabled onClick={() => {}}>
                        {gameTagTones[id].label}
                      </GameTag>
                      <small>{tagRequirement(id)}</small>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </section>
      )}
      <div className="wt-tag-selector-status">
        <output aria-live="polite">
          {loading
            ? "正在读取标签文案…"
            : error
              ? "标签文案暂时未能读取。请重试。"
              : max === 1
                ? "点击其他文案可直接替换；样式可单独更换。"
                : value.length >= max
                  ? "已选满，可先移除一个再添加。"
                  : "点击文案添加，再次点击可移除。"}
        </output>
        {error && onRetry && (
          <button type="button" onClick={onRetry}>
            重试
          </button>
        )}
      </div>
      {(["queue", "titles"] as const).map((family) => {
        const familyOptions = orderedOptions.filter(
          (option) => option.active !== false && !option.system && optionFamily(option) === family,
        );
        const matches = familyOptions.filter(
          (option) =>
            (group === "全部" || family !== "queue" || option.group === group) &&
            option.label.toLocaleLowerCase().includes(query[family].trim().toLocaleLowerCase()),
        );
        return (
          <details className="wt-tag-library" key={family}>
            <summary>
              <span>{family === "queue" ? "队列标签" : "官方称号"}</span>
              <small>{familyOptions.length} 个文案</small>
              <span className="wt-tag-disclosure" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div className="wt-tag-library-body">
              <label className="wt-tag-search" htmlFor={`${uid}-${family}`}>
                <span className="wt-tag-search-label">
                  搜索{family === "queue" ? "队列标签" : "官方称号"}
                </span>
                <input
                  id={`${uid}-${family}`}
                  type="search"
                  value={query[family]}
                  disabled={busy}
                  placeholder={
                    family === "queue" ? "例如：机动、抗线、均衡" : "例如：坦克大师、钢铁之躯"
                  }
                  onChange={(event) => setQuery({ ...query, [family]: event.target.value })}
                />
              </label>
              {family === "queue" && (
                <div className="wt-tag-category-filter" aria-label="队列标签分组">
                  {["全部", ...new Set(familyOptions.map((option) => option.group))].map(
                    (label) => (
                      <button
                        type="button"
                        key={label}
                        aria-pressed={group === label}
                        disabled={busy}
                        onClick={() => setGroup(label)}
                      >
                        {label.replace(/^队列 · /, "")}
                      </button>
                    ),
                  )}
                </div>
              )}
              <div className="wt-tag-option-scroll">
                {matches.length ? (
                  matches.map((option) => {
                    const choice = value.find((item) => item.id === option.id);
                    const full = !choice && max > 1 && value.length >= max;
                    return (
                      <button
                        className="wt-tag-option"
                        type="button"
                        key={option.id}
                        title={option.label}
                        aria-label={option.label}
                        aria-pressed={!!choice}
                        disabled={busy || full}
                        onClick={() => choose(option)}
                      >
                        <GameTag
                          tone={
                            choice?.tone ||
                            (allowedTones.includes(nextTone) ? nextTone : "original")
                          }
                        >
                          {option.label}
                        </GameTag>
                        <Check checked={!!choice} />
                      </button>
                    );
                  })
                ) : (
                  <div className="wt-tag-no-results">
                    <strong>{loading ? "正在读取文案" : "没有找到相关文案"}</strong>
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery({ ...query, [family]: "" });
                          setGroup("全部");
                        }}
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
        );
      })}
      {currentOption?.sourceUrl && (
        <a
          className="wt-tag-source"
          href={currentOption.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          文案出处：{currentOption.sourceTitle || currentOption.label} ↗
          {currentOption.sourceNote ? ` · ${currentOption.sourceNote}` : ""}
        </a>
      )}
    </div>
  );
}
