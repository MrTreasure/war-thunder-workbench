import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal";
import { useWorkbenchAccount } from "../WorkbenchAccount";
import {
  heyboxRequest,
  type HeyboxConfig,
  type HeyboxPair,
  type HeyboxPoll,
} from "../heybox-account-api";
import { statsRequest, StatsError } from "../player-stats-api";
import "../heybox-account.css";

type Props = { purpose: "login" | "bind"; close: () => void };
export function HeyboxAccountDialog({ purpose, close }: Props) {
  const { session, acceptLogin } = useWorkbenchAccount();
  const currentUserId = session?.user?.id || "";
  const owner = useRef(currentUserId);
  useEffect(() => {
    owner.current = currentUserId;
  }, [currentUserId]);
  const [phase, setPhase] = useState<
    "loading" | "ready" | "starting" | "waiting" | "success" | "error" | "unconfigured"
  >("loading");
  const [pair, setPair] = useState<HeyboxPair | null>(null);
  const [expiresAt, setExpiresAt] = useState(0),
    [now, setNow] = useState(() => Date.now());
  const [terms, setTerms] = useState<{ version: string; notice: string } | null>(null);
  const [agreed, setAgreed] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<AbortController | null>(null);
  const initialOwner = useRef(currentUserId);
  useEffect(() => {
    const c = new AbortController();
    void Promise.all([
      heyboxRequest<HeyboxConfig>("config", undefined, c.signal),
      statsRequest<{ version: string; notice: string }>("account/terms", undefined, c.signal),
    ])
      .then(([config, t]) => {
        if (c.signal.aborted) return;
        setTerms(t);
        setPhase(config.configured ? "ready" : "unconfigured");
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e instanceof Error ? e.message : "暂时无法读取授权配置");
          setPhase("error");
        }
      });
    return () => {
      c.abort();
      attempt.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!pair || phase !== "waiting") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pair, phase]);
  async function start() {
    if (!agreed || !terms || phase === "starting") return;
    attempt.current?.abort();
    const c = new AbortController();
    attempt.current = c;
    setError("");
    setPhase("starting");
    setPair(null);
    try {
      const proof = await heyboxRequest<HeyboxPair>("device/start", { purpose }, c.signal);
      if (c.signal.aborted) return;
      if (
        !/^[A-F0-9]{12}$/.test(proof.pairingCode) ||
        !Number.isFinite(proof.expiresInSeconds) ||
        proof.expiresInSeconds <= 0
      )
        throw Error("授权响应无效，请重新开始");
      const end = Date.now() + proof.expiresInSeconds * 1000;
      setExpiresAt(end);
      setNow(Date.now());
      setPair(proof);
      setPhase("waiting");
      while (!c.signal.aborted && Date.now() < end) {
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(c.signal.reason);
          };
          const timer = setTimeout(() => {
            c.signal.removeEventListener("abort", abort);
            resolve();
          }, 2000);
          c.signal.addEventListener("abort", abort, { once: true });
        });
        if (owner.current !== initialOwner.current) throw Error("工作台账号已变化，请重新发起绑定");
        let result: HeyboxPoll;
        try {
          result = await heyboxRequest<HeyboxPoll>(
            "device/poll",
            {
              requestId: proof.requestId,
              pollSecret: proof.pollSecret,
              agreementVersion: terms.version,
            },
            c.signal,
          );
        } catch (e) {
          if (e instanceof StatsError && e.code === "OAUTH_IN_PROGRESS") continue;
          throw e;
        }
        if (c.signal.aborted) return;
        if (result.status === "authenticated") {
          if (purpose === "bind" && result.user.id !== initialOwner.current)
            throw Error("绑定账号不一致，请重新开始");
          await acceptLogin(result.token);
          setPair(null);
          setPhase("success");
          return;
        }
      }
      if (!c.signal.aborted) throw Error("授权码已过期，请重新开始");
    } catch (e) {
      if (!c.signal.aborted) {
        setPair(null);
        setError(e instanceof Error ? e.message : "授权未完成，请重试");
        setPhase("error");
      }
    }
  }
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <Modal
      title={purpose === "bind" ? "关联小黑盒账号" : "小黑盒登录"}
      close={close}
      className="wt-heybox-dialog"
    >
      <div className="wt-heybox-content">
        {phase === "loading" && <output>正在读取授权配置…</output>}
        {phase === "unconfigured" && <p>小黑盒登录暂未开放，请使用账号登录。</p>}
        {(phase === "ready" || phase === "error") && (
          <>
            <p>
              {purpose === "bind"
                ? `将小黑盒身份关联到「${session?.user?.displayName || "当前工作台账号"}」，保留此账号原有数据。`
                : "使用小黑盒 App 内的战雷工作台确认授权。已有工作台账号请先用原账号登录，再从用户名菜单关联。"}
            </p>
            <p className="wt-heybox-identity-notice">
              本站保存小程序身份标识及工作台账号关联，用于登录；不要求小黑盒密码。
            </p>
            <label className="wt-heybox-agreement">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                我已阅读并同意
                <a
                  href="https://api.mrtreasure.cc/wt-stats/v1/auth/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  用户协议与数据说明 ↗
                </a>
              </span>
            </label>
            {error && (
              <p role="alert" className="wt-heybox-error">
                {error}
              </p>
            )}
            <button
              type="button"
              className="wt-heybox-primary"
              disabled={!agreed || !terms}
              onClick={() => void start()}
            >
              {phase === "error" ? "重新开始" : "获取授权码"}
            </button>
          </>
        )}
        {phase === "starting" && <output>正在准备授权…</output>}
        {phase === "waiting" && pair && (
          <>
            <p>在小黑盒 App 的战雷工作台中，打开「我的 → 网页授权」，输入下方授权码并确认。</p>
            <p className="wt-heybox-code" aria-label="网页授权码">
              <code>{pair.pairingCode.match(/.{1,4}/g)?.join(" ")}</code>
            </p>
            <output>
              等待手机确认 · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </output>
            <small>仅确认你正在操作的浏览器。本站不要求小黑盒或游戏密码。</small>
          </>
        )}
        {phase === "success" && (
          <>
            <output>{purpose === "bind" ? "小黑盒账号已关联。" : "登录成功。"}</output>
            <button type="button" onClick={close}>
              完成
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
