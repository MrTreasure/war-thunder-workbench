import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
import { createPortal } from "react-dom";
import { HomeResearchPlans } from "./HomeResearchPlans";
import { HomeActivity } from "./HomeActivity";
import { HomeWatchSection } from "./HomeWatchSection";
import { GameIcon, type GameIconName } from "./components/GameIcon";
import mapIcons from "../data/map-editor-icons.json";
import { useLoadoutPlans } from "./loadout-storage";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import bootstrap from "./generated/bootstrap.json";
import { useAccountWorkspace, workspaceKey } from "./workspace-context";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { HOME_SUMMARY_LIMIT, homeDashboardSummary } from "./home-dashboard-model";
import "./home-dashboard.css";

const HomeLoadoutDetails = lazy(() => import("./HomeLoadoutDetails"));

function readGuestDocuments() {
  const documents: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !workspaceKey(key) || key === "wt-loadouts-v1") continue;
      try {
        documents[key] = JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        /* Skip damaged entries. */
      }
    }
  } catch {
    /* Storage may be disabled. */
  }
  return documents;
}
const countryName = (id: string) =>
  bootstrap.countries[id as keyof typeof bootstrap.countries] || "国家未知";
const homeSectionIcons: Record<string, GameIconName> = {
  研发计划: "research",
  出击队列: "crew",
  模拟挂载: "loadout",
  载具关注: "details",
};
const mapShortcutIcon = mapIcons.icons.find((icon) => icon.id === "capturezone_small")!;
function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action: ReactNode;
  children: ReactNode;
}) {
  useLocale();
  return (
    <section className="wt-home-section">
      <header>
        <h3>
          <GameIcon name={homeSectionIcons[title] || "details"} />
          {localize(title)}
          <span>{localize(count)}</span>
        </h3>
        {localize(action)}
      </header>
      {localize(children)}
      {localize(
        count > HOME_SUMMARY_LIMIT && (
          <p className="wt-home-empty">
            {t("显示前")}
            {localize(HOME_SUMMARY_LIMIT)}
            {t("项，共")}
            {localize(count)}
            {t("项。")}
          </p>
        ),
      )}
    </section>
  );
}
function HomeLoadoutSection({ owner }: { owner: string }) {
  useLocale();
  const [plans, , error, status] = useLoadoutPlans(owner);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = plans.find((plan) => plan.id === selectedId);
  const recent = [...plans].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return (
    <>
      <Section
        title={t("模拟挂载")}
        count={plans.length}
        action={
          <Link to="/loadouts" preload={false}>
            {t("查看全部挂载 →")}
          </Link>
        }
      >
        {localize(
          error ? (
            <p className="wt-home-notice" role="alert">
              {localize(error)}
              {localize(" ")}
              <button className="quiet-button" onClick={() => void status.reload()}>
                {t("重试")}
              </button>
            </p>
          ) : status.loading ? (
            <output className="wt-home-notice">{t("正在读取挂载方案…")}</output>
          ) : recent.length ? (
            <ul>
              {localize(
                recent.slice(0, HOME_SUMMARY_LIMIT).map((plan) => (
                  <li key={plan.id}>
                    <div>
                      <strong>{localize(plan.name || "未命名挂载")}</strong>
                      <span>
                        {localize(countryName(plan.country))}
                        {t("· 更新于")}
                        {localize(" ")}
                        {localize(new Date(plan.updatedAt).toLocaleDateString(getLocale()))}
                      </span>
                    </div>
                    <button className="quiet-button" onClick={() => setSelectedId(plan.id)}>
                      {t("查看详情")}
                    </button>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <p className="wt-home-empty">
              {t("还没有保存的挂载方案。进入模拟挂载，添加机型后开始配置。")}
            </p>
          ),
        )}
      </Section>
      {localize(
        selected && (
          <Suspense fallback={<output className="wt-home-notice">{t("正在打开挂载详情…")}</output>}>
            <HomeLoadoutDetails
              plan={selected}
              summary={status.summaries[selected.id]}
              error={status.previewError}
              close={() => setSelectedId(null)}
            />
          </Suspense>
        ),
      )}
    </>
  );
}
export function HomeDashboard() {
  useLocale();
  const { session } = useWorkbenchAccount();
  const workspace = useAccountWorkspace();
  const userId = session?.user?.id || "";
  const [guest, setGuest] = useState(readGuestDocuments);
  useEffect(() => {
    const update = () => setGuest(readGuestDocuments());
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  // Never fall back to a different account's documents while a new session restores.
  const currentWorkspace = userId && workspace?.userId === userId ? workspace : null;
  const documents = userId
    ? Object.fromEntries(
        Object.entries(currentWorkspace?.documents || {}).map(([key, doc]) => [key, doc.value]),
      )
    : guest;
  const summary = homeDashboardSummary(documents);
  const pending = !!userId && !currentWorkspace?.ready;
  const [garageSync, setGarageSync] = useState({ owner: "", busy: false, message: "" });
  const ownerRef = useRef(userId);
  useEffect(() => {
    ownerRef.current = userId;
    return () => {
      ownerRef.current = "";
    };
  }, [userId]);
  const syncBusy = garageSync.owner === userId && garageSync.busy;
  const garageMessage = garageSync.owner === userId ? garageSync.message : "";
  useEffect(() => {
    if (!garageMessage) return;
    const timer = window.setTimeout(
      () => setGarageSync((previous) => ({ ...previous, message: "" })),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [garageMessage]);
  async function refreshGarage() {
    if (!currentWorkspace?.binding || syncBusy) {
      currentWorkspace?.open();
      return;
    }
    const owner = userId;
    setGarageSync({ owner, busy: true, message: "" });
    try {
      await currentWorkspace.refreshOwnedGarage();
      await currentWorkspace.reload();
      if (ownerRef.current === owner)
        setGarageSync({ owner, busy: false, message: "车库信息已同步。" });
    } catch (error) {
      if (ownerRef.current === owner)
        setGarageSync({
          owner,
          busy: false,
          message: error instanceof Error ? error.message : "车库同步失败，请重试。",
        });
    }
  }
  return (
    <main className="wt-home">
      {localize(
        garageMessage &&
          createPortal(
            <output className="wt-home-message" aria-live="polite">
              {localize(garageMessage)}
            </output>,
            document.body,
          ),
      )}
      <header className="wt-home-heading">
        <div>
          <p>{t("研发 · 配置 · 出击")}</p>
          <h2 className="sr-only">{t("我的工作台")}</h2>
          <span>{t("接着完善你的计划，或从一项工具开始。")}</span>
        </div>
        <div className="wt-home-account">
          <span>
            {localize(userId ? currentWorkspace?.status || "正在读取云端" : "本机游客数据")}
          </span>
          {localize(
            currentWorkspace && (
              <button className="quiet-button" onClick={currentWorkspace.open}>
                {t("云端数据")}
              </button>
            ),
          )}
        </div>
      </header>
      {localize(
        pending && <output className="wt-home-notice">{t("正在读取当前账号的方案…")}</output>,
      )}
      {localize(
        currentWorkspace?.error && (
          <p className="wt-home-notice" role="alert">
            {localize(currentWorkspace.error)}
            <button className="quiet-button" onClick={currentWorkspace.open}>
              {t("处理同步")}
            </button>
          </p>
        ),
      )}
      <nav className="wt-home-shortcuts" aria-label={t("快速开始")}>
        <Link to="/tree" preload={false}>
          <strong>
            <GameIcon name="research" />
            {t("科技树")}
          </strong>
          <span>{t("查看载具与规划研发 →")}</span>
        </Link>
        <Link to="/lineups" preload={false}>
          <strong>
            <GameIcon name="crew" />
            {t("出击队列")}
          </strong>
          <span>{t("管理乘员槽位与配置 →")}</span>
        </Link>
        <Link to="/loadouts" preload={false}>
          <strong>
            <GameIcon name="loadout" />
            {t("模拟挂载")}
          </strong>
          <span>{t("为机型配置武器挂载 →")}</span>
        </Link>
        <Link to="/maps" preload={false}>
          <strong>
            <img
              className="wt-control-icon"
              src={mapShortcutIcon.asset.url}
              width={20}
              height={20}
              alt=""
              aria-hidden="true"
            />
            {t("陆战地图")}
          </strong>
          <span>{t("查看地图与编辑战术 →")}</span>
        </Link>
      </nav>
      <HomeActivity />
      <div className="wt-home-grid" aria-busy={pending}>
        <Section
          title={t("研发计划")}
          count={summary.plans.length}
          action={
            <div className="wt-home-section-actions">
              <button
                className="quiet-button"
                disabled={!currentWorkspace?.binding || syncBusy}
                onClick={() => void refreshGarage()}
              >
                {localize(syncBusy ? "正在同步…" : "刷新同步车库")}
              </button>
              <Link to="/tree" preload={false}>
                {t("查看全部 · 科技树 →")}
              </Link>
            </div>
          }
        >
          {localize(
            summary.plans.length ? (
              <HomeResearchPlans
                key={userId || "guest"}
                plans={summary.plans}
                ownedIds={currentWorkspace?.binding ? currentWorkspace.ownedVehicleIds : null}
              />
            ) : (
              <p className="wt-home-empty">
                {localize(
                  pending
                    ? "研发计划正在恢复。"
                    : "还没有保存的研发计划。在科技树选择目标，打开研发规划后即可保存。",
                )}
              </p>
            ),
          )}
        </Section>
        <HomeWatchSection key={userId || "guest"} watches={summary.watches} pending={pending} />
        {localize(
          userId ? (
            <HomeLoadoutSection key={userId} owner={userId} />
          ) : (
            <Section
              title={t("模拟挂载")}
              count={0}
              action={
                <Link to="/loadouts" preload={false}>
                  {t("打开模拟挂载 →")}
                </Link>
              }
            >
              <p className="wt-home-empty">{t("登录后可保存挂载方案，并在这里查看。")}</p>
            </Section>
          ),
        )}
        <Section
          title={t("出击队列")}
          count={summary.lineups.length}
          action={
            <Link to="/lineups" preload={false}>
              {t("查看全部队列 →")}
            </Link>
          }
        >
          {localize(
            summary.lineups.length ? (
              <ul>
                {localize(
                  summary.lineups.slice(0, HOME_SUMMARY_LIMIT).map((lineup) => (
                    <li key={`${lineup.country}:${lineup.id}`}>
                      <div>
                        <strong>{localize(lineup.name || "未命名队列")}</strong>
                        <span>
                          {localize(countryName(lineup.country))} · {localize(lineup.vehicles)}
                          {t("辆载具")}
                        </span>
                      </div>
                      <Link to="/lineups" search={{ country: lineup.country }} preload={false}>
                        {t("查看该国队列")}
                      </Link>
                    </li>
                  )),
                )}
              </ul>
            ) : (
              <p className="wt-home-empty">
                {localize(
                  pending
                    ? "出击队列正在恢复。"
                    : "还没有保存的队列。进入出击队列，选择国家并创建配置。",
                )}
              </p>
            ),
          )}
        </Section>
      </div>
    </main>
  );
}
