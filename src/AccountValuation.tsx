import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { statsRequest, statsDate, statsNumber, statsCategoryNames } from "./player-stats-api";
import type { PlayerProfile, StatsSession } from "./player-stats-api";

type Item = { id: string; name: string; country: string; category: string };
type Scenario = {
  label: string;
  rpCents: number;
  geCents: number;
  packCents: number;
  knownCents: number;
  totalCents: number | null;
};
type Valuation = {
  id: string;
  fetchedAt: string;
  calculatedAt: string;
  cached: boolean;
  observedCount: number;
  researchCount: number;
  geTotal: number;
  rpByCategory: Record<string, number>;
  scenarios: Record<"normal" | "discount" | "secondHand", Scenario>;
  gold: (Item & {
    ge: number | null;
    amountCents: number | null;
    source: string;
    checkedAt: string;
  })[];
  packs: {
    productId: string;
    title: string;
    vehicles: Item[];
    amountCents: number | null;
    checkedAt: string | null;
    source: string;
  }[];
  marketKnownGjnCents: number;
  marketUnpricedCount: number;
  market: (Item & {
    averageGjnCents: number | null;
    checkedAt: string | null;
    sampleCount: number | null;
    method: string | null;
    source: string;
  })[];
  research: (Item & {
    rp: number | null;
    observed: boolean;
    rpSource: string | null;
    rpCheckedAt: string | null;
  })[];
  unpriced: { id: string; name: string; reason: string }[];
  rules: {
    ge: { cents: number; units: number };
    rpUnit: number;
    scenarios: Record<string, { rpCents: Record<string, number>; purchasePercent: number }>;
  };
  notice: string;
};
export function valuationMoney(cents: number | null, symbol = "¥") {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const n = BigInt(cents);
  return `${symbol}${(n / 100n).toLocaleString("zh-CN")}.${String(n % 100n).padStart(2, "0")}`;
}
export function AccountValuation({
  profile,
  session,
  onSessionChange,
}: {
  profile: PlayerProfile;
  session: StatsSession | null;
  onSessionChange: () => Promise<void>;
}) {
  const [value, setValue] = useState<Valuation | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const limit = session?.limits.valuationLimit;
  const remaining =
    limit == null
      ? "不限次"
      : `${Math.max(0, limit - (session?.valuation?.used || 0) - (session?.valuation?.reserved || 0))} 次`;
  async function calculate() {
    if (busy) return;
    const c = new AbortController();
    request.current = c;
    setBusy(true);
    setError("");
    try {
      const result = await statsRequest<Valuation>(
        "valuations",
        { snapshotId: profile.snapshotId, requestId: "value_" + crypto.randomUUID() },
        c.signal,
      );
      if (!c.signal.aborted) {
        setValue(result);
        setOpen(true);
      }
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : "估值计算失败，请重试。");
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        void onSessionChange();
      }
    }
  }
  return (
    <div className="wt-account-valuation">
      <button
        className="wt-valuation-trigger"
        disabled={!session || busy}
        onClick={() => (value ? setOpen(true) : void calculate())}
      >
        {busy ? (
          "正在计算估值…"
        ) : value ? (
          <>
            正常价值 <b>{valuationMoney(value.scenarios.normal.knownCents)}</b>
            {value.scenarios.normal.totalCents == null && "（部分）"}{" "}
            <span aria-hidden="true">›</span>
          </>
        ) : (
          "计算账号估值"
        )}
      </button>
      {!value && <small>独立额度 · 今日 {session ? remaining : "—"}</small>}
      {error && (
        <small className="wt-record-error" role="alert">
          {error}
        </small>
      )}
      {open && value && (
        <Modal
          title={`${profile.nickname} · 账号估值`}
          close={() => setOpen(false)}
          className="wt-valuation-dialog"
        >
          <p className="wt-valuation-intro">
            根据 {value.observedCount} 辆出战载具推算，跨模式及研发前置去重后共{" "}
            {value.researchCount} 辆研发载具。同一礼包只计一次整包原价。
          </p>
          <div className="wt-valuation-totals">
            {Object.entries(value.scenarios).map(([key, s]) => (
              <section key={key}>
                <h3>{s.label}</h3>
                <strong>{valuationMoney(s.knownCents)}</strong>
                <small>{s.totalCents == null ? "已核价部分，存在未计价项目" : "已核价合计"}</small>
                <dl>
                  <div>
                    <dt>研发点</dt>
                    <dd>{valuationMoney(s.rpCents)}</dd>
                  </div>
                  <div>
                    <dt>金鹰载具</dt>
                    <dd>{valuationMoney(s.geCents)}</dd>
                  </div>
                  <div>
                    <dt>礼包</dt>
                    <dd>{valuationMoney(s.packCents)}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
          <section className="wt-valuation-section">
            <h3>计算规则</h3>
            <p>
              正常／折扣：陆战、直升机 ¥3／万 RP，飞机 ¥2／万 RP；折扣金鹰与礼包 5
              折。二手：陆战、直升机 ¥1.5／万 RP，飞机 ¥1／万 RP，金鹰与礼包按原价 3 折。
            </p>
            <p>
              金鹰按 ¥189／5000 GE 换算，共 {statsNumber(value.geTotal)}{" "}
              GE。礼包采用已核验人民币整包原价，保留查价日期；特殊载具优先单列，不重复计入金鹰或礼包。金额按各分项汇总后四舍五入到分。
            </p>
          </section>
          <section className="wt-valuation-section">
            <h3>金鹰载具 · {value.gold.length}</h3>
            {value.gold.length ? (
              <ul>
                {value.gold.map((v) => (
                  <li key={v.id}>
                    <a href={v.source} target="_blank" rel="noreferrer">
                      {v.name}
                    </a>
                    <span>
                      {statsNumber(v.ge)} GE · {valuationMoney(v.amountCents)}
                      {v.checkedAt && <small>核验 {statsDate(v.checkedAt)}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>出战记录中未识别到金鹰载具。</p>
            )}
          </section>
          <section className="wt-valuation-section">
            <h3>礼包载具 · {value.packs.length} 个礼包</h3>
            {value.packs.length ? (
              <ul>
                {value.packs.map((p) => (
                  <li key={p.productId}>
                    <span>
                      <a href={p.source} target="_blank" rel="noreferrer">
                        {p.title}
                      </a>
                      <small>{p.vehicles.map((v) => v.name).join("、")}</small>
                    </span>
                    <span>
                      {valuationMoney(p.amountCents)}
                      <small>
                        {p.checkedAt ? `核验 ${statsDate(p.checkedAt)}` : "尚无有效报价"}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>出战记录中未识别到礼包载具。</p>
            )}
          </section>
          <section className="wt-valuation-section">
            <h3>特殊载具 · {value.market.length}</h3>
            <p>
              Gaijin 币均价单独展示，不计入上方人民币总价。已核价合计{" "}
              {valuationMoney(value.marketKnownGjnCents, "")} GJN；{value.marketUnpricedCount}{" "}
              辆待核价。
            </p>
            {value.market.length ? (
              <ul>
                {value.market.map((v) => (
                  <li key={v.id}>
                    <span>
                      <a href={v.source} target="_blank" rel="noreferrer">
                        {v.name}
                      </a>
                      <small>{v.method || "尚未维护经核验的真实均价"}</small>
                    </span>
                    <span>
                      {v.averageGjnCents == null
                        ? "待核价"
                        : valuationMoney(v.averageGjnCents, "") + " GJN"}
                      <small>
                        {v.checkedAt
                          ? `${statsDate(v.checkedAt)} · ${v.sampleCount} 个样本`
                          : "不以零元替代"}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>出战记录中未识别到市场特殊载具。</p>
            )}
          </section>
          <details className="wt-valuation-section">
            <summary>研发点明细 · {value.researchCount} 辆（含推算前置）</summary>
            <p>
              {Object.entries(value.rpByCategory)
                .map(([cat, rp]) => `${statsCategoryNames[cat] || cat} ${statsNumber(rp)} RP`)
                .join(" · ") || "暂无已核实研发点"}
            </p>
            <ul>
              {value.research.map((v) => (
                <li key={v.id}>
                  <span>
                    {v.rpSource ? (
                      <a href={v.rpSource} target="_blank" rel="noreferrer">
                        {v.name}
                      </a>
                    ) : (
                      v.name
                    )}
                    <small>
                      {v.observed ? "有出战记录" : "根据当前前置推算"} ·{" "}
                      {statsCategoryNames[v.category] || v.category}
                    </small>
                  </span>
                  <span>
                    {statsNumber(v.rp)} RP
                    <small>{v.rpCheckedAt ? statsDate(v.rpCheckedAt) : "待核验"}</small>
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {!!value.unpriced.length && (
            <details className="wt-valuation-section">
              <summary>未计价项目 · {value.unpriced.length}</summary>
              <ul>
                {value.unpriced.map((v, i) => (
                  <li key={v.id + i}>
                    <span>{v.name}</span>
                    <span>{v.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <footer className="wt-valuation-section">
            <p>{value.notice}</p>
            <small>
              资料采集 {statsDate(value.fetchedAt)} · 估值计算 {statsDate(value.calculatedAt)}
              {value.cached && " · 已命中估值缓存，本次不扣次"}
            </small>
          </footer>
        </Modal>
      )}
    </div>
  );
}
