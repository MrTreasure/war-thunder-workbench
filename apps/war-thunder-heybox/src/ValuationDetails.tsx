import { useMemo, useState } from "react";
import type { Valuation } from "../../../src/AccountValuation";
import type { VehicleTileUnit } from "../../../src/VehicleTile";
import { GameSelect } from "../../../src/components/GameSelect";
import { DetailPage, num, ErrorNote } from "./ui";
import { VehiclePresentation, useMiniappVehicleFacts } from "./VehiclePresentation";
import catalog from "../../../src/generated/bootstrap.json";
const names = { normal: "正常价值", discount: "折扣价值", secondHand: "参考价值" };
export function miniMoney(cents: number | null | undefined) {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const v = BigInt(cents),
    a = v < 0n ? -v : v;
  return `¥${v < 0n ? "-" : ""}${(a / 100n).toLocaleString("zh-CN")}.${String(a % 100n).padStart(2, "0")}`;
}
type Unit = VehicleTileUnit & { country?: string | null; owned?: boolean };
type Row = {
  key: string;
  group: string;
  unit: Unit;
  note: string;
  source?: string | null;
  checkedAt?: string | null;
  amount?: number | null;
  owned: boolean;
  packQuote?: { amountCents: number | null; checkedAt: string | null };
};
export function valuationRows(value: Valuation): Row[] {
  const rows: Row[] = [];
  const add = (group: string, unit: Unit, extra: Partial<Row> = {}) =>
    rows.push({
      key: group + ":" + unit.id,
      group,
      unit,
      note: "",
      owned: unit.owned === true,
      ...extra,
    });
  value.research.forEach((v) =>
    add("普通研发", v, {
      note: v.owned ? "" : v.observed ? "有出击记录，尚未核实拥有" : "推算前置，不代表实际拥有",
      source: v.rpSource,
      checkedAt: v.rpCheckedAt,
    }),
  );
  value.gold.forEach((v) =>
    add("金鹰载具", v, {
      amount: v.amountCents,
      source: v.source,
      checkedAt: v.checkedAt,
    }),
  );
  value.packs.forEach((p) =>
    p.vehicles.forEach((v) =>
      add("礼包载具", v, {
        unit: { ...v, kind: "pack" },
        note: p.vehicles.length > 1 ? p.title + " · 同礼包不重复计价" : "",
        source: p.source,
        checkedAt: p.checkedAt,
        packQuote: { amountCents: p.amountCents, checkedAt: p.checkedAt },
      }),
    ),
  );
  value.market.forEach((v) =>
    add("特殊市场", v, {
      note: "GJN 报价单列，不计入人民币合计",
      source: v.source,
      checkedAt: v.checkedAt,
    }),
  );
  (value.manual || []).forEach((v) =>
    add("特殊参考", v, { note: v.reason, amount: v.prices.normal, source: v.source }),
  );
  (value.excluded || []).forEach((v) => add("不计价项目", v, { note: v.reason, source: v.source }));
  value.unpriced.forEach((v) =>
    (v.vehicles?.length ? v.vehicles : [v]).forEach((unit) =>
      add("待核价", unit, { note: v.reason, amount: null }),
    ),
  );
  return rows;
}
export function MiniappValuationDetails({ valuation: value }: { valuation: Valuation }) {
  const [detail, setDetail] = useState<"basis" | "vehicles" | null>(null);
  const [country, setCountry] = useState("all"),
    [group, setGroup] = useState("all"),
    [limit, setLimit] = useState(24),
    [onlyOwned, setOnlyOwned] = useState(false);
  const rows = useMemo(() => valuationRows(value), [value]);
  const filtered = rows.filter(
    (row) =>
      (country === "all" || row.unit.country === country) &&
      (group === "all" || row.group === group) &&
      (!onlyOwned || row.owned),
  );
  const visible = filtered.slice(0, limit);
  const facts = useMiniappVehicleFacts(
    detail === "vehicles" ? visible.map((r) => r.unit.country || "") : [],
  );
  return (
    <>
      <div className="hb-value-links">
        <button onClick={() => setDetail("basis")}>估值依据与计算规则 →</button>
        <button onClick={() => setDetail("vehicles")}>查看载具明细 · {rows.length} →</button>
      </div>
      {detail === "basis" && (
        <DetailPage path="#/stats/valuation/basis" title="估值依据" close={() => setDetail(null)}>
          <h2>估值依据与计算规则</h2>
          <p>
            {value.ownership?.verified
              ? "依据官方公开车库已拥有载具计算，包含未出战载具，研发点按载具去重汇总。"
              : "未取得完整已拥有清单，依据出战记录及当前研发前置推算；推算载具不代表实际拥有。"}
          </p>
          {value.ownership?.fetchedAt && (
            <p className="hb-fine">
              车库核验：{new Date(value.ownership.fetchedAt).toLocaleString("zh-CN")}
            </p>
          )}
          {Object.entries(names).map(([id, label]) => {
            const rule = value.rules.scenarios[id];
            const amount = value.scenarios[id as keyof typeof names];
            return (
              <section className="hb-value-rule" key={id}>
                <h3>{label}</h3>
                <dl className="hb-kv">
                  {rule &&
                    Object.entries(rule.rpCents).map(([kind, cents]) => (
                      <div key={kind}>
                        <dt>{(catalog.categories as Record<string, string>)[kind] || kind}</dt>
                        <dd>
                          {miniMoney(cents)} / {num(value.rules.rpUnit)} RP
                        </dd>
                      </div>
                    ))}
                  <div>
                    <dt>金鹰 / 礼包购入比例</dt>
                    <dd>{rule ? rule.purchasePercent + "%" : "待核对"}</dd>
                  </div>
                  <div>
                    <dt>研发点部分</dt>
                    <dd>{miniMoney(amount.rpCents)}</dd>
                  </div>
                  <div>
                    <dt>金鹰部分</dt>
                    <dd>{miniMoney(amount.geCents)}</dd>
                  </div>
                  <div>
                    <dt>礼包部分</dt>
                    <dd>{miniMoney(amount.packCents)}</dd>
                  </div>
                  {amount.manualCents != null && (
                    <div>
                      <dt>特殊参考</dt>
                      <dd>{miniMoney(amount.manualCents)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{amount.totalCents == null ? "已核价部分" : "已核价合计"}</dt>
                    <dd>{miniMoney(amount.knownCents)}</dd>
                  </div>
                </dl>
              </section>
            );
          })}
          <p>
            金鹰换算：{miniMoney(value.rules.ge.cents)} / {num(value.rules.ge.units)}{" "}
            GE。礼包使用已核验人民币整包报价，同一礼包去重计价，核对日期见载具明细。
          </p>
          <p>
            缺失价格保持待核价，不按零处理。已核实初始免费载具不列入估值清单。人民币与 GJN
            分开，市场项目仅按需打开官方市场查看，不计入人民币合计。
          </p>
          <p>{value.notice}</p>
          <p className="hb-fine">
            规则版本：{value.policyVersion || "以本次服务端结果为准"} · 计算于{" "}
            {new Date(value.calculatedAt).toLocaleString("zh-CN")}
          </p>
        </DetailPage>
      )}
      {detail === "vehicles" && (
        <DetailPage
          path="#/stats/valuation/vehicles"
          title="估值载具明细"
          close={() => setDetail(null)}
        >
          <h2>估值载具明细</h2>
          <p className="hb-fine">
            仅已核实拥有的载具展示黑桃；出击记录及推算前置单独标记。礼包金额为整包报价。
          </p>
          <div className="hb-stats-filters">
            <GameSelect
              aria-label="估值载具国家"
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                setLimit(24);
              }}
            >
              <option value="all">全部国家</option>
              {Object.entries(catalog.countries).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </GameSelect>
            <GameSelect
              aria-label="估值载具类型"
              value={group}
              onValueChange={(v) => {
                setGroup(v);
                setLimit(24);
              }}
            >
              <option value="all">全部类型</option>
              {[...new Set(rows.map((r) => r.group))].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </GameSelect>
          </div>
          <label className="hb-owned-filter">
            <input
              type="checkbox"
              checked={onlyOwned}
              onChange={(e) => {
                setOnlyOwned(e.target.checked);
                setLimit(24);
              }}
            />
            只看已核实拥有
          </label>
          <ErrorNote error={facts.error} />
          {facts.error && <button onClick={facts.retry}>重新加载资料</button>}
          <div className="hb-value-vehicles">
            {visible.map((row) => (
              <article key={row.key}>
                <VehiclePresentation
                  unit={row.unit}
                  owned={row.owned}
                  showCountry={country === "all"}
                  href={"https://wiki.warthunder.com/unit/" + encodeURIComponent(row.unit.id)}
                  packQuote={row.packQuote}
                />
                <div className="hb-value-item-note">
                  {row.note && <p>{row.note}</p>}
                  {Object.hasOwn(row, "amount") && <strong>{miniMoney(row.amount)}</strong>}
                  {row.checkedAt && (
                    <small>核对于 {new Date(row.checkedAt).toLocaleDateString("zh-CN")}</small>
                  )}
                  {row.source &&
                    /^https:\/\/(?:store\.gaijin\.net|wiki\.warthunder\.com|warthunder\.com|trade\.gaijin\.net|market\.gaijin\.net)(?:\/|$)/.test(
                      row.source,
                    ) && (
                      <a href={row.source} target="_blank" rel="noopener noreferrer">
                        查看来源 ↗
                      </a>
                    )}
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && <p>暂无符合筛选的载具。</p>}
          <div className="hb-load-more">
            <small>
              已显示 {visible.length} / {filtered.length} 项
            </small>
            {visible.length < filtered.length && (
              <button onClick={() => setLimit((n) => n + 24)}>加载更多载具</button>
            )}
          </div>
        </DetailPage>
      )}
    </>
  );
}
