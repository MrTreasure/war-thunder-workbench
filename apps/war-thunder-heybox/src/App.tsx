import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceContext, type Workspace } from "../../../src/workspace-context";
import { account, sdk } from "./runtime";
import type { AccountView } from "./account";
import { RuntimeContext, type Cloud, type ResearchIntent } from "./context";
import { Icon } from "./ui";
const Research = lazy(() => import("./Research"));
const Stats = lazy(() => import("./Stats"));
const Account = lazy(() => import("./Account"));
const pages = [
  { id: "research", label: "研发", icon: "research" },
  { id: "stats", label: "战绩", icon: "stats" },
  { id: "account", label: "我的", icon: "account" },
] as const;
type Page = (typeof pages)[number]["id"];
export default function App() {
  const [page, setPage] = useState<Page>("research"),
    [visited, setVisited] = useState(new Set<Page>(["research"]));
  const [view, setView] = useState<AccountView>({
      status: "checking",
      user: null,
      storageError: false,
    }),
    [ready, setReady] = useState(false),
    [cloud, setCloud] = useState<Cloud | null>(null),
    [cloudError, setCloudError] = useState("");
  const [boundRequest, setBoundRequest] = useState(0);
  const [researchIntent, setResearchIntent] = useState<ResearchIntent>();
  const owner = useRef("");
  function navigate(next: Page) {
    setVisited((prev) => new Set([...prev, next]));
    setPage(next);
  }
  const reloadCloud = useCallback(async () => {
    const userId = owner.current;
    if (!userId) return;
    try {
      const value = await account.request<Cloud>("account/workspace");
      if (owner.current === userId) {
        if (value.ownerKey !== "user:" + userId) throw Error("账号资料不匹配");
        setCloud(value);
        setCloudError("");
      }
    } catch (e) {
      if (owner.current === userId) {
        setCloud(null);
        setCloudError(e instanceof Error ? e.message : "账号计划暂不可用");
      }
    }
  }, []);
  useEffect(() => {
    const stop = account.subscribe((v) => {
      owner.current = v.status === "authenticated" ? v.user?.id || "" : "";
      setView(v);
      if (v.status === "authenticated") void reloadCloud();
    });
    const handshake = sdk.onHandshakeStateChange((state) => setReady(state.status === "ready"));
    void account.initialize();
    return () => {
      stop();
      handshake();
    };
  }, [reloadCloud]);
  const visibleCloud =
    view.status === "authenticated" && cloud?.ownerKey === "user:" + view.user?.id ? cloud : null;
  const workspace: Workspace | null =
    view.status === "authenticated" && view.user && visibleCloud
      ? {
          userId: view.user.id,
          ready: true,
          consented: visibleCloud.consented,
          documents: Object.fromEntries(visibleCloud.documents.map((d) => [d.key, d])),
          binding: visibleCloud.binding,
          ownedVehicleIds: new Set(visibleCloud.binding?.vehicles.map((v) => v.id) || []),
          status: "",
          error: cloudError,
          save: () => {
            throw Error("请在研发计算中保存计划");
          },
          reload: reloadCloud,
          open: () => navigate("account"),
        }
      : null;
  return (
    <RuntimeContext
      value={{
        view,
        ready,
        cloud: visibleCloud,
        reloadCloud,
        openAccount: () => navigate("account"),
      }}
    >
      <WorkspaceContext value={workspace}>
        <main className="hb-app">
          <header className="hb-app-header">
            <div>
              <span className="hb-brand-mark" aria-hidden="true">
                WT
              </span>
              <h1>战雷工作台</h1>
            </div>
            <button
              className="hb-header-account"
              aria-label="打开我的账号"
              onClick={() => navigate("account")}
            >
              <Icon name="account" />
              <span>{view.user?.displayName || "游客"}</span>
            </button>
          </header>
          <div className="hb-views" key={view.user?.id || "guest"}>
            <Suspense fallback={<output className="hb-empty">正在准备工作台…</output>}>
              <div className="hb-view" hidden={page !== "research"}>
                <Research key={researchIntent?.serial || 0} initial={researchIntent} />
              </div>
              {visited.has("stats") && (
                <div className="hb-view" hidden={page !== "stats"}>
                  <Stats boundRequest={boundRequest} />
                </div>
              )}
              {visited.has("account") && (
                <div className="hb-view" hidden={page !== "account"}>
                  <Account
                    active={page === "account"}
                    openPlan={(intent) => {
                      setResearchIntent({ ...intent, serial: Date.now() });
                      navigate("research");
                    }}
                    openBound={() => {
                      setBoundRequest((v) => v + 1);
                      navigate("stats");
                    }}
                  />
                </div>
              )}
            </Suspense>
          </div>
          <nav className="hb-tabbar" aria-label="工作台导航">
            {pages.map((p) => (
              <button
                key={p.id}
                aria-current={page === p.id ? "page" : undefined}
                onClick={() => navigate(p.id)}
              >
                <Icon name={p.icon} />
                <span>{p.label}</span>
              </button>
            ))}
          </nav>
        </main>
      </WorkspaceContext>
    </RuntimeContext>
  );
}
