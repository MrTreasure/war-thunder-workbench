import { vehicleSearchText } from "./i18n/core";
import { vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import { vehicleDisplayName } from "./vehicle-display-name";
import { useState } from "react";
import catalog from "../data/catalog-settings.json";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import {
  statsDate,
  statsGoldenEaglesIcon,
  statsNumber as num,
  statsCategoryNames,
  statsRatio,
  statsSilver,
  statsSilverIcon,
} from "./player-stats-api";
import type { PlayerProfile, PlayerVehicle } from "./player-stats-api";
import { usePlayerRead } from "./player-rankings-api";
import type { OwnedGarage } from "./player-rankings-api";
import { compactSilver, savedVehiclePageSize, saveVehiclePageSize } from "./player-number-format";
import { PlayerVehiclePagination } from "./PlayerVehicleCards";

export function PlayerGarage({
  profile,
  close,
  selectVehicle,
}: {
  profile: PlayerProfile;
  close: () => void;
  selectVehicle: (vehicle: PlayerVehicle) => void;
}) {
  useLocale();

  const read = usePlayerRead<OwnedGarage>(profile, "garage", true);
  const [country, setCountry] = useState("all"),
    [category, setCategory] = useState("all"),
    [rank, setRank] = useState("all");
  const [kind, setKind] = useState("all"),
    [played, setPlayed] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(savedVehiclePageSize);
  const units = read.data?.vehicles || [];
  const filtered = units.filter(
    (v) =>
      (country === "all" || v.country === country) &&
      (category === "all" || v.category === category) &&
      (rank === "all" || v.rank === rank) &&
      (kind === "all" || v.kind === kind) &&
      (played === "all" || v.observed === (played === "yes")) &&
      (vehicleSearchText(v).toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const ranks = [...new Set(units.flatMap((v) => (v.rank ? [v.rank] : [])))];
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
    <Modal
      title={localize(`${profile.nickname} · 完整车库`)}
      subtitle="所有已拥有载具，包含未出击车辆；查看清单不消耗估值次数。"
      close={close}
      className="wt-owned-garage"
    >
      <div className="wt-owned-content">
        <div className="wt-owned-summary">
          <strong>
            {localize(num(units.length))} <small>{t("辆已拥有")}</small>
          </strong>
          <span>
            {localize(num(units.filter((v) => !v.observed).length))} {t("辆未出击")}
          </span>
          <span>
            {localize(read.data ? `车库采集于 ${localize(statsDate(read.data.fetchedAt))}` : "")}
          </span>
        </div>
        <div className="wt-owned-filters">
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
              Object.entries(catalog.countries).map(([id, name]) => (
                <option key={id} value={id}>
                  {localize(name)}
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
                  {localize(v)} {t("级")}
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
                {localize(num(filtered.length))} {t("辆")}
                {localize(
                  read.data.unmatchedCount > 0
                    ? ` · ${localize(read.data.unmatchedCount)} 辆尚未匹配分类，仍保留在清单中`
                    : "",
                )}
              </p>
              <div className="wt-owned-list">
                {localize(
                  filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((v) => {
                    const record = [...profile.vehicles]
                      .filter((r) => r.id === v.id)
                      .sort((a, b) => (b.battles || 0) - (a.battles || 0))[0];
                    return (
                      <div key={v.id} className="wt-owned-row">
                        <img
                          src={v.image}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.hidden = true;
                          }}
                        />
                        <div>
                          <a
                            href={`https://wiki.warthunder.com/unit/${encodeURIComponent(v.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {localize(vehicleDisplayName(vehicleName(v)))}
                          </a>
                          <small>
                            {localize(
                              catalog.countries[v.country as keyof typeof catalog.countries] ||
                                v.country,
                            )}
                            {localize(" ")}·{" "}
                            {localize(statsCategoryNames[v.category || ""] || "分类待匹配")}
                            {localize(v.rank ? ` · ${localize(v.rank)} 级` : "")}
                          </small>
                        </div>
                        <span className={v.observed ? "wt-owned-played" : "wt-owned-unplayed"}>
                          {localize(v.observed ? "已出击" : "未出击")}
                        </span>
                        {localize(
                          v.elite && (
                            <span className="wt-owned-elite">
                              <img src={statsGoldenEaglesIcon} alt="" />
                              {t("精英")}
                            </span>
                          ),
                        )}
                        {localize(
                          record && (
                            <button onClick={() => selectVehicle(record)}>{t("查看战绩")}</button>
                          ),
                        )}
                      </div>
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
    </Modal>
  );
}

export function PlayerVehicleDetails({
  profile,
  vehicle,
  close,
}: {
  profile: PlayerProfile;
  vehicle: PlayerVehicle;
  close: () => void;
}) {
  useLocale();

  return (
    <Modal
      key="detail"
      title={localize(vehicleDisplayName(vehicleName(vehicle)))}
      subtitle={`${profile.nickname} · ${vehicle.mode.toUpperCase()} · 载具累计战绩`}
      close={close}
      className="wt-owned-garage wt-vehicle-record-dialog"
    >
      <div className="wt-owned-content">
        <div className="wt-vehicle-record-identity">
          <img src={vehicle.image} alt="" />
          <div>
            <h3>{localize(vehicleDisplayName(vehicleName(vehicle)))}</h3>
            <p>
              {localize(vehicle.mode.toUpperCase())} ·{localize(" ")}
              {localize(statsCategoryNames[vehicle.category || ""] || "分类待匹配")}
              {localize(vehicle.rank ? ` · ${localize(vehicle.rank)} 级` : "")}
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
        <div className="wt-vehicle-record-counters">
          {localize(
            [
              ["战斗场次", num(vehicle.battles)],
              ["胜率", vehicle.winRate == null ? "—" : `${localize(vehicle.winRate.toFixed(2))}%`],
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
          <strong title={localize(statsSilver(vehicle.silverLions))}>
            {localize(compactSilver(vehicle.silverLions))}
          </strong>
        </p>
      </div>
    </Modal>
  );
}
