import { GameIcon, type GameIconName } from "./components/GameIcon";
import mapIcons from "../data/map-editor-icons.json";
import { useLoadoutPlans } from "./loadout-storage";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import bootstrap from "./generated/bootstrap.json";
import { useAccountWorkspace, workspaceKey } from "./workspace-context";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { HOME_SUMMARY_LIMIT, homeDashboardSummary } from "./home-dashboard-model";
import { VehicleTile } from "./VehicleTile";
import "./home-dashboard.css";

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
const categoryName = (id: string) =>
  bootstrap.categories[id as keyof typeof bootstrap.categories] || "军种未知";
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
  return (
    <section className="wt-home-section">
      <header>
        <h3>
          <GameIcon name={homeSectionIcons[title] || "details"} />
          {title}
          <span>{count}</span>
        </h3>
        {action}
      </header>
      {children}
      {count > HOME_SUMMARY_LIMIT && (
        <p className="wt-home-empty">
          显示前 {HOME_SUMMARY_LIMIT} 项，共 {count} 项。
        </p>
      )}
    </section>
  );
}
function HomeLoadoutSection({ owner }: { owner: string }) {
  const [plans, , error, status] = useLoadoutPlans(owner);
  const recent = [...plans].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return (
    <Section
      title="模拟挂载"
      count={plans.length}
      action={
        <Link to="/loadouts" preload={false}>
          查看全部挂载 →
        </Link>
      }
    >
      {error ? (
        <p className="wt-home-notice" role="alert">
          {error}{" "}
          <button className="quiet-button" onClick={() => void status.reload()}>
            重试
          </button>
        </p>
      ) : status.loading ? (
        <output className="wt-home-notice">正在读取挂载方案…</output>
      ) : recent.length ? (
        <ul>
          {recent.slice(0, HOME_SUMMARY_LIMIT).map((plan) => (
            <li key={plan.id}>
              <div>
                <strong>{plan.name || "未命名挂载"}</strong>
                <span>
                  {countryName(plan.country)} · 更新于{" "}
                  {new Date(plan.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="wt-home-empty">还没有保存的挂载方案。进入模拟挂载，添加机型后开始配置。</p>
      )}
    </Section>
  );
}
export function HomeDashboard() {
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
  return (
    <main className="wt-home">
      <header className="wt-home-heading">
        <div>
          <p>研发 · 配置 · 出击</p>
          <h2 className="sr-only">我的工作台</h2>
          <span>接着完善你的计划，或从一项工具开始。</span>
        </div>
        <div className="wt-home-account">
          <span>{userId ? currentWorkspace?.status || "正在读取云端" : "本机游客数据"}</span>
          {currentWorkspace && (
            <button className="quiet-button" onClick={currentWorkspace.open}>
              云端数据
            </button>
          )}
        </div>
      </header>
      {pending && <output className="wt-home-notice">正在读取当前账号的方案…</output>}
      {currentWorkspace?.error && (
        <p className="wt-home-notice" role="alert">
          {currentWorkspace.error}
          <button className="quiet-button" onClick={currentWorkspace.open}>
            处理同步
          </button>
        </p>
      )}
      <nav className="wt-home-shortcuts" aria-label="快速开始">
        <Link to="/tree" preload={false}>
          <strong>
            <GameIcon name="research" />
            科技树
          </strong>
          <span>查看载具与规划研发 →</span>
        </Link>
        <Link to="/lineups" preload={false}>
          <strong>
            <GameIcon name="crew" />
            出击队列
          </strong>
          <span>管理乘员槽位与配置 →</span>
        </Link>
        <Link to="/loadouts" preload={false}>
          <strong>
            <GameIcon name="loadout" />
            模拟挂载
          </strong>
          <span>为机型配置武器挂载 →</span>
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
            陆战地图
          </strong>
          <span>查看地图与编辑战术 →</span>
        </Link>
      </nav>
      <div className="wt-home-grid" aria-busy={pending}>
        <Section
          title="研发计划"
          count={summary.plans.length}
          action={
            <Link to="/tree" preload={false}>
              查看全部 · 科技树 →
            </Link>
          }
        >
          {summary.plans.length ? (
            <ul>
              {summary.plans.slice(0, HOME_SUMMARY_LIMIT).map((plan) => (
                <li key={plan.key}>
                  <div>
                    <strong>
                      {countryName(plan.country)} · {categoryName(plan.category)}
                    </strong>
                    <span>目标：{plan.targetName || "名称待核验"}</span>
                    <span>当前目标已投入 {plan.progress.toLocaleString()} RP</span>
                  </div>
                  <Link
                    to="/tree"
                    search={{ country: plan.country, category: plan.category, plan: true }}
                    preload={false}
                  >
                    继续研发
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wt-home-empty">
              {pending
                ? "研发计划正在恢复。"
                : "还没有保存的研发计划。在科技树选择目标，打开研发规划后即可保存。"}
            </p>
          )}
        </Section>
        <Section
          title="出击队列"
          count={summary.lineups.length}
          action={
            <Link to="/lineups" preload={false}>
              查看全部队列 →
            </Link>
          }
        >
          {summary.lineups.length ? (
            <ul>
              {summary.lineups.slice(0, HOME_SUMMARY_LIMIT).map((lineup) => (
                <li key={`${lineup.country}:${lineup.id}`}>
                  <div>
                    <strong>{lineup.name || "未命名队列"}</strong>
                    <span>
                      {countryName(lineup.country)} · {lineup.vehicles} 辆载具
                    </span>
                  </div>
                  <Link to="/lineups" search={{ country: lineup.country }} preload={false}>
                    查看该国队列
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wt-home-empty">
              {pending
                ? "出击队列正在恢复。"
                : "还没有保存的队列。进入出击队列，选择国家并创建配置。"}
            </p>
          )}
        </Section>
        {userId ? (
          <HomeLoadoutSection key={userId} owner={userId} />
        ) : (
          <Section
            title="模拟挂载"
            count={0}
            action={
              <Link to="/loadouts" preload={false}>
                打开模拟挂载 →
              </Link>
            }
          >
            <p className="wt-home-empty">登录后可保存挂载方案，并在这里查看。</p>
          </Section>
        )}
        <Section
          title="载具关注"
          count={summary.watches.length}
          action={
            <Link to="/sales" preload={false}>
              查看全部关注 →
            </Link>
          }
        >
          {summary.watches.length ? (
            <div className="wt-home-watch-list">
              {summary.watches.slice(0, HOME_SUMMARY_LIMIT).map((unit) => (
                <VehicleTile
                  key={unit.id}
                  unit={unit}
                  country={unit.country}
                  showRank
                  showAcquisition={false}
                />
              ))}
            </div>
          ) : (
            <p className="wt-home-empty">
              {pending
                ? "关注列表正在恢复。"
                : "还没有关注的载具。在折扣日历添加关注，方便下次查看。"}
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}
