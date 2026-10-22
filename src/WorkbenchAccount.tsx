import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  loginChallenge,
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
};
const AccountContext = createContext<Account | null>(null);
export function WorkbenchAccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StatsSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [identityVersion, setIdentityVersion] = useState(0);
  const acceptedIdentity = useRef<string | null | undefined>(undefined);
  const pending = useRef<{ verifier: string; state: string; popup: Window } | null>(null);
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
    void refreshSession().catch(() => {
      /* Login remains available to retry a connection. */
    });
    const storage = (event: StorageEvent) => {
      if (
        event.key !== "wt-stats-session-v1" &&
        event.key !== "wt-stats-device-v1" &&
        event.key !== null
      )
        return;
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
        await refreshSession();
        setError("");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "登录未完成，请重试。");
      } finally {
        setBusy(false);
      }
    };
    const timer = setInterval(() => {
      if (pending.current?.popup.closed) {
        pending.current = null;
        setBusy(false);
      }
    }, 1000);
    window.addEventListener("message", listener);
    window.addEventListener("storage", storage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", listener);
      window.removeEventListener("storage", storage);
    };
  }, [refreshSession, resetIdentity]);
  async function login() {
    if (busy) return;
    const popup = window.open("about:blank", "wt-account-login", "width=500,height=680");
    if (!popup) {
      setError("请允许打开登录窗口后重试。");
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
  async function logout() {
    await statsRequest("auth/logout", {});
    resetIdentity();
    setStatsToken("");
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
