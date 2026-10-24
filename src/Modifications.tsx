import { getLocale } from "./i18n/core";
import { vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import { ModificationGrid } from "./ModificationGrid";
import { VehicleImage } from "./VehicleImage";
import { GameSelect } from "./components/GameSelect";
import { useState } from "react";
import type { CartItem, Catalog, Modifications, Tree, Vehicle } from "./models";
import { Modal, Metrics } from "./Modal";
import { indexTree } from "./planner";
import { integer, object, strings, useStored } from "./storage";
import { format, makeItem, parseRate, quoteCents } from "./quotes";
interface PartState {
  included: boolean;
  price: string;
  progress: string;
  total: string;
  completed: string[];
}
const valid = (v: unknown): v is PartState =>
  object(v) &&
  typeof v.included === "boolean" &&
  typeof v.price === "string" &&
  typeof v.progress === "string" &&
  typeof v.total === "string" &&
  strings(v.completed);
export function ModificationCalculator({
  catalog,
  modifications,
  tree,
  country,
  category,
  selected,
  close,
  add,
}: {
  catalog: Catalog;
  modifications: Modifications;
  tree: Tree;
  country: string;
  category: string;
  selected: string | null;
  close: () => void;
  add: (item: CartItem) => string;
}) {
  useLocale();

  const index = indexTree(tree);
  const initial = index.aliases.get(selected || "") || selected;
  const [target, setTarget] = useState(
    initial && index.units.has(initial) ? initial : [...index.units.keys()][0],
  );
  const unit = index.units.get(target)!;
  return (
    <Modal
      title={t("配件研发速算")}
      subtitle={`${catalog.countries[country]} / ${catalog.categories[category]} · 单独计算此载具的配件`}
      close={close}
    >
      <PartsForm
        key={target}
        {...{ catalog, modifications, tree, country, category, unit, add }}
        selector={
          <label className="calc-field">
            {t("目标载具")}
            <GameSelect value={target} onValueChange={(value) => setTarget(value)}>
              {localize(
                tree.ranks.map((rank) => (
                  <optgroup key={rank.rank} label={localize(`Rank ${localize(rank.rank)}`)}>
                    {localize(
                      [...index.units.values()]
                        .filter((u) => u.rank === rank.rank)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {localize(vehicleName(u))}
                            {localize(u.side === "special" ? " · 独立获取" : "")}
                          </option>
                        )),
                    )}
                  </optgroup>
                )),
              )}
            </GameSelect>
          </label>
        }
      />
    </Modal>
  );
}
function PartsForm({
  catalog,
  modifications,
  country,
  category,
  unit,
  selector,
  add,
}: {
  catalog: Catalog;
  modifications: Modifications;
  tree: Tree;
  country: string;
  category: string;
  unit: Vehicle;
  selector: import("react").ReactNode;
  add: (item: CartItem) => string;
}) {
  useLocale();

  const data = modifications[unit.id];
  const [state, save, error] = useStored<PartState>(
    `wt-mod-v1:${category}:${country}:${unit.id}`,
    {
      included: data?.allUnlockedByDefault ?? unit.premium,
      price: "",
      progress: "0",
      total: "",
      completed: [],
    },
    valid,
  );
  const [message, setMessage] = useState("");
  const base = state.included
    ? 0
    : state.total === ""
      ? (data?.totalRp ?? null)
      : /^\d+$/.test(state.total) &&
          integer(Number(state.total)) &&
          Number(state.total) <= 10_000_000
        ? Number(state.total)
        : null;
  const progress =
    /^\d+$/.test(state.progress) && integer(Number(state.progress)) ? Number(state.progress) : null;
  const completed =
    !state.included && data?.itemCostsComplete
      ? data.items
          .filter((item) => state.completed.includes(item.id))
          .reduce((sum, item) => sum + (item.rp || 0), 0)
      : 0;
  const rp = base !== null && progress !== null ? Math.max(0, base - completed - progress) : null;
  const rate = parseRate(state.price);
  const lines =
    rp !== null && rate !== null
      ? [
          {
            key: `modifications:${category}:${country}:${unit.id}`,
            unitId: unit.id,
            name: unit.name,
            nameEn: unit.nameEn,
            nameRu: unit.nameRu,
            rp,
            rateCents: rate,
            kind: "modifications" as const,
            country,
            category,
            remainingBefore: rp,
            basis: state.total !== "" ? "手动基础配件 RP" : data?.source || "未知来源",
          },
        ]
      : [];
  const cents = lines.length ? quoteCents(lines) : null;
  const update = (patch: Partial<PartState>) => {
    setMessage("");
    save({ ...state, ...patch });
  };
  const report = [
    `${catalog.countries[country]} / ${catalog.categories[category]} · ${unit.name} 配件研发`,
    `完整基础配件 RP：${base === null ? "未知" : format(base)}`,
    `已完成配件 RP：${format(completed)}`,
    `其他已投入 RP：${progress === null ? "无效" : format(progress)}`,
    `待研：${rp === null ? "未知" : format(rp)} RP`,
    `每万 RP：${rate === null ? "未填" : (rate / 100).toFixed(2) + " 元"}`,
    `价格：${cents === null ? "待核对" : (cents / 100).toFixed(2) + " 元"}`,
    `已完成配件：${
      data?.items
        .filter((item) => state.completed.includes(item.id))
        .map((item) => item.name)
        .join("、") || "未勾选"
    }`,
    `来源：${data?.source || "手动填入"} / ${data?.checkedAt || "无数据时间"}`,
    "只计算此载具配件，不含载具研发、银狮和购车。",
  ].join("\n");
  return (
    <div className="calc-main">
      <section className="calc-inputs">
        {localize(selector)}
        {localize(
          (data?.allUnlockedByDefault || unit.premium) && (
            <label className="calc-owned-row" aria-label={t("高级载具已解锁全部配件")}>
              <input
                type="checkbox"
                checked={state.included}
                onChange={(e) => update({ included: e.target.checked })}
              />
              <span className="calc-unit-label">
                <span>{t("高级载具已解锁全部配件")}</span>
                <small>{t("默认待研 0 RP；如游戏内仍需研发，可取消并核对。")}</small>
              </span>
            </label>
          ),
        )}
        <label className="calc-field">
          {t("每万配件 RP 单价（元）")}
          <input
            type="number"
            min="0"
            max="1000000"
            step=".01"
            placeholder={t("填写单价")}
            value={state.price}
            onChange={(e) => update({ price: e.target.value })}
          />
        </label>
        <label className="calc-field">
          {t("未勾选配件中已投入 RP")}
          <input
            type="number"
            min="0"
            step="1"
            value={state.progress}
            onChange={(e) => update({ progress: e.target.value })}
          />
        </label>
        <details className="calc-rules">
          <summary>{t("手动核对完整配件成本")}</summary>
          <p className="calc-note">
            {t("官方数据缺失或游戏版本不同，可填写完整基础 RP。留空使用官方数据。")}
          </p>
          <label className="calc-field">
            {t("完整配件总 RP")}
            <input
              type="number"
              min="0"
              max="10000000"
              step="1"
              placeholder={localize(
                data?.totalRp === null || data?.totalRp === undefined
                  ? "官方未提供"
                  : String(data.totalRp),
              )}
              value={state.total}
              onChange={(e) => update({ total: e.target.value })}
            />
          </label>
        </details>
        <p className="calc-note">
          {t(
            "勾选已完成的配件会扣除其研发点。“其他已投入”仅填写未勾选配件的部分进度，避免重复扣除。",
          )}
        </p>
        <p className="calc-note">
          {localize(
            data?.checkedAt
              ? `数据核对：${localize(new Date(data.checkedAt).toLocaleDateString(getLocale()))}`
              : "尚无此载具的配件数据。",
          )}
        </p>
        {localize(
          data?.source && (
            <a className="calc-note" href={data.source} target="_blank" rel="noreferrer">
              {t("查看官方载具资料 ↗")}
            </a>
          ),
        )}
        <p className="calc-note">{localize(error || "配件进度与单价自动保存在此浏览器。")}</p>
      </section>
      <section className="calc-output">
        <Metrics rp={rp} cents={cents} />
        <p className="calc-formula">{t("待研 RP ÷ 10,000 × 配件单价，金额四舍五入到分。")}</p>
        <output className={`calc-status ${rp === null ? "has-error" : ""}`}>
          {localize(
            rp === null
              ? "缺少完整配件研发点，或已研 RP 无效。请核对或手动填写后报价。"
              : `${localize(format(base!))} − ${localize(format(completed))} − ${localize(format(progress!))} = ${localize(format(rp))} RP`,
          )}
          {localize(
            !data?.itemCostsComplete && (
              <p className="calc-note">
                {t("逐项成本尚未完整匹配官方总额，暂不提供逐项扣除；可在左侧填写已投入 RP。")}
              </p>
            ),
          )}
        </output>
        <div className="cart-actions">
          <button
            className="quiet-button calc-open"
            disabled={rp === null || cents === null || rp === 0}
            onClick={() =>
              setMessage(
                add(
                  makeItem({
                    kind: "modifications",
                    title: `${unit.name} · 配件研发`,
                    dataVersion: data?.checkedAt || catalog.checkedAt,
                    lines,
                    details: report,
                  }),
                ),
              )
            }
          >
            {t("加入购物车")}
          </button>
          <output className="calc-note">{localize(message)}</output>
        </div>
        <h3>{t("配件明细 / 已完成")}</h3>
        <div className="wt-parts-vehicle">
          <VehicleImage key={unit.id} unit={unit} />
          <span>{vehicleName(unit)}</span>
        </div>
        {data?.items.length ? (
          <ModificationGrid
            data={data}
            included={state.included}
            completed={state.completed}
            onChange={(id, checked) =>
              update({
                completed: checked
                  ? [...state.completed, id]
                  : state.completed.filter((value) => value !== id),
              })
            }
          />
        ) : (
          <p className="calc-note">
            {t("官方页面未列出可用的逐项配件成本；可使用左侧的完整总 RP 手动报价。")}
          </p>
        )}
      </section>
    </div>
  );
}
