import { GameSelect } from "./components/GameSelect";
import { compactSilver } from "./player-number-format";
import {
  statsNumber as num,
  statsRatio as ratio,
  statsSilver,
  statsSilverIcon,
} from "./player-stats-api";
import type { PlayerVehicle } from "./player-stats-api";
import catalog from "../data/catalog-settings.json";

export function PlayerVehicleCards({
  vehicles,
  select,
  generate,
  showNaval,
}: {
  vehicles: PlayerVehicle[];
  select: (vehicle: PlayerVehicle) => void;
  generate: (vehicle: PlayerVehicle) => void;
  showNaval: boolean;
}) {
  return (
    <div className="wt-vehicle-cards">
      {vehicles.map((vehicle) => (
        <article key={vehicle.id} className="wt-vehicle-card">
          <button
            className="wt-vehicle-card-open"
            onClick={() => select(vehicle)}
            aria-label={`查看${vehicle.name}战绩详情`}
          />
          <header className="wt-vehicle-card-heading">
            <div>
              <h3 title={vehicle.name}>{vehicle.name}</h3>
              <p>
                {catalog.countries[vehicle.country as keyof typeof catalog.countries] ||
                  "国家待匹配"}
              </p>
            </div>
            <span className="wt-vehicle-card-rank">
              {vehicle.rank || "—"}
              <small>级</small>
            </span>
          </header>
          <div className="wt-vehicle-card-art">
            <img
              src={vehicle.image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(event) => {
                if (event.currentTarget.src !== vehicle.thumbnail)
                  event.currentTarget.src = vehicle.thumbnail;
              }}
            />
          </div>
          <div className="wt-vehicle-card-rating">
            <span>作战效率</span>
            <strong>{num(vehicle.efficiency)}</strong>
            <small>{vehicle.smallSample ? "场次不足 50" : "累计表现"}</small>
          </div>
          <dl className="wt-vehicle-card-values">
            {[
              ["场次", num(vehicle.battles)],
              ["胜率", vehicle.winRate == null ? "—" : `${vehicle.winRate.toFixed(2)}%`],
              ["综合 K/D", ratio(vehicle.kd)],
              ["对空 K/D", ratio(vehicle.airKd)],
              ["对地 K/D", ratio(vehicle.groundKd)],
              [
                showNaval ? "对海 K/D" : "出击",
                showNaval
                  ? vehicle.category === "ground"
                    ? "—"
                    : ratio(vehicle.navalKd)
                  : num(vehicle.sorties),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <footer className="wt-vehicle-card-footer">
            <span title={`累计银狮：${statsSilver(vehicle.silverLions)}`}>
              <img src={statsSilverIcon} alt="银狮" />
              <strong>{compactSilver(vehicle.silverLions)}</strong>
            </span>
            <div className="wt-vehicle-card-actions">
              <button onClick={() => select(vehicle)} aria-label={`查看${vehicle.name}详情`}>
                查看详情
              </button>
              <button onClick={() => generate(vehicle)} aria-label={`生成${vehicle.name}战绩图片`}>
                生成图片
              </button>
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
}

export function PlayerVehiclePagination({
  page,
  pages,
  total,
  pageSize,
  changePage,
  changeSize,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  changePage: (page: number) => void;
  changeSize: (size: number) => void;
}) {
  return (
    <div className="wt-vehicle-pagination" aria-label="载具战绩分页">
      <span>
        {total ? `${num((page - 1) * pageSize + 1)}–${num(Math.min(total, page * pageSize))}` : "0"}{" "}
        / {num(total)} 辆
      </span>
      <GameSelect
        aria-label="每页载具数量"
        value={pageSize}
        onValueChange={(v) => changeSize(Number(v))}
      >
        {[20, 40, 80].map((size) => (
          <option key={size} value={size}>
            {size} 辆 / 页
          </option>
        ))}
      </GameSelect>
      <div className="wt-vehicle-page-controls">
        <button disabled={page <= 1} onClick={() => changePage(1)} aria-label="载具战绩第一页">
          首页
        </button>
        <button disabled={page <= 1} onClick={() => changePage(page - 1)}>
          上一页
        </button>
        <GameSelect
          aria-label="载具战绩页码"
          value={page}
          onValueChange={(v) => changePage(Number(v))}
        >
          {Array.from({ length: pages }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} / {pages}
            </option>
          ))}
        </GameSelect>
        <button disabled={page >= pages} onClick={() => changePage(page + 1)}>
          下一页
        </button>
        <button
          disabled={page >= pages}
          onClick={() => changePage(pages)}
          aria-label="载具战绩最后一页"
        >
          末页
        </button>
      </div>
    </div>
  );
}
