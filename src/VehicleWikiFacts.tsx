import type { Catalog, Vehicle, WikiVehicleDetails } from "./models";
import { PackPriceDetails } from "./PackPrice";
import { rpText } from "./TreeCanvas";
import "./vehicle-wiki-facts.css";

const modeLabels = { ab: "街机 AB", rb: "历史 RB", sb: "全真 SB" };
const percent = (value: number | undefined) =>
  value === undefined ? "—" : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
type RewardPercent = NonNullable<WikiVehicleDetails["rewards"]>["rp"];
function Reward({ value, mode }: { value: RewardPercent | undefined; mode: "ab" | "rb" | "sb" }) {
  return (
    <span
      title={
        value && value.factor !== 1 && value.basePercent[mode] !== undefined
          ? `Wiki 显示：${value.factor} × ${value.basePercent[mode]}%`
          : undefined
      }
    >
      {percent(value?.percent[mode])}
    </span>
  );
}
export function VehicleWikiFacts({
  unit,
  catalog,
  country,
  category,
}: {
  unit: Vehicle;
  catalog: Catalog;
  country: string;
  category: string;
}) {
  const details = unit.wikiDetails,
    rewards = details?.rewards;
  const purchase = details?.purchase;
  return (
    <div className="wt-vehicle-wiki">
      <section aria-labelledby="wt-vehicle-basic-title">
        <h3 id="wt-vehicle-basic-title">基础资料</h3>
        <dl className="wt-vehicle-facts">
          <div>
            <dt>国家 / 军种</dt>
            <dd>
              {catalog.countries[country]} · {catalog.categories[category]}
            </dd>
          </div>
          <div>
            <dt>阶级</dt>
            <dd>Rank {unit.rank}</dd>
          </div>
          <div>
            <dt>载具类型</dt>
            <dd>{unit.role ? catalog.roles[unit.role] || unit.role : "暂无资料"}</dd>
          </div>
          <div>
            <dt>获取类别</dt>
            <dd>
              {unit.side === "research" ? "常规研发" : catalog.kinds[unit.kind] || "特殊载具"}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="wt-vehicle-purchase-title">
        <h3 id="wt-vehicle-purchase-title">获取与价格</h3>
        {(unit.side === "research" || unit.kind === "squadron") && (
          <div className="wt-vehicle-price-line">
            <span>{unit.kind === "squadron" ? "联队研发点" : "载具研发点"}</span>
            <strong>{rpText(unit)}</strong>
          </div>
        )}
        {unit.kind === "gold" && (
          <div className="wt-vehicle-price-line">
            <span>金鹰原价</span>
            <strong>
              {unit.price === null ? "暂无报价" : `${unit.price.toLocaleString("zh-CN")} GE`}
            </strong>
          </div>
        )}
        {purchase?.currency === "SL" && (
          <div className="wt-vehicle-price-line">
            <span>银狮购车价</span>
            <strong>
              {purchase.amount === 0 ? "免费" : `${purchase.amount.toLocaleString("zh-CN")} SL`}
            </strong>
          </div>
        )}
        <PackPriceDetails unit={unit} />
        {purchase && (
          <small className="wt-vehicle-facts-source">
            购车价核对：{purchase.checkedAt.slice(0, 10)}
          </small>
        )}
        {unit.rpCheckedAt && (unit.side === "research" || unit.kind === "squadron") && (
          <small className="wt-vehicle-facts-source">
            研发点核对：{unit.rpCheckedAt.slice(0, 10)}
          </small>
        )}
        {unit.side !== "research" && !["gold", "pack", "squadron"].includes(unit.kind) && (
          <p className="wt-vehicle-facts-note">
            通过对应活动、市场或其他获取渠道获得，具体可用状态以游戏和官方页面为准。
          </p>
        )}
      </section>
      <section aria-labelledby="wt-vehicle-rewards-title">
        <h3 id="wt-vehicle-rewards-title">收益倍率</h3>
        {rewards ? (
          <>
            <table className="wt-vehicle-reward-table">
              <thead>
                <tr>
                  <th scope="col">模式</th>
                  <th scope="col">研发点</th>
                  <th scope="col">银狮</th>
                </tr>
              </thead>
              <tbody>
                {(["ab", "rb", "sb"] as const).map((mode) => (
                  <tr key={mode}>
                    <th scope="row">{modeLabels[mode]}</th>
                    <td>
                      <Reward value={rewards.rp} mode={mode} />
                    </td>
                    <td>
                      <Reward value={rewards.sl} mode={mode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="wt-vehicle-facts-source">
              Wiki 载具资料 · {rewards.checkedAt.slice(0, 10)}
            </small>
          </>
        ) : (
          <p className="wt-vehicle-facts-note">暂无已采集的收益倍率。</p>
        )}
        <p className="wt-vehicle-facts-note">
          展示载具资料中的获取百分比，非单局最终收益；账号和活动加成以实际结算为准。
        </p>
      </section>
    </div>
  );
}
