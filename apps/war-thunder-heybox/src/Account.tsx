import { useEffect, useState } from "react";
import { AccountAvatar } from "../../../src/AccountAvatar";
import type { ResearchIntent } from "./context";
import catalog from "../../../src/generated/bootstrap.json";
import type { BrowserPair } from "./account";
import { account, api, sdk } from "./runtime";
import { useRuntime } from "./context";
import {
  VehiclePresentation,
  useMiniappVehicleFacts,
  useMiniappOwnedVehicles,
} from "./VehiclePresentation";
import { MainSiteLink } from "./MainSiteLink";
import { validPlan } from "./plan";
import { DetailPage, ErrorNote, Icon, errorText } from "./ui";
const phrase = "我再也不绑定别人的账号了";
export default function Account({
  active,
  openBound,
  openPlan,
}: {
  active: boolean;
  openBound: () => void;
  openPlan: (intent: Omit<ResearchIntent, "serial">) => void;
}) {
  const { view, ready, cloud, reloadCloud } = useRuntime();
  const linkedIdentity = view.user?.linkedAccounts?.find(
    (identity) => identity.provider === "heybox",
  );
  const linked =
    view.status === "authenticated" &&
    !!linkedIdentity &&
    (!!view.user?.email ||
      !!view.user?.linkedAccounts?.some((identity) => identity.provider !== "heybox"));
  const [terms, setTerms] = useState<{ version: string; notice: string } | null>(null),
    [agreed, setAgreed] = useState(false),
    [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [linkPage, setLinkPage] = useState(false),
    [code, setCode] = useState(""),
    [pair, setPair] = useState<BrowserPair | null>(null),
    [pairStage, setPairStage] = useState<"entry" | "inspect" | "create" | "approved">("entry");
  const [unlink, setUnlink] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const plans = (view.status === "authenticated" ? cloud?.documents || [] : []).filter(
    (doc) => doc.key.startsWith("wt-planner-v1:") && validPlan(doc.value),
  );
  const {
    facts,
    error: vehicleFactsError,
    retry: retryVehicleFacts,
  } = useMiniappVehicleFacts(active ? plans.map((doc) => doc.key.split(":")[2]) : []);
  const ownedVehicleIds = useMiniappOwnedVehicles();
  useEffect(() => {
    if (!active || terms) return;
    let live = true;
    void api<{ version: string; notice: string }>("account/terms")
      .then((value) => {
        if (live) setTerms(value);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "协议暂时无法读取");
      });
    return () => {
      live = false;
    };
  }, [active, terms]);
  useEffect(() => {
    if (active && view.status === "authenticated") void account.refreshProfile().catch(() => {});
  }, [active, view.status, view.generation]);
  async function perform(promise: Promise<unknown>, done?: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await promise;
      done?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function login() {
    if (!terms || !agreed) return;
    const pending = account.login(terms.version);
    void perform(pending);
  }
  function create() {
    if (!terms || !agreed) return;
    void perform(account.create(terms.version));
  }
  function approve() {
    if (!pair) return;
    const pending = account.approvePair(pair);
    void perform(
      pending.then((status) => {
        setPairStage(status === "approved" ? "approved" : "create");
      }),
    );
  }
  async function inspect() {
    const result = await account.inspectPair(code);
    setPair(result);
    setPairStage("inspect");
  }
  async function unlinkGame() {
    if (!cloud?.binding) return;
    await account.request("account/game-binding/unlink", {
      ownerKey: cloud.ownerKey,
      uid: cloud.binding.uid,
      confirmation,
    });
    await reloadCloud();
    setConfirmation("");
    setUnlink(false);
  }
  return (
    <section className="hb-scroll hb-page">
      <div className="hb-account-heading">
        <div className="hb-account-avatar">
          {view.hostProfile?.avatarUrl || view.user?.avatarUrl ? (
            <AccountAvatar
              user={view.user || view.hostProfile}
              className="wt-account-avatar-large"
            />
          ) : (
            <Icon name="account" />
          )}
        </div>
        <div>
          <h2>{view.hostProfile?.displayName || view.user?.displayName || "我的工作台"}</h2>
          <p>{view.status === "authenticated" ? "小黑盒账号已授权" : "游客也可使用公开功能"}</p>
        </div>
      </div>
      <ErrorNote error={error} />
      {notice && <output>{notice}</output>}
      {view.status === "checking" && (
        <div className="hb-account-check">
          <p>账号状态待确认，仍可使用公开功能。</p>
          <button disabled={busy} onClick={() => void perform(account.refresh())}>
            重新确认账号
          </button>
        </div>
      )}
      {view.status !== "authenticated" && (
        <div className="hb-account-login">
          <h3>{view.status === "onboarding" ? "首次使用工作台" : "用小黑盒登录"}</h3>
          <p>
            {view.status === "onboarding"
              ? "此小黑盒身份尚未关联工作台账号。已有账号请先在网页端登录，再从账号菜单关联小黑盒。"
              : "授权后使用工作台账号权益，可与已有网页账号关联。"}
          </p>
          <label className="hb-checkbox hb-agreement">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              我已阅读并同意
              <button type="button" className="hb-text-button" onClick={() => setShowTerms(true)}>
                用户协议与数据说明
              </button>
            </span>
          </label>
          <button
            className="hb-primary"
            disabled={!ready || !agreed || !terms || busy}
            onClick={view.status === "onboarding" ? create : login}
          >
            {busy
              ? "正在授权…"
              : view.status === "onboarding"
                ? "创建工作台账号"
                : "小黑盒授权登录"}
          </button>
          <small>本站不要求小黑盒密码或游戏密码。</small>
        </div>
      )}
      {view.status === "authenticated" && (
        <div className="hb-account-section">
          <h3>游戏账号</h3>
          {cloud?.binding ? (
            <>
              <button className="hb-menu-row" onClick={openBound}>
                <span>
                  <b>{cloud.binding.nickname}</b>
                  <small>UID {cloud.binding.uid}</small>
                </span>
                <Icon name="arrow" />
              </button>
              <button className="hb-menu-row hb-danger-link" onClick={() => setUnlink(true)}>
                <span>解除游戏账号关联</span>
                <Icon name="arrow" />
              </button>
            </>
          ) : (
            <p>在战绩页查询自己的游戏账号后，选择「关联为我的游戏账号」。</p>
          )}
        </div>
      )}
      {view.status === "authenticated" && cloud && (
        <div className="hb-account-section">
          <h3>研发计划</h3>
          <ErrorNote error={vehicleFactsError} />
          {vehicleFactsError && <button onClick={retryVehicleFacts}>重新载入载具资料</button>}
          <div className="hb-saved-plan-list">
            {plans.map((doc) => {
              const [, category, country] = doc.key.split(":");
              if (
                !(category in catalog.categories) ||
                !(country in catalog.countries) ||
                !validPlan(doc.value)
              )
                return null;
              const target = doc.value.target;
              return (
                <VehiclePresentation
                  key={doc.key}
                  unit={
                    facts.get(target) || {
                      id: target,
                      name: vehicleFactsError ? "载具资料暂不可用" : "载具资料正在载入",
                    }
                  }
                  country={country}
                  category={category}
                  owned={ownedVehicleIds.has(target)}
                  onSelect={() => openPlan({ country, category, target })}
                />
              );
            })}
          </div>
          {!plans.length && <p>尚无保存的研发计划。在研发计算中保存后，可在这里继续。</p>}
        </div>
      )}
      {view.status === "authenticated" && linkedIdentity?.providerUserId && (
        <div className="hb-account-section">
          <h3>小黑盒小程序身份 ID</h3>
          <p className="hb-linked-identity-id">{linkedIdentity.providerUserId}</p>
          <button
            disabled={busy}
            onClick={() =>
              void perform(sdk.device.setClipboard({ text: linkedIdentity.providerUserId! }), () =>
                setNotice("身份 ID 已复制"),
              )
            }
          >
            复制 ID
          </button>
          <small>此 ID 仅用于当前小程序，不是个人主页数字 ID。</small>
        </div>
      )}
      <div className="hb-account-section">
        <h3>跨端使用</h3>
        {linked ? (
          <div className="hb-menu-row" aria-live="polite">
            <AccountAvatar user={view.hostProfile || linkedIdentity} />
            <span>
              <b>小黑盒 · 已关联</b>
              <small>
                {view.hostProfile?.displayName || linkedIdentity.displayName || "当前小黑盒账号"} ·
                与网页共用工作台数据
              </small>
            </span>
          </div>
        ) : (
          <button type="button" className="hb-menu-row" onClick={() => setLinkPage(true)}>
            <span>
              <b>关联已有网页账号</b>
              <small>输入主站账号菜单提供的关联码</small>
            </span>
            <Icon name="arrow" />
          </button>
        )}
        <MainSiteLink />
      </div>
      {linkPage && (
        <DetailPage
          path="#/account/link-heybox"
          title="关联网页账号"
          close={() => setLinkPage(false)}
        >
          <ErrorNote error={error} />
          <p>
            先在主站登录已有工作台账号，再从用户名菜单选择「关联小黑盒」获取关联码。在此输入后，核对账号名称并确认。
          </p>
          {pairStage === "entry" && (
            <>
              <label>
                网页关联码
                <input
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="输入网页上的 12 位关联码"
                  value={code}
                  maxLength={16}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setPair(null);
                  }}
                />
              </label>
              <button
                disabled={busy || code.replace(/\s/g, "").length !== 12}
                onClick={() => void perform(inspect())}
              >
                {busy ? "正在核对…" : "核对关联账号"}
              </button>
            </>
          )}
          {pairStage === "inspect" && pair && (
            <div className="hb-pair-confirm">
              <p>
                关联网站 <b>{new URL(pair.origin).hostname}</b>
              </p>
              <p>
                {pair.purpose === "bind" ? "关联到工作台账号" : "登录网页工作台"}
                {pair.targetName && <strong>「{pair.targetName}」</strong>}
              </p>
              <button className="hb-primary" disabled={!ready || busy} onClick={approve}>
                {busy ? "正在授权…" : "确认关联，使用小黑盒授权"}
              </button>
              <button
                onClick={() => {
                  setPairStage("entry");
                  setPair(null);
                }}
              >
                取消
              </button>
            </div>
          )}
          {pairStage === "create" && (
            <div>
              <p>此身份还没有工作台账号。已有账号请取消，在网页用原账号登录后重新发起关联。</p>
              <label className="hb-checkbox">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  同意
                  <button className="hb-text-button" onClick={() => setShowTerms(true)}>
                    用户协议与数据说明
                  </button>
                </span>
              </label>
              <button
                className="hb-primary"
                disabled={!agreed || !terms || busy}
                onClick={() => {
                  if (terms)
                    void perform(account.createForPair(terms.version), () =>
                      setPairStage("approved"),
                    );
                }}
              >
                创建账号并授权此网页
              </button>
              <button
                onClick={() => {
                  setPairStage("entry");
                  setPair(null);
                }}
              >
                我已有工作台账号
              </button>
            </div>
          )}
          {pairStage === "approved" && (
            <div aria-live="polite">
              <h3>账号关联已确认</h3>
              <p>
                {view.status === "authenticated"
                  ? "网页与小程序已使用同一个工作台账号。"
                  : "返回主站继续使用；小程序可重新授权登录同一个工作台账号。"}
              </p>
              <button
                onClick={() => {
                  setCode("");
                  setPair(null);
                  setPairStage("entry");
                }}
              >
                完成
              </button>
            </div>
          )}
        </DetailPage>
      )}
      {view.storageError && (
        <p className="hb-fine">当前客户端无法保存登录状态，下次打开需要重新授权。</p>
      )}
      {view.status === "authenticated" && (
        <button
          className="hb-logout"
          disabled={busy}
          onClick={() => void perform(account.logout())}
        >
          退出工作台账号
        </button>
      )}
      <p className="hb-disclaimer">
        本站与战争雷霆官方无任何关系，仅为个人玩家制作的辅助工具。数据与计算仅供参考，请以游戏内信息为准。
      </p>
      {showTerms && (
        <DetailPage
          path="#/account/terms"
          title="用户协议与数据说明"
          close={() => setShowTerms(false)}
        >
          <p className="hb-agreement-copy">{terms?.notice || "协议正在读取，请稍后再试。"}</p>
          <p>
            使用小黑盒登录时，本站保存当前小程序的身份标识及工作台账号关联，用于账号认证，不保存小黑盒密码。
          </p>
          <p className="hb-disclaimer">
            本站与战争雷霆官方无任何关系，工具内容仅供参考。公开数据可能存在版本差异或延迟，重要操作请以游戏内信息为准。
          </p>
          <button
            className="hb-primary"
            disabled={!terms}
            onClick={() => {
              setAgreed(true);
              setShowTerms(false);
            }}
          >
            已阅读并同意
          </button>
        </DetailPage>
      )}
      {unlink && (
        <DetailPage
          path="#/account/unlink-game"
          title="解除游戏账号关联"
          close={() => setUnlink(false)}
        >
          <p>请输入以下完整文字以解除当前关联：</p>
          <p className="hb-warning">{phrase}</p>
          <label>
            确认文字
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <ErrorNote error={error} />
          <button
            className="hb-primary"
            disabled={confirmation !== phrase || busy}
            onClick={() => void perform(unlinkGame())}
          >
            确认解除关联
          </button>
        </DetailPage>
      )}
    </section>
  );
}
