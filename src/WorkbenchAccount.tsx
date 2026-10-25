import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  loginChallenge,
  hasStatsToken,
  forgetStatsAccount,
  notifyStatsAccountLogin,
  prepareStatsDevice,
  setStatsToken,
  statsRequest,
} from "./player-stats-api";
import type { StatsSession } from "./player-stats-api";

type Account = {
  session: StatsSession | null;
  busy: boolean;
  error: string;
  identityVersion: number;
  clearError: () => void;
  refreshSession: () => Promise<StatsSession>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  acceptLogin: (token: string) => Promise<void>;
};
const AccountContext = createContext<Account | null>(null);
export function WorkbenchAccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StatsSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [identityVersion, setIdentityVersion] = useState(0);
  const acceptedIdentity = useRef<string | null | undefined>(undefined);
  const pending = useRef<{ verifier: string; state: string; popup: Window } | null>(null);
  const restoring = useRef(false);
  const flight = useRef<{ controller: AbortController; promise: Promise<StatsSession> } | null>(
    null,
  );
  const refreshSession = useCallback(() => {
    if (flight.current) return flight.current.promise;
    const controller = new AbortController();
    const promise = prepareStatsDevice(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          const nextIdentity = value.user?.id || null;
          if (acceptedIdentity.current !== undefined && acceptedIdentity.current !== nextIdentity)
            setIdentityVersion((version) => version + 1);
          acceptedIdentity.current = nextIdentity;
          setSession(value);
        }
        return value;
      })
      .finally(() => {
        if (flight.current?.controller === controller) flight.current = null;
      });
    flight.current = { controller, promise };
    return promise;
  }, []);
  const resetIdentity = useCallback(() => {
    flight.current?.controller.abort();
    flight.current = null;
    acceptedIdentity.current = undefined;
    setSession(null);
    setIdentityVersion((value) => value + 1);
  }, []);
  useEffect(() => {
    async function restore() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("wt_auth_code");
      const silentMiss = url.searchParams.get("wt_auth_silent") === "miss";
      const state = url.searchParams.get("wt_auth_state");
      const saved = sessionStorage.getItem("wt-auth-intent-v1");
      if (silentMiss) {
        const original = saved
          ? (JSON.parse(saved) as { state: string; originalPath?: string; expires: number })
          : null;
        sessionStorage.removeItem("wt-auth-intent-v1");
        url.searchParams.delete("wt_auth_silent");
        url.searchParams.delete("wt_auth_state");
        if (original && original.state === state && original.expires > Date.now()) {
          const destination = new URL(original.originalPath || "/", location.origin);
          if (destination.origin === location.origin && destination.pathname === location.pathname)
            history.replaceState(history.state, "", destination);
          else history.replaceState(history.state, "", url);
        } else history.replaceState(history.state, "", url);
      }
      if (code) {
        sessionStorage.removeItem("wt-auth-intent-v1");
        url.searchParams.delete("wt_auth_code");
        url.searchParams.delete("wt_auth_state");
        history.replaceState(history.state, "", url);
        if (!saved) throw new Error("登录请求已过期，请重新登录。");
        const intent = JSON.parse(saved) as {
          verifier: string;
          state: string;
          returnUrl?: string;
          originalPath?: string;
          expires: number;
        };
        if (intent.state !== state || intent.expires < Date.now())
          throw new Error("登录请求已过期，请重新登录。");
        const original = new URL(intent.originalPath || intent.returnUrl || "/", location.origin);
        if (original.origin !== location.origin || original.pathname !== location.pathname)
          throw new Error("登录返回地址无效。");
        history.replaceState(history.state, "", original);
        const result = await statsRequest<{ token: string }>("auth/exchange", {
          code,
          verifier: intent.verifier,
        });
        resetIdentity();
        setStatsToken(result.token);
        notifyStatsAccountLogin();
      }
      const current = await refreshSession();
      // One automatic, non-interactive redirect migrates legacy first-party login cookies.
      if (
        !current.user &&
        !code &&
        !silentMiss &&
        localStorage.getItem("wt-account-known-v1") &&
        Date.now() - Number(sessionStorage.getItem("wt-auth-silent-attempt-v1") || "0") > 600000
      ) {
        sessionStorage.setItem("wt-auth-silent-attempt-v1", String(Date.now()));
        await redirectLogin(true);
      }
    }
    if (!restoring.current) {
      restoring.current = true;
      void restore().catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "无法恢复登录，请重试。");
        void refreshSession().catch(() => {});
      });
    }
    const storage = (event: StorageEvent) => {
      if (
        event.key !== "wt-account-change-v1" &&
        event.key !== "wt-stats-session-v1" &&
        event.key !== "wt-stats-device-v1" &&
        event.key !== null
      )
        return;
      setStatsToken("");
      if (event.newValue?.startsWith("login:")) setError("");
      resetIdentity();
      void refreshSession().catch(() => {});
    };
    const listener = async (event: MessageEvent) => {
      const intent = pending.current;
      if (
        !intent ||
        event.origin !== "https://api.mrtreasure.cc" ||
        event.source !== intent.popup ||
        event.data?.type !== "wt-login-code" ||
        event.data.state !== intent.state ||
        typeof event.data.code !== "string"
      )
        return;
      pending.current = null;
      try {
        const result = await statsRequest<{ token: string }>("auth/exchange", {
          code: event.data.code,
          verifier: intent.verifier,
        });
        resetIdentity();
        setStatsToken(result.token);
        notifyStatsAccountLogin();
        await refreshSession();
        setError("");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "登录未完成，请重试。");
      } finally {
        setBusy(false);
      }
    };
    const renew = setInterval(
      () => {
        if (hasStatsToken())
          void statsRequest<{ token: string }>("auth/refresh", {})
            .then((result) => setStatsToken(result.token))
            .catch(() => {});
      },
      10 * 60 * 1000,
    );
    const timer = setInterval(() => {
      if (pending.current?.popup.closed) {
        pending.current = null;
        setBusy(false);
      }
    }, 1000);
    const expired = () => {
      resetIdentity();
      void refreshSession().catch(() => {});
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refreshSession().catch(() => {});
    };
    window.addEventListener("wt-account-expired", expired);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("message", listener);
    window.addEventListener("storage", storage);
    return () => {
      clearInterval(timer);
      clearInterval(renew);
      window.removeEventListener("wt-account-expired", expired);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("message", listener);
      window.removeEventListener("storage", storage);
    };
  }, [refreshSession, resetIdentity]);
  async function redirectLogin(silent = false) {
    const challenge = await loginChallenge();
    const returnUrl = window.location.origin + window.location.pathname;
    const intent = {
      verifier: challenge.verifier,
      state: challenge.state,
      originalPath: window.location.pathname + window.location.search + window.location.hash,
      expires: Date.now() + 10 * 60 * 1000,
    };
    sessionStorage.setItem("wt-auth-intent-v1", JSON.stringify(intent));
    const start = await statsRequest<{ authorizeUrl: string }>("auth/start", {
      challenge: challenge.challenge,
      state: challenge.state,
      returnUrl,
    });
    const destination = new URL(start.authorizeUrl);
    if (silent) destination.pathname = destination.pathname.replace(/\/authorize$/, "/silent");
    window.location.assign(destination.href);
  }
  async function login() {
    if (busy) return;
    const popup = window.open("about:blank", "wt-account-login", "width=500,height=680");
    if (!popup) {
      setBusy(true);
      try {
        await redirectLogin();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "无法打开登录，请重试。");
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setError("");
    try {
      await refreshSession();
      const challenge = await loginChallenge();
      pending.current = { verifier: challenge.verifier, state: challenge.state, popup };
      const start = await statsRequest<{ authorizeUrl: string }>("auth/start", {
        challenge: challenge.challenge,
        state: challenge.state,
      });
      if (popup.closed) {
        pending.current = null;
        setBusy(false);
        return;
      }
      popup.location.replace(start.authorizeUrl);
    } catch (failure) {
      pending.current = null;
      popup.close();
      setBusy(false);
      setError(failure instanceof Error ? failure.message : "无法打开登录，请重试。");
    }
  }
  async function acceptLogin(token: string) {
    resetIdentity();
    setStatsToken(token);
    notifyStatsAccountLogin();
    await refreshSession();
    setError("");
  }
  async function logout() {
    await statsRequest("auth/logout", {});
    resetIdentity();
    forgetStatsAccount();
    await refreshSession();
    setError("");
  }
  return (
    <AccountContext.Provider
      value={{
        session,
        busy,
        error,
        identityVersion,
        clearError: () => setError(""),
        refreshSession,
        login,
        logout,
        acceptLogin,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function useWorkbenchAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("WorkbenchAccountProvider is required");
  return account;
}
