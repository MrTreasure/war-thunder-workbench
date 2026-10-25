import { t, localize, vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useVehicleCatalog, withVehicleFacts } from "./vehicle-catalog";
import { VehicleTile } from "./VehicleTile";
import { garageVehicleRecords } from "./garage-vehicles";
import {
  comparePlayerVehicles,
  type VehicleSort,
  type VehicleSortKey,
} from "./player-vehicle-sort";
import valuationRules from "../data/account-valuation-rules.json";
import { useState } from "react";
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
  useLocale();
  const read = usePlayerRead<OwnedGarage>(profile, "garage", true);
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
      (vehicleName(v).toLowerCase().includes(search.toLowerCase()) ||
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
    normal: t("常规载具"),
    gold: t("金鹰载具"),
    pack: t("礼包载具"),
    squadron: t("联队载具"),
    event: t("活动载具"),
    premium: t("高级载具"),
    gift: t("特殊载具"),
    research: t("研发载具"),
  };
  return (
    <section className="wt-garage-inventory" aria-label={t("完整车库载具")}>
      <div className="wt-owned-content">
        <div className="wt-owned-summary">
          <strong>
            {localize(num(units.length))} <small>{t("辆已拥有")}</small>
          </strong>
          <span>
            {localize(num(units.filter((v) => !v.observed).length))}
            {t("辆未出击")}
          </span>
          <span>
            {localize(
              read.data ? t("车库采集于 {0}", [localize(statsDate(read.data.fetchedAt))]) : "",
            )}
          </span>
        </div>
        <div className="wt-record-filters wt-garage-filters" aria-label={t("车库筛选与排序")}>
          <GameSelect
            aria-label={t("车库战斗模式")}
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              setPage(1);
            }}
          >
            <option value="ab">{t("街机 AB")}</option>
            <option value="rb">{t("历史 RB")}</option>
            <option value="sb">{t("全真 SB")}</option>
          </GameSelect>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("搜索载具名称")}
            aria-label={t("搜索完整车库载具")}
          />
          <GameSelect
            aria-label={t("车库国家")}
            value={country}
            onValueChange={(v) => {
              setCountry(v);
              setPage(1);
            }}
          >
            <option value="all">{t("全部国家")}</option>
            {localize(
              Object.keys(catalog.countries).map((id) => (
                <option key={id} value={id}>
                  {localize(statsCountryLabel(id))}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect
            aria-label={t("车库军种")}
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <option value="all">{t("全部军种")}</option>
            {localize(
              Object.entries(statsCategoryNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {localize(name)}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect
            aria-label={t("车库等级")}
            value={rank}
            onValueChange={(v) => {
              setRank(v);
              setPage(1);
            }}
          >
            <option value="all">{t("全部等级")}</option>
            {localize(
              ranks.map((v) => (
                <option key={v} value={v}>
                  {localize(v)}
                  {t("级")}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect
            aria-label={t("车库载具类型")}
            value={kind}
            onValueChange={(v) => {
              setKind(v);
              setPage(1);
            }}
          >
            <option value="all">{t("全部类型")}</option>
            {localize(
              kinds.map((v) => (
                <option value={v} key={v}>
                  {localize(kindLabels[v] || v)}
                </option>
              )),
            )}
          </GameSelect>
          <GameSelect
            aria-label={t("车库出击状态")}
            value={played}
            onValueChange={(v) => {
              setPlayed(v);
              setPage(1);
            }}
          >
            <option value="all">{t("全部出击状态")}</option>
            <option value="yes">{t("已出击")}</option>
            <option value="no">{t("未出击")}</option>
          </GameSelect>
          <GameSelect
            aria-label={t("车库载具排序")}
            value={sort?.key || "none"}
            onValueChange={(v) => {
              setSort(v === "none" ? null : { key: v as VehicleSortKey, direction: "desc" });
              setPage(1);
            }}
          >
            <option value="none">{t("不排序")}</option>
            {localize(
              (
                [
                  ["battles", t("场次")],
                  ["efficiency", t("作战效率")],
                  ["winRate", t("胜率")],
                  ["kd", t("综合 K/D")],
                  ["airKd", t("对空 K/D")],
                  ["groundKd", t("对地 K/D")],
                  ["silverLions", t("银狮")],
                ] as const
              ).map(([id, label]) => (
                <option key={id} value={id}>
                  {t("按")}
                  {localize(label)}
                  {t("排序")}
                </option>
              )),
            )}
          </GameSelect>
          <button
            disabled={!sort}
            onClick={() => {
              if (sort) setSort({ ...sort, direction: sort.direction === "desc" ? "asc" : "desc" });
            }}
          >
            {localize(sort?.direction === "asc" ? t("升序 ↑") : t("降序 ↓"))}
          </button>
          <button disabled={!sort} onClick={() => setSort(null)}>
            {t("清除排序")}
          </button>
        </div>
        {localize(
          read.busy && !read.data && (
            <output className="wt-rank-loading">{t("正在读取完整车库…")}</output>
          ),
        )}
        {localize(
          read.error && (
            <div className="wt-rank-error" role="alert">
              <span>{localize(read.error)}</span>
              {localize(!profile.localOnly && <button onClick={read.retry}>{t("重试")}</button>)}
            </div>
          ),
        )}
        {localize(
          read.data && (
            <>
              <p className="wt-record-fine">
                {t("筛选出")}
                {localize(num(filtered.length))}
                {t("辆")}
                {localize(
                  read.data.unmatchedCount > 0
                    ? t(" · {0} 辆尚未匹配分类，仍保留在清单中", [
                        localize(read.data.unmatchedCount),
                      ])
                    : "",
                )}
              </p>
              <div className="wt-vehicle-tile-grid wt-garage-tiles">
                {localize(
                  vehicles
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((vehicle) => {
                      const owned = filtered.find((v) => v.id === vehicle.id)!;
                      return (
                        <article className="wt-vehicle-option" key={vehicle.id}>
                          <VehicleTile
                            unit={{ ...owned, image: vehicle.image, thumbnail: vehicle.thumbnail }}
                            owned
                            footerLabel={owned.rank ? `Rank ${owned.rank}` : undefined}
                            mode={mode as "ab" | "rb" | "sb"}
                            onSelect={() => selectVehicle(vehicle)}
                          />
                          <small>
                            {localize(statsCountryLabel(owned.country))} ·{localize(" ")}
                            {localize(noRecords.has(vehicle.id) ? t("未出击") : t("已出击"))}
                          </small>
                        </article>
                      );
                    }),
                )}
              </div>
              {localize(
                filtered.length === 0 && (
                  <p className="wt-record-empty">{t("没有符合当前筛选的载具。")}</p>
                ),
              )}
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
          ),
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
  useLocale();
  const content = (
    <div className="wt-owned-content">
      <div className="wt-vehicle-record-identity">
        <img src={vehicle.image} alt="" />
        <div>
          <h3>{vehicleName(vehicle)}</h3>
          <p>
            {localize(vehicle.mode.toUpperCase())} ·{localize(" ")}
            {localize(statsCategoryNames[vehicle.category || ""] || t("分类待匹配"))}
            {localize(vehicle.rank ? t(" · {0} 级", [localize(vehicle.rank)]) : "")}
          </p>
          <a
            href={`https://wiki.warthunder.com/unit/${encodeURIComponent(vehicle.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("查看官方 Wiki ↗")}
          </a>
        </div>
      </div>
      {localize(
        inline && vehicle.battles == null ? (
          <p className="wt-vehicle-card-no-record">{t("暂无出击记录")}</p>
        ) : (
          <>
            <div className="wt-vehicle-record-counters">
              {localize(
                [
                  [t("战斗场次"), num(vehicle.battles)],
                  [t("胜率"), vehicle.winRate == null ? "—" : `${vehicle.winRate.toFixed(2)}%`],
                  [t("工作台效率"), num(vehicle.efficiency)],
                  [t("综合 K/D"), statsRatio(vehicle.kd)],
                  [t("对地 K/D"), statsRatio(vehicle.groundKd)],
                  [t("对空 K/D"), statsRatio(vehicle.airKd)],
                  [t("死亡"), num(vehicle.deaths)],
                  [t("出击"), num(vehicle.sorties)],
                  [t("对地击毁"), num(vehicle.groundKills)],
                  [t("对空击毁"), num(vehicle.airKills)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{localize(label)}</span>
                    <strong>{localize(value)}</strong>
                  </div>
                )),
              )}
            </div>
            <p className="wt-vehicle-record-silver">
              <img src={statsSilverIcon} alt={t("银狮")} />
              {t("累计银狮")}
              {localize(" ")}
              <strong title={statsSilver(vehicle.silverLions)}>
                {localize(compactSilver(vehicle.silverLions))}
              </strong>
            </p>
          </>
        ),
      )}
    </div>
  );
  if (inline)
    return (
      <section className="wt-record-panel wt-garage-detail" aria-label={t("载具战绩详情")}>
        <header>
          <h2>
            {vehicleName(vehicle)} · {localize(vehicle.mode.toUpperCase())}
          </h2>
          <button onClick={close}>{t("← 返回车库")}</button>
        </header>
        {localize(content)}
      </section>
    );
  return (
    <Modal
      title={vehicleName(vehicle)}
      subtitle={t("{0} · {1} · 载具累计战绩", [
        localize(profile.nickname),
        localize(vehicle.mode.toUpperCase()),
      ])}
      close={close}
      className="wt-owned-garage wt-vehicle-record-dialog"
    >
      {localize(content)}
    </Modal>
  );
}
