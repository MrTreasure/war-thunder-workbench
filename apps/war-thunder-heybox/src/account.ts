import { MiniappError, type APIRequest, type SDK } from "./api.ts";

type User = { id: string; displayName?: string };
type LoginResult =
  | { status: "authenticated"; token: string; expiresInSeconds: number; user: User }
  | { status: "onboarding_required"; onboardingTicket: string; expiresInSeconds: number };
type Saved = { token: string; accountKey: string; expiresAt: number; user: User };
type Pending = { ticket: string; accountKey: string; epoch: number; expiresAt: number };
export type BrowserPair = {
  pairingCode: string;
  purpose: "login" | "bind";
  origin: string;
  targetName?: string;
  expiresAt: number;
  status: "pending" | "approved";
};
type PairApproval =
  | { status: "approved" }
  | { status: "onboarding_required"; approvalTicket: string };
export type AccountView = {
  status: "checking" | "guest" | "authenticated" | "onboarding";
  user: User | null;
  storageError: boolean;
};
const KEY = "wt_heybox_session_v1";
const changed = () => new MiniappError("ACCOUNT_CHANGED", "账号状态已变化，请重新登录");

/** Host storage is app-scoped, not account-scoped. Never restore a bare token. */
export function createAccount(sdk: SDK, api: APIRequest) {
  let epoch = 0,
    disposed = false,
    confirmedKey: string | null | undefined;
  let saved: Saved | null = null,
    pending: Pending | null = null;
  let pairPending: {
    pairingCode: string;
    ticket: string;
    accountKey: string;
    epoch: number;
  } | null = null;
  let status: AccountView["status"] = "checking",
    storageError = false;
  let writes: Promise<void> = Promise.resolve();
  const listeners = new Set<(value: AccountView) => void>();
  const view = (): AccountView => ({
    status,
    user: status === "authenticated" ? (saved?.user ?? null) : null,
    storageError,
  });
  const emit = () => {
    if (!disposed) for (const listener of listeners) listener(view());
  };
  function persist(value: Saved | null) {
    // Serialize clears and saves so a delayed prior write cannot restore a token.
    writes = writes
      .then(() => sdk.storage.setStorage({ key: KEY, data: value }))
      .catch(() => {
        storageError = true;
        emit();
      });
    return writes;
  }
  function reconcile(state: { isHeyboxAppLoggedIn?: boolean; accountKey?: string | null }) {
    const key =
      state.isHeyboxAppLoggedIn === false
        ? null
        : state.isHeyboxAppLoggedIn && typeof state.accountKey === "string" && state.accountKey
          ? state.accountKey
          : undefined;
    if (key !== confirmedKey) {
      epoch++;
      pairPending = null;
    }
    confirmedKey = key;
    if (key === undefined) {
      status = "checking";
      pending = null;
    } else if (!key || (saved && (saved.accountKey !== key || saved.expiresAt <= Date.now()))) {
      saved = null;
      pending = null;
      status = "guest";
      void persist(null);
    } else {
      if (pending?.accountKey !== key || pending.expiresAt <= Date.now()) pending = null;
      status = saved ? "authenticated" : pending ? "onboarding" : "guest";
    }
    emit();
  }
  // Subscribe before the first read. Login-change events invalidate pending
  // responses synchronously, before another user's information can be painted.
  const stopAccount = sdk.on("heybox_app_login_change", reconcile);
  async function refresh() {
    if (disposed) return;
    status = "checking";
    emit();
    const turn = epoch;
    try {
      const state = await sdk.auth.getAccountState();
      if (!disposed && turn === epoch) reconcile(state);
    } catch {
      if (!disposed && turn === epoch) {
        confirmedKey = undefined;
        epoch++;
        status = "checking";
        emit();
      }
    }
  }
  const stopShow = sdk.on("show", () => {
    void refresh();
  });

  async function initialize() {
    const turn = epoch;
    try {
      const { data } = await sdk.storage.getStorage<unknown>({ key: KEY });
      if (!disposed && turn === epoch && validSaved(data)) saved = data;
    } catch {
      storageError = true;
    }
    if (!disposed) await refresh();
  }
  async function verify(key: string, turn: number) {
    const current = await sdk.auth.getAccountState();
    if (disposed || turn !== epoch || !current.isHeyboxAppLoggedIn || current.accountKey !== key)
      throw changed();
  }
  async function accept(result: LoginResult, key: string, turn: number) {
    await verify(key, turn);
    if (result.status === "onboarding_required") {
      if (
        typeof result.onboardingTicket !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(result.onboardingTicket) ||
        !Number.isFinite(result.expiresInSeconds) ||
        result.expiresInSeconds <= 0
      )
        throw changed();
      pending = {
        ticket: result.onboardingTicket,
        accountKey: key,
        epoch: turn,
        expiresAt: Date.now() + result.expiresInSeconds * 1000,
      };
      status = "onboarding";
      emit();
      return;
    }
    if (
      !result.user?.id ||
      typeof result.token !== "string" ||
      result.token.length < 32 ||
      !Number.isFinite(result.expiresInSeconds) ||
      result.expiresInSeconds <= 0
    )
      throw changed();
    saved = {
      token: result.token,
      accountKey: key,
      expiresAt: Date.now() + result.expiresInSeconds * 1000,
      user: result.user,
    };
    pending = null;
    status = "authenticated";
    emit();
    await persist(saved);
  }
  return {
    initialize,
    refresh,
    subscribe(listener: (value: AccountView) => void) {
      listeners.add(listener);
      listener(view());
      return () => {
        listeners.delete(listener);
      };
    },
    /** Invoke directly from the click handler, without an await before auth.login. */
    async login(agreementVersion: string) {
      if (!agreementVersion || disposed) throw changed();
      const authorization = sdk.auth.login();
      const result = await authorization;
      if (!result.accountKey)
        throw new MiniappError(
          "HOST_ACCOUNT_UNAVAILABLE",
          "当前客户端无法确认账号，请升级小黑盒后重试",
        );
      const turn = epoch;
      await verify(result.accountKey, turn);
      const response = await api<LoginResult>("auth/heybox/session", {
        body: { code: result.code, agreementVersion },
      });
      await accept(response, result.accountKey, turn);
    },
    async create(agreementVersion: string) {
      const proof = pending;
      if (!proof || proof.expiresAt <= Date.now() || !agreementVersion || proof.epoch !== epoch)
        throw changed();
      await verify(proof.accountKey, proof.epoch);
      const response = await api<LoginResult>("auth/heybox/complete", {
        body: { onboardingTicket: proof.ticket, action: "create", agreementVersion },
      });
      await accept(response, proof.accountKey, proof.epoch);
    },
    async inspectPair(code: string): Promise<BrowserPair> {
      const pairingCode = code.replace(/\s/g, "").toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(pairingCode))
        throw new MiniappError("INVALID_PAIRING_CODE", "请输入网页显示的 12 位授权码");
      const info = await api<Omit<BrowserPair, "pairingCode">>("auth/heybox/device/inspect", {
        body: { pairingCode },
      });
      if (
        !["https://wt.mrtreasure.cc", "https://render.qmuse.pub"].includes(info.origin) ||
        !["login", "bind"].includes(info.purpose) ||
        !Number.isFinite(info.expiresAt) ||
        info.expiresAt <= Date.now()
      )
        throw changed();
      return { ...info, pairingCode };
    },
    /** Call only after showing the website and (for binding) the target account. */
    async approvePair(pair: BrowserPair) {
      if (pair.expiresAt <= Date.now() || pair.status !== "pending") throw changed();
      const authorization = sdk.auth.login();
      const result = await authorization;
      if (!result.accountKey)
        throw new MiniappError("HOST_ACCOUNT_UNAVAILABLE", "请升级小黑盒后重试");
      const turn = epoch;
      await verify(result.accountKey, turn);
      const response = await api<PairApproval>("auth/heybox/device/approve", {
        body: { pairingCode: pair.pairingCode, code: result.code },
      });
      await verify(result.accountKey, turn);
      pairPending =
        response.status === "onboarding_required"
          ? {
              pairingCode: pair.pairingCode,
              ticket: response.approvalTicket,
              accountKey: result.accountKey,
              epoch: turn,
            }
          : null;
      return response.status;
    },
    async createForPair(agreementVersion: string) {
      const proof = pairPending;
      if (!proof || !agreementVersion || proof.epoch !== epoch) throw changed();
      await verify(proof.accountKey, proof.epoch);
      const result = await api<PairApproval>("auth/heybox/device/approve", {
        body: {
          pairingCode: proof.pairingCode,
          approvalTicket: proof.ticket,
          createAccount: true,
          agreementVersion,
        },
      });
      await verify(proof.accountKey, proof.epoch);
      if (result.status !== "approved") throw changed();
      pairPending = null;
    },
    /** Private responses are discarded after account changes, including switches
     * during native Host calls (AbortSignal cannot cancel those calls). */
    async request<T>(path: string, body?: unknown) {
      const turn = epoch,
        current = saved;
      if (status !== "authenticated" || !current || current.expiresAt <= Date.now())
        throw changed();
      const response = await api<T>(path, {
        ...(body === undefined ? {} : { body }),
        token: current.token,
      });
      if (disposed || epoch !== turn || status !== "authenticated" || saved !== current)
        throw changed();
      return response;
    },
    async logout() {
      const token = saved?.token;
      epoch++;
      saved = null;
      pending = null;
      pairPending = null;
      status = confirmedKey === undefined ? "checking" : "guest";
      emit();
      await persist(null);
      if (token) await api("auth/logout", { body: {}, token });
    },
    dispose() {
      disposed = true;
      epoch++;
      saved = null;
      pending = null;
      pairPending = null;
      stopAccount();
      stopShow();
      listeners.clear();
    },
  };
}
function validSaved(value: unknown): value is Saved {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Saved>;
  return (
    typeof v.token === "string" &&
    v.token.length >= 32 &&
    typeof v.accountKey === "string" &&
    !!v.accountKey &&
    typeof v.expiresAt === "number" &&
    Number.isFinite(v.expiresAt) &&
    v.expiresAt > Date.now() &&
    typeof v.user?.id === "string" &&
    !!v.user.id
  );
}
