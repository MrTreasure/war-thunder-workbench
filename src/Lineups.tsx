import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogIndex, CountryPayload, Mode } from "./models";
import type { DownloadProgress } from "./data-loader";
import { LineupRoster } from "./LineupRoster";
import { Modal } from "./Modal";
import { rankNumber } from "./planner";
import { WarThunderLoading } from "./Loading";
import { useStored } from "./storage";
import { modes } from "./TreeCanvas";
import {
  brLabel,
  decodeLineup,
  encodeLineup,
  inferBattle,
  lineupIndex,
  lineupVehicleKind,
  lineupRatings,
  shareCountry,
  validLineups,
  vehicleStep,
} from "./lineups";
import type { BattleType, Lineup } from "./lineups";
const battleNames: Record<BattleType, string> = { air: "空战", ground: "陆战", naval: "海战" };
export function Lineups({
  catalog,
  country,
  payload,
  chooseCountry,
  defaultBattle,
  mode,
  setMode,
  progress,
  error,
  retry,
}: {
  catalog: CatalogIndex;
  country: string;
  payload: CountryPayload | null;
  chooseCountry: (country: string) => void;
  defaultBattle: BattleType;
  mode: Mode;
  setMode: (mode: Mode) => void;
  progress: DownloadProgress;
  error?: string;
  retry: () => void;
}) {
  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (importOpen) importInput.current?.focus();
  }, [importOpen]);
  const [pending, setPending] = useState<{ country: string; code: string } | null>(null);
  const [importError, setImportError] = useState("");
  return (
    <main className="lineup-page">
      <header className="lineup-page-header">
        <div>
          <h1>出击队列</h1>
          <p>按国家保存多个队列 · 长按拖动乘员槽位</p>
        </div>
        <a className="quiet-button" href="#/tree">
          ← 返回研发树
        </a>
      </header>
      <div className="lineup-entry">
        <label className="calc-field">
          国家
          <select value={country} onChange={(e) => chooseCountry(e.target.value)}>
            <option value="" disabled>
              选择国家
            </option>
            {Object.entries(catalog.countries).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="lineup-entry-actions">
          <button
            className="quiet-button"
            onClick={() => {
              setImportError("");
              setPending(null);
              setImportOpen(true);
            }}
          >
            导入队列
          </button>
        </div>
      </div>
      {importOpen && (
        <Modal
          className="lineup-import-dialog"
          title="导入出击队列"
          subtitle="粘贴分享码后预览，确认后保存为新队列。区分大小写。"
          close={() => setImportOpen(false)}
        >
          <form
            className="lineup-import"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const target = shareCountry(importText, catalog.lineup);
                setPending({ country: target, code: importText.trim() });
                setImportError("");
                setImportOpen(false);
                if (target !== country) chooseCountry(target);
              } catch (cause) {
                setImportError(cause instanceof Error ? cause.message : "分享码读取失败。");
                setPending(null);
              }
            }}
          >
            <label className="calc-field">
              导入分享码（区分大小写）
              <input
                ref={importInput}
                autoComplete="off"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError("");
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`${2 + catalog.lineup.maxSlots * 2} 位分享码，含空槽位`}
                aria-invalid={Boolean(importError)}
                aria-describedby={importError ? "lineup-import-error" : undefined}
              />
            </label>
            <button type="submit" className="quiet-button" disabled={!importText.trim()}>
              预览导入
            </button>
          </form>
          {importError && (
            <p className="lineup-feedback is-error" role="alert" id="lineup-import-error">
              {importError}
            </p>
          )}
        </Modal>
      )}
      {pending && (!payload || payload.country !== pending.country) && (
        <Modal
          className="lineup-import-dialog"
          title="导入出击队列"
          subtitle={`读取${catalog.countries[pending.country]}资料后预览`}
          close={() => setPending(null)}
        >
          <WarThunderLoading
            compact
            title="载入队列资料"
            progress={progress}
            error={error}
            retry={error ? retry : undefined}
          />
        </Modal>
      )}
      {!country ? (
        <div className="lineup-empty">
          <h3>先选择一个国家</h3>
          <p>也可以点击“导入队列”，使用分享码自动选择国家。</p>
        </div>
      ) : !payload || payload.country !== country ? (
        <WarThunderLoading
          compact
          title={`载入${catalog.countries[country]}全部载具资料`}
          progress={progress}
          error={error}
          retry={error ? retry : undefined}
        />
      ) : (
        <CountryLineups
          key={country}
          {...{ catalog, country, payload, mode, setMode, defaultBattle }}
          imported={pending?.country === country ? pending.code : null}
          dismissImport={() => setPending(null)}
          editImport={() => {
            setPending(null);
            setImportError("");
            setImportOpen(true);
          }}
        />
      )}
    </main>
  );
}
function CountryLineups({
  catalog,
  country,
  payload,
  mode,
  setMode,
  imported,
  dismissImport,
  editImport,
  defaultBattle,
}: {
  catalog: CatalogIndex;
  country: string;
  payload: CountryPayload;
  mode: Mode;
  setMode: (mode: Mode) => void;
  defaultBattle: BattleType;
  imported: string | null;
  dismissImport: () => void;
  editImport: () => void;
}) {
  const rules = catalog.lineup;
  const [saved, save, storageError] = useStored<Lineup[]>(
    `wt-lineups-v1:${country}`,
    [],
    (v): v is Lineup[] => validLineups(v, rules.maxSlots),
  );
  const [selectedId, setSelectedId] = useState(saved[0]?.id || "");
  const selected = saved.find((row) => row.id === selectedId) || saved[0];
  const [activeSlot, setActiveSlot] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(
    defaultBattle === "air" ? "aviation" : defaultBattle === "ground" ? "ground" : "all",
  );
  const [rank, setRank] = useState("all");
  const [kind, setKind] = useState("all");
  const [deleting, setDeleting] = useState("");
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const shareCode = useRef<HTMLElement>(null);
  const units = useMemo(() => lineupIndex(payload), [payload]);
  const all = [...units.values()];
  const ranks = useMemo(
    () =>
      [...new Set([...units.values()].map((unit) => unit.rank))].sort(
        (a, b) => rankNumber(a) - rankNumber(b),
      ),
    [units],
  );
  const preview = useMemo(() => {
    if (!imported) return null;
    try {
      const slots = decodeLineup(imported, country, payload.lineupCodes, rules);
      const unavailable = slots.filter((id) => id && !units.has(id));
      if (unavailable.length)
        return {
          error: `当前资料没有 ${unavailable.join("、")}，请更新资料后再导入。`,
          slots: null,
        };
      return { slots, error: "" };
    } catch (cause) {
      return {
        slots: null,
        error: cause instanceof Error ? cause.message : "导入失败，请检查分享码。",
      };
    }
  }, [imported, country, payload.lineupCodes, rules, units]);
  const share = useMemo(() => {
    if (!selected) return { code: "", error: "" };
    try {
      return { code: encodeLineup(country, selected.slots, payload.lineupCodes, rules), error: "" };
    } catch (cause) {
      return { code: "", error: cause instanceof Error ? cause.message : "无法导出分享码。" };
    }
  }, [selected, country, payload.lineupCodes, rules]);
  const ratings = selected ? lineupRatings(selected, units, rules) : [];
  function update(patch: Partial<Lineup>) {
    if (!selected) return;
    save(saved.map((row) => (row.id === selected.id ? { ...row, ...patch } : row)));
    setMessage("");
  }
  function create(
    slots: (string | null)[] = Array.from({ length: rules.maxSlots }, () => null),
    name?: string,
    type?: BattleType,
    activeAircraft?: string | null,
  ) {
    const firstAircraft = slots.find((id) => id && units.get(id)?.category === "aviation") || null;
    const lineup: Lineup = {
      id: crypto.randomUUID(),
      name: name || `队列 ${saved.length + 1}`,
      slots,
      battleType: type || (slots.some(Boolean) ? inferBattle(slots, units) : defaultBattle),
      activeAircraft: activeAircraft === undefined ? firstAircraft : activeAircraft,
    };
    save([...saved, lineup]);
    setSelectedId(lineup.id);
    setCategory(
      lineup.battleType === "air" ? "aviation" : lineup.battleType === "ground" ? "ground" : "all",
    );
    setActiveSlot(0);
    setDeleting("");
    setMessage("");
  }
  function place(id: string | null) {
    if (!selected) return;
    const slots = [...selected.slots];
    slots[activeSlot] = id;
    const aircraft = slots.filter((uid) => uid && units.get(uid)?.category === "aviation");
    update({
      slots,
      activeAircraft: aircraft.includes(selected.activeAircraft)
        ? selected.activeAircraft
        : aircraft[0] || null,
    });
    if (id) {
      const next = slots.findIndex((uid, i) => i > activeSlot && !uid);
      if (next >= 0) setActiveSlot(next);
    }
  }
  const needle = search.normalize("NFKC").toLowerCase().replaceAll(" ", "");
  const candidates = all.filter(
    (unit) =>
      (category === "all" || unit.category === category) &&
      (rank === "all" || unit.rank === rank) &&
      (kind === "all" || (kind === "premium" ? unit.premium : lineupVehicleKind(unit) === kind)) &&
      `${unit.name}${unit.nameEn || ""}${unit.id}`
        .normalize("NFKC")
        .toLowerCase()
        .replaceAll(" ", "")
        .includes(needle),
  );
  return (
    <>
      {storageError && (
        <p className="lineup-feedback is-error" role="alert">
          {storageError}
        </p>
      )}
      {preview && (
        <Modal
          className="lineup-import-dialog"
          title={`导入预览 · ${catalog.countries[country]}`}
          subtitle="核对载具与空位，保存后会新增一个队列。"
          close={dismissImport}
        >
          <div className="lineup-import-preview">
            {preview.error ? (
              <div>
                <p role="alert" className="lineup-feedback is-error">
                  {preview.error}
                </p>
                <button className="quiet-button" onClick={editImport}>
                  修改分享码
                </button>
              </div>
            ) : (
              <>
                <ol className="lineup-import-slots">
                  {preview.slots!.map((id, i) => (
                    <li key={i}>
                      <span>{i + 1}</span>
                      {id ? units.get(id)?.name || id : "空位"}
                    </li>
                  ))}
                </ol>
                <p className="calc-note">
                  分享码只包含国家和槽位顺序。导入后可修改名称、战斗类型及空战 RB 出击飞机。
                </p>
                <button
                  className="quiet-button calc-open"
                  onClick={() => {
                    create(preview.slots!, `导入队列 ${saved.length + 1}`);
                    dismissImport();
                  }}
                >
                  保存为新队列
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      <div className="lineup-workspace">
        <aside className="lineup-sidebar" aria-label="已保存的出击队列">
          <div className="lineup-section-heading">
            <h3>
              我的队列 <small>{saved.length}</small>
            </h3>
            <button className="quiet-button" onClick={() => create()}>
              ＋ 新建
            </button>
          </div>
          <div className="lineup-presets">
            {saved.map((row) => (
              <button
                className="lineup-preset"
                key={row.id}
                aria-pressed={selected?.id === row.id}
                onClick={() => {
                  setSelectedId(row.id);
                  setDeleting("");
                  setMessage("");
                }}
              >
                <strong>{row.name || "未命名队列"}</strong>
                <small>
                  {battleNames[row.battleType]} · {row.slots.filter(Boolean).length} /{" "}
                  {rules.maxSlots} 辆
                </small>
              </button>
            ))}
          </div>
          {!saved.length && <p className="calc-note">尚无队列。新建一个，或从分享码导入。</p>}
        </aside>
        {!selected ? (
          <div className="lineup-empty">
            <h3>配置你的出击队列</h3>
            <p>每个国家可以保存多个队列，每队最多 {rules.maxSlots} 辆。</p>
            <button className="quiet-button calc-open" onClick={() => create()}>
              新建队列
            </button>
          </div>
        ) : (
          <section className="lineup-editor" aria-label="队列配置">
            <div className="lineup-editor-heading">
              <label className="calc-field">
                队列名称
                <input
                  value={selected.name}
                  maxLength={80}
                  onChange={(e) => update({ name: e.target.value })}
                  onBlur={() => {
                    if (!selected.name.trim()) update({ name: "未命名队列" });
                  }}
                />
              </label>
              <label className="calc-field">
                战斗类型
                <select
                  value={selected.battleType}
                  onChange={(e) => update({ battleType: e.target.value as BattleType })}
                >
                  {Object.entries(battleNames).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="quiet-button"
                onClick={() =>
                  create(
                    [...selected.slots],
                    `${selected.name.slice(0, 74)} 副本`,
                    selected.battleType,
                    selected.activeAircraft,
                  )
                }
              >
                复制队列
              </button>
              <button className="quiet-button" onClick={() => setDeleting(selected.id)}>
                删除
              </button>
            </div>
            {deleting === selected.id && (
              <div className="lineup-delete" role="alert">
                <span>删除“{selected.name || "未命名队列"}”？</span>
                <button
                  className="quiet-button"
                  onClick={() => {
                    save(saved.filter((row) => row.id !== selected.id));
                    setDeleting("");
                  }}
                >
                  确认删除
                </button>
                <button className="quiet-button" onClick={() => setDeleting("")}>
                  保留队列
                </button>
              </div>
            )}
            <div className="lineup-configure">
              <section className="lineup-roster" aria-label="乘员槽位">
                <div className="lineup-section-heading">
                  <h3>
                    乘员槽位{" "}
                    <small>
                      {selected.slots.filter(Boolean).length} / {rules.maxSlots}
                    </small>
                  </h3>
                  <label className="lineup-inline-label">
                    查看权重
                    <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                      {Object.entries(modes).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label} {id.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="calc-note">
                  点击槽位后在下方选车；拖动柄按住即可排序，卡片长按后拖动、短划横向浏览；Alt + ← /
                  → 也可排序。
                  {selected.battleType === "air"
                    ? "RB 只计算标为出击的飞机。"
                    : "权重按所选战斗类型计算。"}
                </p>
                <LineupRoster
                  key={selected.id}
                  slots={selected.slots}
                  units={units}
                  activeSlot={activeSlot}
                  selectSlot={setActiveSlot}
                  battleType={selected.battleType}
                  activeAircraft={selected.activeAircraft}
                  mode={mode}
                  categories={catalog.categories}
                  reorder={(slots, active) => {
                    update({ slots });
                    setActiveSlot(active);
                  }}
                  chooseAircraft={(id) => update({ activeAircraft: id })}
                  clear={(index) => {
                    const slots = [...selected.slots];
                    const id = slots[index];
                    slots[index] = null;
                    update({
                      slots,
                      activeAircraft:
                        selected.activeAircraft === id
                          ? slots.find((uid) => uid && units.get(uid)?.category === "aviation") ||
                            null
                          : selected.activeAircraft,
                    });
                  }}
                />
              </section>
              <div className="lineup-ratings" aria-label="不同模式的队列权重">
                {ratings.map((value) => (
                  <div key={value.mode} className="lineup-rating">
                    <span>
                      {modes[value.mode]} {value.mode.toUpperCase()}
                    </span>
                    <strong>{value.label}</strong>
                    <p>{value.note}</p>
                    {value.excluded.length > 0 && (
                      <details>
                        <summary>{value.excluded.length} 辆不参与此模式计算</summary>
                        <p>{value.excluded.map((id) => units.get(id)?.name || id).join("、")}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              <section className="lineup-picker" aria-label="载具选择">
                <h3>为槽位 {activeSlot + 1} 选择载具</h3>
                <label className="calc-field">
                  当前槽位
                  <select
                    value={activeSlot}
                    onChange={(e) => setActiveSlot(Number(e.target.value))}
                  >
                    {selected.slots.map((id, i) => (
                      <option key={i} value={i}>
                        {i + 1} · {id ? units.get(id)?.name || id : "空槽位"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="quiet-button"
                  disabled={!selected.slots[activeSlot]}
                  onClick={() => place(null)}
                >
                  清空当前槽位
                </button>
                <label className="calc-field">
                  搜索型号
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="中文、英文或载具 ID"
                  />
                </label>
                <label className="calc-field">
                  军种
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">全部军种</option>
                    {Object.entries(catalog.categories).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="calc-field">
                  等级
                  <select value={rank} onChange={(e) => setRank(e.target.value)}>
                    <option value="all">全部 Rank</option>
                    {ranks.map((value) => (
                      <option key={value} value={value}>
                        Rank {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="calc-field">
                  载具类型
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="all">全部类型</option>
                    {Object.entries(catalog.lineupKinds).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="calc-note">
                  {candidates.length} 辆匹配
                  {candidates.length > 100 ? "，显示前 100 辆，请搜索缩小范围" : ""}
                </p>
                <div className="lineup-candidates">
                  {candidates.slice(0, 100).map((unit) => {
                    const occupied = selected.slots.includes(unit.id);
                    return (
                      <button
                        key={unit.id}
                        className={`lineup-candidate is-kind-${lineupVehicleKind(unit)}`}
                        disabled={occupied}
                        onClick={() => place(unit.id)}
                      >
                        <img src={unit.thumbnailUrl} width={64} height={38} alt="" loading="lazy" />
                        <span>
                          <strong>{unit.name}</strong>
                          <span className="lineup-vehicle-tags">
                            <span className={`lineup-kind-tag is-kind-${lineupVehicleKind(unit)}`}>
                              {catalog.lineupKinds[lineupVehicleKind(unit)]}
                            </span>
                            {unit.premium && ["pack", "market"].includes(unit.kind) && (
                              <span className="lineup-kind-tag is-kind-premium">
                                {catalog.lineupKinds.premium}
                              </span>
                            )}
                          </span>
                          <small>
                            {catalog.categories[unit.category]} · Rank {unit.rank}
                          </small>
                        </span>
                        <b>
                          {occupied
                            ? "已配置"
                            : brLabel(vehicleStep(unit, selected.battleType, mode))}
                        </b>
                      </button>
                    );
                  })}
                  {!candidates.length && (
                    <p className="lineup-empty">
                      没有符合条件的载具，试试其他类型、等级、军种或型号。
                    </p>
                  )}
                </div>
              </section>
            </div>
            <section className="lineup-share" aria-label="分享码导出">
              <div className="lineup-section-heading">
                <h3>
                  分享码 <small>{2 + rules.maxSlots * 2} 位 · 区分大小写</small>
                </h3>
              </div>
              <div className="lineup-share-row">
                <code ref={shareCode} aria-label="当前队列分享码">
                  {share.code}
                </code>
                <button
                  className="quiet-button calc-open"
                  disabled={!share.code || copying}
                  onClick={async () => {
                    setCopying(true);
                    try {
                      await navigator.clipboard.writeText(share.code);
                      setMessage("分享码已复制。");
                    } catch {
                      if (shareCode.current) {
                        const range = document.createRange();
                        range.selectNodeContents(shareCode.current);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }
                      setMessage("浏览器未允许复制，已选中分享码，请手动复制。");
                    } finally {
                      setCopying(false);
                    }
                  }}
                >
                  {copying ? "正在复制…" : "复制分享码"}
                </button>
              </div>
              <p className="calc-note">
                {rules.countryCodes[country]} 为国家码；其后每两位为一个槽位，{rules.emptyCode}{" "}
                为空位。保持原始大小写。分享码不包含队列名称、战斗类型和 RB 出击选择。
              </p>
              <p
                className={`lineup-feedback ${share.error ? "is-error" : ""}`}
                role={share.error ? "alert" : "status"}
              >
                {share.error || message}
              </p>
            </section>
            <details className="lineup-rule-notes">
              <summary>权重规则与来源</summary>
              <p>
                空战 AB 取前三架，A/2+B/4+C/4；两架取 (A+B)/2，单架取自身。B/C 与 A
                的计算差距最多两档，按最近 BR 档位取整，正中间向上，最终最多比 A 低一档。
              </p>
              <p>
                陆战 RB 的飞机采用陆战专用权重；陆战 AB
                的机库飞机不计入。海战的飞机不得超过最高舰艇一档，超限飞机不可出击。SB
                不据此生成普通匹配权重。
              </p>
              <p>这是机库队列估算；损坏、锁定、临时活动和未解锁槽位等账号状态请以游戏为准。</p>
              {rules.sources.map((source, i) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {i === 0
                    ? "官方 Wiki 匹配规则"
                    : i === 1
                      ? "官方空战权重与取整说明"
                      : "官方乘员槽位说明"}{" "}
                  ↗
                </a>
              ))}
            </details>
          </section>
        )}
      </div>
    </>
  );
}
