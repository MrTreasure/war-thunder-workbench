import { t, localize, vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { VehicleTile } from "./VehicleTile";
import { useAccountWorkspace } from "./workspace-context";
import { GameSelect } from "./components/GameSelect";
import { useMemo, useState } from "react";
import type { CartItem, Catalog, Profile, Tree } from "./models";
import { branchOwned, calculate, indexTree, prerequisitePath, rankNumber } from "./planner";
import { OwnedVehicleImport } from "./OwnedVehicleImport";
import { Modal, Metrics } from "./Modal";
import { integer, object, strings, useStored, readJson } from "./storage";
import { format, makeItem, parseRate, quoteCents } from "./quotes";
const numericMap = (v: unknown) => object(v) && Object.values(v).every(integer);
const valid = (v: unknown): v is Profile =>
  object(v) &&
  typeof v.target === "string" &&
  typeof v.price === "string" &&
  strings(v.owned) &&
  (v.ownedImport === undefined ||
    (object(v.ownedImport) &&
      strings(v.ownedImport.ids) &&
      typeof v.ownedImport.uid === "string" &&
      typeof v.ownedImport.nickname === "string" &&
      typeof v.ownedImport.fetchedAt === "string")) &&
  strings(v.pins) &&
  strings(v.banned) &&
  integer(v.unlocked) &&
  integer(v.progress) &&
  numericMap(v.costs) &&
  numericMap(v.gates);
export function VehicleCalculator({
  catalog,
  tree,
  country,
  category,
  selected,
  close,
  add,
}: {
  catalog: Catalog;
  tree: Tree;
  country: string;
  category: string;
  selected: string | null;
  close: () => void;
  add: (item: CartItem) => string;
}) {
  useLocale();
  const workspace = useAccountWorkspace();
  const binding = workspace?.binding;
  const index = useMemo(() => indexTree(tree), [tree]);
  const all = [...index.units.values()];
  const fallback = all.find((unit) => unit.side === "research")!.id;
  const gates = catalog.planning.gates[category][country];
  const profileKey = `wt-planner-v1:${category}:${country}`;
  const [migrated] = useState<Profile>(() => {
    const raw = workspace?.userId
      ? workspace.documents[profileKey]?.value
      : readJson<unknown>(profileKey, null, (value): value is unknown => value !== undefined);
    const old = object(raw) ? raw : {};
    const ids = (value: unknown) =>
      strings(value) ? value.filter((id) => index.units.has(id)) : [];
    const costs = object(old.costs)
      ? (Object.fromEntries(
          Object.entries(old.costs).filter(
            ([id, value]) => index.units.has(id) && integer(value) && value <= 10_000_000,
          ),
        ) as Record<string, number>)
      : {};
    const overrides = object(old.gates)
      ? (Object.fromEntries(
          Object.entries(old.gates).filter(
            ([rank, value]) => Object.hasOwn(gates, rank) && integer(value) && value <= 99,
          ),
        ) as Record<string, number>)
      : {};
    return {
      target: typeof old.target === "string" ? old.target : fallback,
      owned: ids(old.owned),
      ownedImport:
        object(old.ownedImport) &&
        strings(old.ownedImport.ids) &&
        typeof old.ownedImport.uid === "string" &&
        typeof old.ownedImport.nickname === "string" &&
        typeof old.ownedImport.fetchedAt === "string"
          ? {
              ids: ids(old.ownedImport.ids),
              uid: old.ownedImport.uid,
              nickname: old.ownedImport.nickname,
              fetchedAt: old.ownedImport.fetchedAt,
            }
          : undefined,
      pins: ids(old.pins),
      banned: ids(old.banned),
      costs,
      gates: { ...gates, ...overrides },
      unlocked: integer(old.unlocked) && old.unlocked <= 10 ? old.unlocked : 0,
      progress: integer(old.progress) ? old.progress : 0,
      price: typeof old.price === "string" ? old.price : "",
    };
  });
  const [stored, save, error] = useStored<Profile>(profileKey, migrated, valid, () => {
    const stored = migrated;
    const chosen = index.aliases.get(selected || "") || selected;
    const target =
      chosen && index.units.get(chosen)?.side === "research"
        ? chosen
        : index.units.get(stored.target)?.side === "research"
          ? stored.target
          : fallback;
    return {
      ...stored,
      target,
      progress: target === stored.target ? stored.progress : 0,
      gates: { ...gates, ...stored.gates },
    };
  });
  const [targetOverride, setTargetOverride] = useState<string | null>(() => {
    const id = index.aliases.get(selected || "") || selected;
    return workspace?.userId && id && index.units.get(id)?.side === "research" ? id : null;
  });
  const target =
    targetOverride ||
    (index.units.get(stored.target)?.side === "research" ? stored.target : fallback);
  const state = useMemo(
    () => ({
      ...stored,
      target,
      progress: target === stored.target ? stored.progress : 0,
      gates: { ...gates, ...stored.gates },
    }),
    [stored, target, gates],
  );
  const [tab, setTab] = useState<"owned" | "route">("owned");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [progressDraft, setProgressDraft] = useState(String(state.progress));
  const [gateDrafts, setGateDrafts] = useState<Record<string, string>>({});
  const [editCosts, setEditCosts] = useState(false);
  const owned = useMemo(
    () => [
      ...new Set([
        ...state.owned,
        ...(binding
          ? binding.vehicles
              .filter((v) => v.country === country && v.category === category)
              .map((v) => index.aliases.get(v.id) || v.id)
          : state.ownedImport?.ids || []),
      ]),
    ],
    [state.owned, state.ownedImport, binding, country, category, index],
  );
  const result = useMemo(() => calculate(tree, { ...state, owned }), [tree, state, owned]);
  const ancestors = useMemo(() => prerequisitePath(index, state.target), [index, state.target]);
  const reached = [...ancestors, index.units.get(state.target)!]
    .filter((unit) => owned.includes(unit.id))
    .at(-1);
  const pendingPrerequisites = result.rows.filter((row) => row.reason === "目标前置");
  const extraRows = result.rows.filter((row) => row.reason === "等级补位");
  const editingCosts = editCosts || result.unknown.length > 0;
  const hasCostDrafts = result.rows.some((row) => Object.hasOwn(drafts, row.unit.id));
  const invalidProgress = !/^\d+$/.test(progressDraft) || !integer(Number(progressDraft));
  const invalidGates = Object.values(gateDrafts).some((v) => !/^\d+$/.test(v) || Number(v) > 99);
  const total =
    result.errors.length || invalidProgress || invalidGates || hasCostDrafts ? null : result.total;
  const rate = parseRate(state.price);
  const lines =
    total !== null && rate !== null
      ? result.rows.map((row) => ({
          key: `vehicle:${category}:${country}:${row.unit.id}`,
          unitId: row.unit.id,
          name: row.unit.name,
          rp: row.rp!,
          rateCents: rate,
          kind: "vehicle" as const,
          country,
          category,
          remainingBefore: row.rp!,
          basis: `${state.costs[row.unit.id] !== undefined ? t("手动基础 RP") : row.unit.rpCheckedAt || catalog.checkedAt}；${state.unlocked ? t("从 Rank {0} 计价，低等级跳过", [localize(tree.ranks.find((rank) => rankNumber(rank.rank) === state.unlocked)?.rank)]) : t("自动，按真实已有记录计算")}`,
        }))
      : [];
  const cents = total !== null && rate !== null ? quoteCents(lines) : null;
  const update = (patch: Partial<Profile>) => {
    setMessage("");
    if (save({ ...state, ...patch }) && patch.target) setTargetOverride(patch.target);
  };
  const targetRank = index.units.get(state.target)!.rankNumber;
  const visible = all.filter(
    (unit) =>
      (tab === "owned" || unit.side === "research") &&
      (rankFilter === "all" || unit.rank === rankFilter) &&
      (filter === "all" ||
        (filter === "research" && unit.side === "research") ||
        (filter === "special" && unit.side === "special") ||
        (filter === "checked" &&
          (tab === "owned"
            ? owned.includes(unit.id)
            : state.pins.includes(unit.id) || state.banned.includes(unit.id)))) &&
      `${vehicleName(unit)}${unit.nameEn || ""}${unit.id}`
        .normalize("NFKC")
        .toLowerCase()
        .replaceAll(" ", "")
        .includes(search.normalize("NFKC").toLowerCase().replaceAll(" ", "")),
  );
  const report = [
    `${catalog.countries[country]} / ${catalog.categories[category]} · ${result.target?.name}`,
    t("待研：{0} RP", [localize(total === null ? "待核对" : format(total))]),
    t("每万 RP：{0}", [localize(rate === null ? "未填" : (rate / 100).toFixed(2) + " 元")]),
    t("价格：{0}", [localize(cents === null ? "待核对" : (cents / 100).toFixed(2) + " 元")]),
    t("目标已研：{0} RP", [localize(state.progress)]),
    t("本线已拥有至：{0}；等级已开放至：{1}", [
      localize(reached?.name || "未记录"),
      localize(result.unlocked),
    ]),
    t("计价起点：{0}", [
      localize(
        state.unlocked
          ? `Rank ${tree.ranks.find((rank) => rankNumber(rank.rank) === state.unlocked)?.rank}，低于该等级的载具不计价（不代表实际拥有）`
          : "自动，按真实已有记录计算",
      ),
    ]),
    t("已有：{0}", [
      localize([...result.owned].map((id) => index.units.get(id)?.name).join("、") || "未勾选"),
    ]),
    ...result.gates.map((gate) =>
      t("{0}→{1}：已有 {2} + 新增 {3} / {4}", [
        localize(gate.rank),
        localize(gate.next),
        localize(gate.have),
        localize(gate.added),
        localize(gate.alreadyOpen ? "已解锁" : gate.required),
      ]),
    ),
    ...result.rows.map(
      (row, i) =>
        `${i + 1}. ${vehicleName(row.unit)} [${row.unit.rank}] ${row.reason} ${row.rp === null ? t("RP未知") : format(row.rp) + " RP"}`,
    ),
    ...result.errors,
    t(
      "新增车辆需研究后购买才能计入门槛。不含银狮、金币购车、改装或联队研发。自动补位不保证全局最低。",
    ),
  ].join("\n");
  return (
    <Modal
      className="vehicle-calculator"
      title={t("载具研发报价")}
      subtitle={t("{0} / {1} · 账号进度自动保存在本地", [
        localize(catalog.countries[country]),
        localize(catalog.categories[category]),
      ])}
      close={close}
    >
      <div className="calc-main vehicle-workbench">
        <section className="calc-inputs vehicle-config" aria-label={t("报价设置")}>
          <section className="vehicle-form-section">
            <h3>{t("目标与单价")}</h3>
            <label className="calc-field">
              {t("目标载具")}
              <GameSelect
                renderOption={(option) => {
                  const id = option.value;
                  const unit = index.units.get(id);
                  return unit ? <VehicleTile unit={unit} catalog={catalog} /> : null;
                }}
                value={state.target}
                onValueChange={(value) => {
                  setDrafts({});
                  setProgressDraft("0");
                  update({ target: value, progress: 0 });
                }}
              >
                {localize(
                  tree.ranks.map((rank) => (
                    <optgroup key={rank.rank} label={`Rank ${rank.rank}`}>
                      {localize(
                        all
                          .filter((unit) => unit.side === "research" && unit.rank === rank.rank)
                          .map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {vehicleName(unit)}
                            </option>
                          )),
                      )}
                    </optgroup>
                  )),
                )}
              </GameSelect>
            </label>
            <label className="calc-field">
              {t("每万研发点单价（元）")}
              <input
                type="number"
                min="0"
                max="1000000"
                step=".01"
                placeholder={t("填写单价后显示价格")}
                value={state.price}
                onChange={(e) => update({ price: e.target.value })}
              />
            </label>
          </section>

          <section className="vehicle-form-section">
            <h3>{t("账号进度")}</h3>
            {localize(
              workspace?.binding ? (
                <p className="wt-owned-caption">
                  {t("已应用关联账号")}
                  {localize(workspace.binding.nickname)} · UID {localize(workspace.binding.uid)}
                  {localize(" ")}
                  {t("的车库，自动跳过已拥有载具。")}
                  <br />
                  {t("采集于")}
                  {localize(new Date(workspace.binding.fetchedAt).toLocaleString())}
                  {t("。关联账号的车库优先于临时导入；手动拥有标记作为补充。")}
                </p>
              ) : (
                <OwnedVehicleImport
                  country={country}
                  category={category}
                  current={state.ownedImport}
                  onImport={(garage) => {
                    const ids = [
                      ...new Set(
                        garage.vehicles
                          .filter((v) => v.country === country && v.category === category)
                          .map((v) => index.aliases.get(v.id) || v.id)
                          .filter((id) => index.units.has(id)),
                      ),
                    ];
                    setDrafts({});
                    setProgressDraft("0");
                    update({
                      ownedImport: {
                        ids,
                        uid: garage.uid,
                        nickname: garage.nickname,
                        fetchedAt: garage.fetchedAt,
                      },
                      unlocked: 0,
                      progress: 0,
                    });
                  }}
                  onClear={() => update({ ownedImport: undefined })}
                />
              ),
            )}
            <label className="calc-field">
              {t("这条线路已拥有到哪辆车？")}
              <GameSelect
                value={reached?.id || ""}
                onValueChange={(value) =>
                  update({
                    owned: branchOwned(index, state.target, state.owned, value),
                  })
                }
              >
                <option value="">{t("本线前置尚未拥有")}</option>
                {localize(
                  ancestors.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {vehicleName(unit)} · Rank {localize(unit.rank)}
                    </option>
                  )),
                )}
                <option value={state.target}>{t("目标载具也已拥有（待研 0）")}</option>
              </GameSelect>
            </label>
            <p className="calc-note">{t("选择已购车辆，会将本线到该车的前置一并记为已有。")}</p>
            <button
              className="quiet-button vehicle-ready"
              disabled={
                owned.includes(state.target) ||
                (pendingPrerequisites.length === 0 &&
                  result.unlocked >= targetRank &&
                  state.pins.length === 0)
              }
              onClick={() => {
                setDrafts({});
                update({
                  owned: ancestors.length
                    ? branchOwned(index, state.target, state.owned, ancestors.at(-1)!.id)
                    : state.owned,
                  unlocked: Math.max(state.unlocked, targetRank),
                  pins: [],
                });
              }}
            >
              {t("已可直接研发，只算目标")}
            </button>
            <label className="calc-field">
              {t("已开放等级 / 计价起点")}
              <GameSelect
                value={state.unlocked}
                onValueChange={(value) => update({ unlocked: Number(value) })}
              >
                <option value={0}>
                  {t("自动识别：Rank")}
                  {localize(" ")}
                  {localize(
                    tree.ranks.find((rank) => rankNumber(rank.rank) === result.unlocked)?.rank ||
                      tree.ranks[0].rank,
                  )}
                </option>
                {localize(
                  tree.ranks.map((rank) => (
                    <option value={rankNumber(rank.rank)} key={rank.rank}>
                      {t("从 Rank")}
                      {localize(rank.rank)}
                      {t("计价")}
                    </option>
                  )),
                )}
              </GameSelect>
            </label>
            <p className="calc-note">
              {t(
                "手动选择后，低于该等级的载具均跳过计价；本级及以上前置与数量补位照常计算，不修改真实已有记录。自动识别时按真实已有载具计算。",
              )}
            </p>
          </section>

          <details className="vehicle-disclosure">
            <summary>
              {t("其他已有载具与补研偏好")}
              {localize(" ")}
              <span>
                {localize(owned.length)}
                {t("辆已有")}
                {localize(
                  state.pins.length + state.banned.length > 0
                    ? t(" · {0} 项偏好", [localize(state.pins.length + state.banned.length)])
                    : "",
                )}
              </span>
            </summary>
            <div className="vehicle-inventory">
              <div className="calc-tabs">
                <button
                  className="quiet-button"
                  aria-pressed={tab === "owned"}
                  onClick={() => setTab("owned")}
                >
                  {t("已有载具")}
                </button>
                <button
                  className="quiet-button"
                  aria-pressed={tab === "route"}
                  onClick={() => {
                    setTab("route");
                    if (filter === "special") setFilter("all");
                  }}
                >
                  {t("补研选择")}
                </button>
              </div>
              <div className="calc-list-tools vehicle-list-tools">
                <input
                  className="vehicle-inventory-search"
                  aria-label={t("搜索计算载具")}
                  type="search"
                  placeholder={t("搜索型号")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <label className="calc-field">
                  {t("载具类型")}
                  <GameSelect value={filter} onValueChange={(value) => setFilter(value)}>
                    <option value="all">{t("全部载具")}</option>
                    <option value="research">{t("常规研发")}</option>
                    {localize(
                      tab === "owned" && <option value="special">{t("金币 / 特殊")}</option>,
                    )}
                    <option value="checked">{t("已勾选")}</option>
                  </GameSelect>
                </label>
                <label className="calc-field">
                  {t("等级")}
                  <GameSelect value={rankFilter} onValueChange={(value) => setRankFilter(value)}>
                    <option value="all">{t("全部等级")}</option>
                    {localize(
                      tree.ranks.map((rank) => (
                        <option key={rank.rank} value={rank.rank}>
                          Rank {localize(rank.rank)}
                        </option>
                      )),
                    )}
                  </GameSelect>
                </label>
              </div>
              <p className="calc-note">
                {localize(
                  tab === "owned"
                    ? t("仅勾选已购买 / 已领取车辆；高级、活动和联队车计入所在等级数量。")
                    : t("指定车辆会连同必要前置加入；排除只限制自动补位，不绕过目标前置。"),
                )}
              </p>
              <div className="calc-collection">
                {localize(
                  tree.ranks
                    .filter((rank) => visible.some((unit) => unit.rank === rank.rank))
                    .map((rank) => (
                      <div className="calc-owned-rank" key={rank.rank}>
                        <h4>Rank {localize(rank.rank)}</h4>
                        {localize(
                          visible
                            .filter((unit) => unit.rank === rank.rank)
                            .map((unit) => (
                              <label className="calc-owned-row" key={unit.id}>
                                {localize(
                                  tab === "owned" && (
                                    <input
                                      type="checkbox"
                                      checked={owned.includes(unit.id)}
                                      disabled={state.ownedImport?.ids.includes(unit.id)}
                                      title={
                                        state.ownedImport?.ids.includes(unit.id)
                                          ? t("官方车库已拥有，清除导入后可手动修改")
                                          : undefined
                                      }
                                      onChange={(e) =>
                                        update({
                                          owned: e.target.checked
                                            ? [...state.owned, unit.id]
                                            : state.owned.filter((id) => id !== unit.id),
                                        })
                                      }
                                    />
                                  ),
                                )}
                                <VehicleTile
                                  unit={unit}
                                  catalog={catalog}
                                  owned={owned.includes(unit.id)}
                                />
                                {localize(
                                  tab === "route" && (
                                    <GameSelect
                                      aria-label={t("{0} 补研策略", [localize(vehicleName(unit))])}
                                      disabled={
                                        owned.includes(unit.id) || unit.rankNumber > targetRank
                                      }
                                      value={
                                        state.pins.includes(unit.id)
                                          ? "pin"
                                          : state.banned.includes(unit.id)
                                            ? "ban"
                                            : "auto"
                                      }
                                      onValueChange={(value) =>
                                        update({
                                          pins: [
                                            ...state.pins.filter((id) => id !== unit.id),
                                            ...(value === "pin" ? [unit.id] : []),
                                          ],
                                          banned: [
                                            ...state.banned.filter((id) => id !== unit.id),
                                            ...(value === "ban" ? [unit.id] : []),
                                          ],
                                        })
                                      }
                                    >
                                      <option value="auto">{t("自动")}</option>
                                      <option value="pin">{t("指定")}</option>
                                      <option value="ban">{t("排除")}</option>
                                    </GameSelect>
                                  ),
                                )}
                              </label>
                            )),
                        )}
                      </div>
                    )),
                )}
              </div>

              {localize(
                visible.length === 0 && (
                  <p className="calc-note">{t("没有匹配载具，请调整搜索或筛选条件。")}</p>
                ),
              )}
            </div>
          </details>

          <details className="vehicle-disclosure">
            <summary>
              {t("已投入研发点与门槛修正")}
              {localize(" ")}
              <span>
                {localize(
                  state.progress > 0
                    ? t("已研 {0} RP", [localize(format(state.progress))])
                    : t("可选"),
                )}
                {localize(
                  Object.entries(state.gates).some(([rank, count]) => gates[rank] !== count)
                    ? t(" · 门槛已修改")
                    : "",
                )}
              </span>
            </summary>
            <div className="vehicle-advanced">
              <label className="calc-field">
                {t("已投入目标载具的研发点")}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={progressDraft}
                  aria-invalid={invalidProgress}
                  onChange={(e) => {
                    setProgressDraft(e.target.value);
                    if (/^\d+$/.test(e.target.value) && integer(Number(e.target.value)))
                      update({ progress: Number(e.target.value) });
                  }}
                />
              </label>
              <div className="vehicle-gate-settings">
                <h4>{t("修正各级购车数量门槛")}</h4>
                <p className="calc-note">
                  {t("按同国、同军种的上一级已购数量计数。")}
                  <a href={catalog.planning.source} target="_blank" rel="noreferrer">
                    {t("配置镜像")}
                  </a>
                  {localize(" ")}· {localize(catalog.planning.checkedAt.slice(0, 10))}
                </p>
                <div className="calc-gates-form">
                  {localize(
                    tree.ranks.slice(0, -1).map((rank) => (
                      <label className="calc-field" key={rank.rank}>
                        {localize(rank.rank)}
                        {t("→ 下一级")}
                        <input
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          value={gateDrafts[rank.rank] ?? String(state.gates[rank.rank])}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGateDrafts({ ...gateDrafts, [rank.rank]: v });
                            if (/^\d+$/.test(v) && Number(v) <= 99)
                              update({ gates: { ...state.gates, [rank.rank]: Number(v) } });
                          }}
                        />
                      </label>
                    )),
                  )}
                </div>
              </div>
            </div>
          </details>
          <div className="vehicle-reset">
            <output className="calc-note">
              {localize(error || t("只计算研发点，不含购车与乘员费用。"))}
            </output>
            <button
              className="quiet-button"
              onClick={() => {
                setDrafts({});
                setGateDrafts({});
                setProgressDraft("0");
                update({
                  owned: [],
                  ownedImport: undefined,
                  pins: [],
                  banned: [],
                  costs: {},
                  gates: { ...gates },
                  progress: 0,
                  unlocked: 0,
                });
              }}
            >
              {t("重置本树进度")}
            </button>
          </div>
        </section>

        <section className="calc-output vehicle-output" aria-label={t("研发报价结果")}>
          <div className="vehicle-receipt">
            <Metrics rp={total} cents={cents} />
            <div className="vehicle-receipt-actions">
              <button
                className="quiet-button calc-open"
                disabled={total === null || cents === null || total === 0}
                onClick={() =>
                  setMessage(
                    add(
                      makeItem({
                        kind: "vehicle",
                        title: t("{0} · 载具研发", [localize(result.target?.name)]),
                        dataVersion: catalog.checkedAt,
                        lines,
                        details: report,
                      }),
                    ),
                  )
                }
              >
                {t("加入购物车")}
              </button>
              <button
                className="quiet-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report);
                    setMessage(t("已复制清单"));
                  } catch {
                    setMessage(t("无法访问剪贴板，可加入购物车后导出 JSON。"));
                  }
                }}
              >
                {t("复制清单")}
              </button>
            </div>
            <p className="calc-formula">
              {localize(
                total !== null && rate !== null
                  ? `${format(total)} RP ÷ 10,000 × ¥ ${(rate / 100).toFixed(2)}`
                  : t("按实际研发点计价，不凑整万。"),
              )}
            </p>
            {localize(message && <output className="vehicle-feedback">{localize(message)}</output>)}
          </div>

          <div className="vehicle-results">
            {localize(
              (result.errors.length > 0 ||
                result.unknown.length > 0 ||
                invalidProgress ||
                invalidGates ||
                hasCostDrafts) && (
                <output className="calc-status has-error">
                  {localize(result.errors.map((text) => <p key={text}>{localize(text)}</p>))}
                  {localize(
                    result.unknown.length > 0 && (
                      <p>
                        {localize(result.unknown.length)}
                        {t("辆成本未知，请在清单补填基础 RP。已知部分")}
                        {localize(" ")}
                        {localize(format(result.knownTotal))} RP。
                      </p>
                    ),
                  )}
                  {localize(
                    invalidProgress && (
                      <p>{t("已研 RP 需为非负整数，可在左侧“已投入研发点”中修正。")}</p>
                    ),
                  )}
                  {localize(
                    invalidGates && (
                      <p>{t("等级门槛需为 0～99 的整数，可在左侧“门槛修正”中修改。")}</p>
                    ),
                  )}
                  {localize(
                    hasCostDrafts && <p>{t("基础 RP 修改后请按 Enter 或移开焦点应用。")}</p>,
                  )}
                </output>
              ),
            )}
            {localize(
              pendingPrerequisites.length > 0 && (
                <div className="vehicle-explanation">
                  <strong>
                    {t("这条线路还有")}
                    {localize(pendingPrerequisites.length)}
                    {t("辆前置未记录为已有")}
                  </strong>
                  <p>
                    {localize(
                      result.unlocked >= targetRank
                        ? t(
                            "清单保留计价起点及以上的未拥有前置。已实际拥有的载具可在本线进度或清单中扣除。",
                          )
                        : t("已拥有的前置不会重复计价，请先填写左侧的本线进度。"),
                    )}
                  </p>
                </div>
              ),
            )}
            <div className="vehicle-list-heading">
              <div>
                <h3>{t("本次研发清单")}</h3>
                <p>
                  {localize(result.rows.length)}
                  {t("辆 · 前置")}
                  {localize(pendingPrerequisites.length)}
                  {t("· 等级补位")}
                  {localize(" ")}
                  {localize(extraRows.length)}
                </p>
              </div>
              <button
                className="quiet-button"
                aria-pressed={editCosts}
                disabled={hasCostDrafts}
                onClick={() => setEditCosts(!editCosts)}
              >
                {localize(editCosts ? t("完成修改") : t("修改基础 RP"))}
                {localize(
                  Object.keys(state.costs).length > 0
                    ? ` · ${Object.keys(state.costs).length}`
                    : "",
                )}
              </button>
            </div>
            {localize(
              result.rows.length > 0 ? (
                <div className={`vehicle-route-list ${editingCosts ? "is-editing" : ""}`}>
                  <div className="vehicle-route-row is-header">
                    <span>{t("已有")}</span>
                    <span>{t("研发顺序 / 用途")}</span>
                    {localize(editingCosts && <span>{t("基础 RP")}</span>)}
                    <span>{t("待研 RP")}</span>
                  </div>
                  {localize(
                    result.rows.map((row, i) => (
                      <div
                        className={`vehicle-route-row ${row.reason === "目标载具" ? "is-target" : ""}`}
                        key={row.unit.id}
                      >
                        <input
                          type="checkbox"
                          aria-label={t("{0} 已拥有", [localize(vehicleName(row.unit))])}
                          checked={false}
                          onChange={() => {
                            const next = { ...drafts };
                            delete next[row.unit.id];
                            setDrafts(next);
                            update({ owned: [...state.owned, row.unit.id] });
                          }}
                        />
                        <span className="wt-research-tile-entry">
                          <VehicleTile unit={row.unit} catalog={catalog} />
                          <small>
                            {localize(i + 1)}. Rank {localize(row.unit.rank)} ·{" "}
                            {localize(row.reason)}
                          </small>
                        </span>
                        {localize(
                          editingCosts && (
                            <input
                              aria-label={t("{0} 完整基础 RP", [localize(vehicleName(row.unit))])}
                              type="number"
                              min="0"
                              max="10000000"
                              step="1"
                              placeholder={t("填写 RP")}
                              value={drafts[row.unit.id] ?? row.baseRp ?? ""}
                              onChange={(e) =>
                                setDrafts({ ...drafts, [row.unit.id]: e.target.value })
                              }
                              onBlur={(e) => {
                                if (
                                  /^\d+$/.test(e.target.value) &&
                                  integer(Number(e.target.value)) &&
                                  Number(e.target.value) <= 10_000_000
                                ) {
                                  const next = { ...drafts };
                                  delete next[row.unit.id];
                                  setDrafts(next);
                                  update({
                                    costs: {
                                      ...state.costs,
                                      [row.unit.id]: Number(e.target.value),
                                    },
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                            />
                          ),
                        )}
                        <strong>{localize(row.rp === null ? t("待填") : format(row.rp))}</strong>
                      </div>
                    )),
                  )}
                </div>
              ) : (
                <div className="vehicle-empty">
                  <strong>
                    {localize(
                      result.owned.has(state.target)
                        ? t("目标载具已拥有")
                        : state.unlocked > targetRank
                          ? t("目标低于计价起点")
                          : t("本次无需新增研发"),
                    )}
                  </strong>
                  <p>{t("本次无需研发，可以选择其他目标继续计算。")}</p>
                </div>
              ),
            )}

            <details className="vehicle-disclosure vehicle-gate-check">
              <summary>
                {t("等级门槛核对")}
                {localize(" ")}
                <span>
                  {localize(result.gates.filter((gate) => gate.needed).length)}
                  {t("项需要核对 · 其余已开放或无需解锁")}
                </span>
              </summary>
              <div className="calc-gate-row is-header">
                {localize(
                  [t("等级"), t("已有"), t("本次新增"), t("要求 / 状态")].map((text) => (
                    <span key={text}>{localize(text)}</span>
                  )),
                )}
              </div>
              {localize(
                result.gates.map((gate) => (
                  <div className="calc-gate-row" key={gate.rank}>
                    <span>
                      {localize(gate.rank)} → {localize(gate.next)}
                    </span>
                    <span>{localize(gate.have)}</span>
                    <span>{localize(gate.added)}</span>
                    <span>
                      {localize(
                        gate.alreadyOpen
                          ? t("已开放")
                          : !gate.needed
                            ? t("无需解锁")
                            : `${gate.have + gate.added} / ${gate.required ?? "—"}`,
                      )}
                    </span>
                  </div>
                )),
              )}
            </details>
            <p className="calc-note vehicle-method-note">
              {t(
                "自动补位按新增前置链成本优先选择，可在左侧调整补研偏好；不保证全局最省。新增车辆须购买后才计入等级数量。",
              )}
            </p>
            {localize(
              country === "israel" && (
                <p className="calc-note">
                  {t("以色列跨国入门条件需在游戏内满足，本表从本国起始等级计算。")}
                </p>
              ),
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
