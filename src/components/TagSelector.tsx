import { useLocale } from "../i18n/react";
import { t, localize } from "../i18n/core";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Modal } from "../Modal";
import { GameSelect } from "./GameSelect";
import { GameTag, gameTagChoiceGroups, gameTagTones, type GameTagTone } from "./GameTag";
import policy from "../../data/game-tag-access.json";
import "./tag-selector.css";
export type TagChoice = { id: string; tone: GameTagTone };
export type TagOption = {
  id: string;
  label: string;
  group: string;
  family?: "queue" | "vehicle" | "titles";
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
    ? t("绑定账号 {0} 级", rule.level)
    : tone === "king"
      ? t("100 级且历史战斗满 1000 次")
      : tone === "rainbow"
        ? t("超级管理员专属")
        : t("默认可选");
}
type Props = {
  options: readonly TagOption[];
  value: readonly TagChoice[];
  onChange: (value: TagChoice[]) => void;
  allowedTones?: readonly GameTagTone[];
  max?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  label?: string;
  scope?: "lineup" | "vehicle";
};
type Row = TagChoice & { key: string };
function TagFormDialog({
  options,
  value,
  onChange,
  allowedTones = freeTagTones,
  max = 5,
  loading = false,
  error = "",
  onRetry,
  close,
  label = t("标签"),
  scope = "lineup",
}: Props & { close: () => void }) {
  useLocale();
  const [viewport, setViewport] = useState(() => ({
    height: window.visualViewport?.height || window.innerHeight,
    top: window.visualViewport?.offsetTop || 0,
  }));
  useEffect(() => {
    const view = window.visualViewport;
    const update = () =>
      setViewport({ height: view?.height || window.innerHeight, top: view?.offsetTop || 0 });
    view?.addEventListener("resize", update);
    view?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      view?.removeEventListener("resize", update);
      view?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const [rows, setRows] = useState<Row[]>(() =>
    value.length
      ? value.map((choice) => ({ ...choice, key: crypto.randomUUID() }))
      : [{ key: crypto.randomUUID(), id: "", tone: "original" }],
  );
  const [active, setActive] = useState(() => rows[0]?.key || "");
  const [library, setLibrary] = useState<"queue" | "titles" | null>(null);
  const [query, setQuery] = useState({ queue: "", titles: "" });
  const uid = useId();
  const wordCategory = scope === "vehicle" ? "载具标签" : "队列标签";
  const row = rows.find((row) => row.key === active) || rows[0];
  const option = options.find((option) => option.id === row?.id);
  const update = (patch: Partial<TagChoice>) =>
    setRows(rows.map((item) => (item.key === row.key ? { ...item, ...patch } : item)));
  const filled = rows.filter((row) => row.id);
  const duplicates = filled.some(
    (row, index) => filled.findIndex((other) => other.id === row.id) !== index,
  );
  const invalid = filled.some(
    (row) =>
      !allowedTones.includes(row.tone) ||
      !options.some((option) => option.id === row.id && option.active !== false),
  );
  const canSave = !loading && !error && !duplicates && !invalid;
  const blank = rows.some((row) => !row.id);
  return (
    <div
      className="wt-tag-editor-host"
      style={
        {
          "--wt-tag-editor-height": `${viewport.height}px`,
          "--wt-tag-editor-top": `${viewport.top}px`,
        } as CSSProperties
      }
    >
      <Modal
        title={t("编辑{0}", label)}
        subtitle={t("最多 {0} 个 · 确认后应用", max)}
        close={close}
        className="wt-tag-form-dialog"
      >
        <div className="wt-tag-form-body">
          <section className="wt-tag-draft-section" aria-label={t("编辑中的标签列表")}>
            <div className="wt-tag-form-section-title">
              <strong>{t("已有标签")}</strong>
              <span>
                {filled.length} / {max}
              </span>
            </div>
            <div className="wt-tag-draft-list">
              {rows.map((item, index) => (
                <div key={item.key} data-active={item.key === row?.key}>
                  <button
                    type="button"
                    className="wt-tag-draft-item"
                    aria-label={t("编辑第 {0} 个标签", index + 1)}
                    aria-pressed={item.key === row?.key}
                    onClick={() => {
                      setActive(item.key);
                    }}
                  >
                    {item.id ? (
                      <GameTag tone={item.tone}>
                        {options.find((option) => option.id === item.id)?.label || item.id}
                      </GameTag>
                    ) : (
                      <span className="wt-tag-blank">{t("新标签")}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="wt-tag-row-remove"
                    aria-label={t("移除第 {0} 个标签", index + 1)}
                    onClick={() => {
                      const next = rows.filter((row) => row.key !== item.key);
                      setRows(next);
                      if (active === item.key) {
                        setActive(next[0]?.key || "");
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="wt-tag-add-row"
                disabled={rows.length >= max || blank}
                onClick={() => {
                  const item = {
                    key: crypto.randomUUID(),
                    id: "",
                    tone: "original" as GameTagTone,
                  };
                  setRows([...rows, item]);
                  setActive(item.key);
                  setLibrary("queue");
                }}
              >
                {t("＋ 添加标签")}
              </button>
            </div>
          </section>
          {row && (
            <>
              <section className="wt-tag-style-field" aria-label={t("标签样式")}>
                <h3>{t("标签样式")}</h3>
                <GameSelect
                  className="wt-tag-style-select"
                  aria-label={t("选择标签样式")}
                  value={row.tone}
                  onValueChange={(tone) => update({ tone: tone as GameTagTone })}
                  renderValue={(value) => (
                    <GameTag tone={value as GameTagTone}>
                      {gameTagTones[value as GameTagTone].label}
                    </GameTag>
                  )}
                  renderOption={({ value }) => {
                    const tone = value as GameTagTone;
                    return (
                      <span className="wt-tag-style-option">
                        <GameTag tone={tone}>{localize(gameTagTones[tone].label)}</GameTag>
                        {!allowedTones.includes(tone) && <small>{tagRequirement(tone)}</small>}
                      </span>
                    );
                  }}
                >
                  {[
                    { label: t("基础标签"), tones: freeTagTones },
                    { label: t("等级标签"), tones: gameTagChoiceGroups[2].tones },
                  ].map((group) => (
                    <optgroup key={group.label} label={localize(group.label)}>
                      {group.tones.map((tone) => (
                        <option key={tone} value={tone} disabled={!allowedTones.includes(tone)}>
                          {localize(gameTagTones[tone].label)}
                          {!allowedTones.includes(tone) ? ` · ${tagRequirement(tone)}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </GameSelect>
              </section>
              <section className="wt-tag-word-field" aria-label={t("标签文案")}>
                <h3>{t("文案")}</h3>
                <div className="wt-tag-word-libraries">
                  {(["queue", "titles"] as const).map((family) => {
                    const choices = options.filter(
                      (option) =>
                        option.active !== false &&
                        !option.system &&
                        (family === "titles"
                          ? option.family === "titles" || option.id.startsWith("official-title-")
                          : option.family !== "titles" && !option.id.startsWith("official-title-")),
                    );
                    const matches = choices.filter((option) =>
                      option.label
                        .toLocaleLowerCase()
                        .includes(query[family].trim().toLocaleLowerCase()),
                    );
                    const expanded = library === family;
                    return (
                      <div className="wt-tag-library" key={family} data-open={expanded}>
                        <h4>
                          <button
                            type="button"
                            id={`${uid}-${family}-trigger`}
                            aria-expanded={expanded}
                            aria-controls={`${uid}-${family}-body`}
                            onClick={() => setLibrary(expanded ? null : family)}
                          >
                            <span>{family === "queue" ? t(wordCategory) : t("官方称号")}</span>
                            <small>
                              {choices.length} {t("个文案")}
                            </small>
                            <span aria-hidden="true">⌄</span>
                          </button>
                        </h4>
                        <section
                          className="wt-tag-library-reveal"
                          id={`${uid}-${family}-body`}
                          aria-labelledby={`${uid}-${family}-trigger`}
                          inert={!expanded}
                        >
                          <div>
                            <div className="wt-tag-library-body">
                              <label className="wt-tag-search">
                                <span>
                                  {t("搜索")}
                                  {family === "queue" ? t(wordCategory) : t("官方称号")}
                                </span>
                                <input
                                  type="search"
                                  value={query[family]}
                                  placeholder={t("输入关键词筛选")}
                                  onChange={(event) =>
                                    setQuery({ ...query, [family]: event.target.value })
                                  }
                                />
                              </label>
                              <div className="wt-tag-plain-options">
                                {matches.map((choice) => {
                                  const used = rows.some(
                                    (other) => other.key !== row.key && other.id === choice.id,
                                  );
                                  return (
                                    <button
                                      type="button"
                                      key={choice.id}
                                      aria-pressed={row.id === choice.id}
                                      disabled={loading || !!error || used}
                                      title={used ? t("已用于其他标签") : localize(choice.label)}
                                      onClick={() => update({ id: choice.id })}
                                    >
                                      <span>{localize(choice.label)}</span>
                                      <span aria-hidden="true">
                                        {row.id === choice.id ? "✓" : ""}
                                      </span>
                                    </button>
                                  );
                                })}
                                {!matches.length && (
                                  <p className="wt-tag-empty">
                                    {loading ? t("正在读取文案…") : t("没有匹配的文案")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    );
                  })}
                </div>
              </section>
              {option?.sourceUrl && (
                <a
                  className="wt-tag-source"
                  href={option.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("文案出处：")}
                  {option.sourceTitle || option.label} ↗
                  {option.sourceNote ? ` · ${option.sourceNote}` : ""}
                </a>
              )}
            </>
          )}
          <div className="wt-tag-form-status" aria-live="polite">
            {loading ? (
              <output>{t("正在读取标签文案…")}</output>
            ) : error ? (
              <>
                <span>{t("文案读取失败，请重试。")}</span>
                <button type="button" onClick={onRetry}>
                  {t("重试")}
                </button>
              </>
            ) : invalid ? (
              <span>{t("部分文案已移除或样式未解锁，请重新选择。")}</span>
            ) : duplicates ? (
              <span>{t("同一文案只能添加一次。")}</span>
            ) : (
              <span>{t("文案与样式独立选择，取消不会保存本次修改。")}</span>
            )}
          </div>
        </div>
        <footer className="wt-tag-form-footer">
          <span>
            {filled.length} {t("个标签")}
          </span>
          <button type="button" className="quiet-button" onClick={close}>
            {t("取消")}
          </button>
          <button
            type="button"
            className="quiet-button calc-open"
            disabled={!canSave}
            onClick={() => {
              const next = filled.map(({ id, tone }) => ({ id, tone }));
              if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
              close();
            }}
          >
            {t("确认标签")}
          </button>
        </footer>
      </Modal>
    </div>
  );
}
/** A controlled form field. All edits are local to the dialog until confirmation. */
export function TagSelector({ label = t("标签"), ...props }: Props) {
  useLocale();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  const uid = useId();
  const { value, options, disabled = false, loading = false, error = "", max = 5 } = props;
  return (
    <div
      className="wt-tag-selector wt-tag-form-field"
      data-state={loading ? "loading" : error ? "error" : value.length ? "success" : "default"}
    >
      <div className="wt-tag-field-label" id={uid}>
        <strong>{label}</strong>
        <span>
          {value.length} / {max}
        </span>
      </div>
      <button
        type="button"
        ref={trigger}
        className="wt-tag-field-control"
        aria-label={t("编辑{0}", label)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="wt-tag-field-values" aria-label={t("已有标签列表")}>
          {value.length ? (
            value.map((choice) => (
              <GameTag key={choice.id} tone={choice.tone}>
                {options.find((option) => option.id === choice.id)?.label || choice.id}
              </GameTag>
            ))
          ) : (
            <span className="wt-tag-empty">{t("暂无标签，点击选择")}</span>
          )}
        </span>
        <span className="wt-tag-field-edit">
          {t("编辑")}
          <span aria-hidden="true">›</span>
        </span>
      </button>
      {loading && <output className="wt-tag-field-note">{t("正在读取文案…")}</output>}
      {error && <span className="wt-tag-field-note">{t("文案读取失败，可打开编辑后重试。")}</span>}
      {open && <TagFormDialog {...props} label={label} close={close} />}
    </div>
  );
}
