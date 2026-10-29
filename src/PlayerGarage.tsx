import { useVehicleCatalog, withVehicleFacts } from "./vehicle-catalog";
import { VehicleTile } from "./VehicleTile";
import { garageVehicleRecords } from "./garage-vehicles";
import {
  comparePlayerVehicles,
  type VehicleSort,
  type VehicleSortKey,
} from "./player-vehicle-sort";
import valuationRules from "../data/account-valuation-rules.json";
import { vehicleDisplayName } from "./vehicle-display-name";
import { useEffect, useState } from "react";
import { useAccountWorkspace } from "./workspace-context";
import catalog from "../data/catalog-settings.json";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import {
  statsDate,
  statsNumber as num,
  statsCategoryNames,
  statsRatio,
  statsSilver,
  statsSilverIcon,
} from "./player-stats-api";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { usePlayerRead } from "./player-rankings-api";
import type { OwnedGarage, PlayerDetails } from "./player-rankings-api";
import { compactSilver, savedVehiclePageSize, saveVehiclePageSize } from "./player-number-format";
import { PlayerVehiclePagination } from "./PlayerVehicleCards";
import { statsCountryMatches, statsCountryLabel } from "./stats-country";

export function PlayerGarage({
  profile,
  selectVehicle,
}: {
  profile: PlayerProfile;
  selectVehicle: (vehicle: PlayerVehicle) => void;
}) {
  const read = usePlayerRead<OwnedGarage>(profile, "garage", true);
  const syncOwnedGarage = useAccountWorkspace()?.syncOwnedGarage;
  useEffect(() => {
    if (read.data) syncOwnedGarage?.(read.data);
  }, [read.data, syncOwnedGarage]);
  const details = usePlayerRead<PlayerDetails>(profile, "details", true);
  const detailRecords =
    details.data && Date.parse(details.data.fetchedAt) >= Date.parse(profile.fetchedAt)
      ? details.data.vehicles
      : [];
  const [country, setCountry] = useState("all"),
    [category, setCategory] = useState("all"),
    [rank, setRank] = useState("all");
  const [kind, setKind] = useState("all"),
    [played, setPlayed] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedVehiclePageSize);
  const [mode, setMode] = useState("rb");
  const [sort, setSort] = useState<VehicleSort | null>({ key: "battles", direction: "desc" });
  const rawUnits = read.data?.vehicles || [];
  const facts = useVehicleCatalog(rawUnits.map((v) => v.country));
  const units = rawUnits.map((v) => withVehicleFacts(v, facts));
  const filtered = units.filter(
    (v) =>
      statsCountryMatches(v.country, country) &&
      (category === "all" || v.category === category) &&
      (rank === "all" || v.rank === rank) &&
      (kind === "all" || v.kind === kind) &&
      (played === "all" || v.observed === (played === "yes")) &&
      (vehicleDisplayName(v.name).toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase())),
  );
  const vehicles = garageVehicleRecords(filtered, profile.vehicles, mode, detailRecords);
  if (sort) vehicles.sort((a, b) => comparePlayerVehicles(a, b, sort));
  const noRecords = new Set(
    filtered
      .filter(
        (v) =>
          !v.observed ||
          (!profile.vehicles.some((r) => r.id === v.id && r.mode === mode) &&
            !detailRecords.some((r) => r.id === v.id && r.mode === mode)),
      )
      .map((v) => v.id),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const ranks = valuationRules.researchRanks;
  const kinds = [...new Set(units.flatMap((v) => (v.kind ? [v.kind] : [])))];
  const kindLabels: Record<string, string> = {
    normal: "常规载具",
    gold: "金鹰载具",
    pack: "礼包载具",
    squadron: "联队载具",
    event: "活动载具",
    premium: "高级载具",
    gift: "特殊载具",
    research: "研发载具",
  };
  return (
    <section className="wt-garage-inventory" aria-label="完整车库载具">
      <div className="wt-owned-content">
        <div className="wt-owned-summary">
          <strong>
            {num(units.length)} <small>辆已拥有</small>
          </strong>
          <span>{num(units.filter((v) => !v.observed).length)} 辆未出击</span>
          <span>{read.data ? `车库采集于 ${statsDate(read.data.fetchedAt)}` : ""}</span>
        </div>
        <div className="wt-record-filters wt-garage-filters" aria-label="车库筛选与排序">
          <GameSelect
            aria-label="车库战斗模式"
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              setPage(1);
            }}
          >
            <option value="ab">街机 AB</option>
            <option value="rb">历史 RB</option>
            <option value="sb">全真 SB</option>
          </GameSelect>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="搜索载具名称"
            aria-label="搜索完整车库载具"
          />
          <GameSelect
            aria-label="车库国家"
            value={country}
            onValueChange={(v) => {
              setCountry(v);
              setPage(1);
            }}
          >
            <option value="all">全部国家</option>
            {Object.keys(catalog.countries).map((id) => (
              <option key={id} value={id}>
                {statsCountryLabel(id)}
              </option>
            ))}
          </GameSelect>
          <GameSelect
            aria-label="车库军种"
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <option value="all">全部军种</option>
            {Object.entries(statsCategoryNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </GameSelect>
          <GameSelect
            aria-label="车库等级"
            value={rank}
            onValueChange={(v) => {
              setRank(v);
              setPage(1);
            }}
          >
            <option value="all">全部等级</option>
            {ranks.map((v) => (
              <option key={v} value={v}>
                {v} 级
              </option>
            ))}
          </GameSelect>
          <GameSelect
            aria-label="车库载具类型"
            value={kind}
            onValueChange={(v) => {
              setKind(v);
              setPage(1);
            }}
          >
            <option value="all">全部类型</option>
            {kinds.map((v) => (
              <option value={v} key={v}>
                {kindLabels[v] || v}
              </option>
            ))}
          </GameSelect>
          <GameSelect
            aria-label="车库出击状态"
            value={played}
            onValueChange={(v) => {
              setPlayed(v);
              setPage(1);
            }}
          >
            <option value="all">全部出击状态</option>
            <option value="yes">已出击</option>
            <option value="no">未出击</option>
          </GameSelect>
          <GameSelect
            aria-label="车库载具排序"
            value={sort?.key || "none"}
            onValueChange={(v) => {
              setSort(v === "none" ? null : { key: v as VehicleSortKey, direction: "desc" });
              setPage(1);
            }}
          >
            <option value="none">不排序</option>
            {(
              [
                ["battles", "场次"],
                ["efficiency", "作战效率"],
                ["winRate", "胜率"],
                ["kd", "综合 K/D"],
                ["airKd", "对空 K/D"],
                ["groundKd", "对地 K/D"],
                ["silverLions", "银狮"],
              ] as const
            ).map(([id, label]) => (
              <option key={id} value={id}>
                按{label}排序
              </option>
            ))}
          </GameSelect>
          <button
            disabled={!sort}
            onClick={() => {
              if (sort) setSort({ ...sort, direction: sort.direction === "desc" ? "asc" : "desc" });
            }}
          >
            {sort?.direction === "asc" ? "升序 ↑" : "降序 ↓"}
          </button>
          <button disabled={!sort} onClick={() => setSort(null)}>
            清除排序
          </button>
        </div>
        {read.busy && !read.data && <output className="wt-rank-loading">正在读取完整车库…</output>}
        {read.error && (
          <div className="wt-rank-error" role="alert">
            <span>{read.error}</span>
            {!profile.localOnly && <button onClick={read.retry}>重试</button>}
          </div>
        )}
        {read.data && (
          <>
            <p className="wt-record-fine">
              筛选出 {num(filtered.length)} 辆
              {read.data.unmatchedCount > 0
                ? ` · ${read.data.unmatchedCount} 辆尚未匹配分类，仍保留在清单中`
                : ""}
            </p>
            <div className="wt-vehicle-tile-grid wt-garage-tiles">
              {vehicles
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((vehicle) => {
                  const owned = filtered.find((v) => v.id === vehicle.id)!;
                  return (
                    <article className="wt-vehicle-option" key={vehicle.id}>
                      <VehicleTile
                        unit={{ ...owned, image: vehicle.image, thumbnail: vehicle.thumbnail }}
                        owned
                        showRank={rank === "all"}
                        countryLabel={
                          country === "all" ? statsCountryLabel(owned.country) : undefined
                        }
                        mode={mode as "ab" | "rb" | "sb"}
                        onSelect={() => selectVehicle(vehicle)}
                      />
                      <small>{noRecords.has(vehicle.id) ? "未出击" : "已出击"}</small>
                    </article>
                  );
                })}
            </div>
            {filtered.length === 0 && <p className="wt-record-empty">没有符合当前筛选的载具。</p>}
            <PlayerVehiclePagination
              page={currentPage}
              pages={pages}
              total={filtered.length}
              pageSize={pageSize}
              changePage={setPage}
              changeSize={(size) => {
                setPageSize(size);
                setPage(1);
                saveVehiclePageSize(size);
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}

export function PlayerVehicleDetails({
  profile,
  vehicle,
  close,
  inline = false,
}: {
  profile: PlayerProfile;
  vehicle: PlayerVehicle;
  close: () => void;
  inline?: boolean;
}) {
  const content = (
    <div className="wt-owned-content">
      <div className="wt-vehicle-record-identity">
        <img src={vehicle.image} alt="" />
        <div>
          <h3>{vehicleDisplayName(vehicle.name)}</h3>
          <p>
            {vehicle.mode.toUpperCase()} ·{" "}
            {statsCategoryNames[vehicle.category || ""] || "分类待匹配"}
            {vehicle.rank ? ` · ${vehicle.rank} 级` : ""}
          </p>
          <a
            href={`https://wiki.warthunder.com/unit/${encodeURIComponent(vehicle.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            查看官方 Wiki ↗
          </a>
        </div>
      </div>
      {inline && vehicle.battles == null ? (
        <p className="wt-vehicle-card-no-record">暂无出击记录</p>
      ) : (
        <>
          <div className="wt-vehicle-record-counters">
            {[
              ["战斗场次", num(vehicle.battles)],
              ["胜率", vehicle.winRate == null ? "—" : `${vehicle.winRate.toFixed(2)}%`],
              ["工作台效率", num(vehicle.efficiency)],
              ["综合 K/D", statsRatio(vehicle.kd)],
              ["对地 K/D", statsRatio(vehicle.groundKd)],
              ["对空 K/D", statsRatio(vehicle.airKd)],
              ["死亡", num(vehicle.deaths)],
              ["出击", num(vehicle.sorties)],
              ["对地击毁", num(vehicle.groundKills)],
              ["对空击毁", num(vehicle.airKills)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="wt-vehicle-record-silver">
            <img src={statsSilverIcon} alt="银狮" />
            累计银狮{" "}
            <strong title={statsSilver(vehicle.silverLions)}>
              {compactSilver(vehicle.silverLions)}
            </strong>
          </p>
        </>
      )}
    </div>
  );
  if (inline)
    return (
      <section className="wt-record-panel wt-garage-detail" aria-label="载具战绩详情">
        <header>
          <h2>
            {vehicleDisplayName(vehicle.name)} · {vehicle.mode.toUpperCase()}
          </h2>
          <button onClick={close}>← 返回车库</button>
        </header>
        {content}
      </section>
    );
  return (
    <Modal
      title={vehicleDisplayName(vehicle.name)}
      subtitle={`${profile.nickname} · ${vehicle.mode.toUpperCase()} · 载具累计战绩`}
      close={close}
      className="wt-owned-garage wt-vehicle-record-dialog"
    >
      {content}
    </Modal>
  );
}
