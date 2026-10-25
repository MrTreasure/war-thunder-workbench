import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccount } from "../src/account.ts";
import { createAPI, MiniappError, type SDK, type APIRequest } from "../src/api.ts";
import { createRuntime } from "../src/runtime-core.ts";
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function fixture(authenticated = true) {
  const events = new Map<string, Set<(value?: any) => void>>();
  let state: { isHeyboxAppLoggedIn: boolean; accountKey: string | null } = {
    isHeyboxAppLoggedIn: authenticated,
    accountKey: authenticated ? "account-a" : null,
  };
  let read = () => Promise.resolve(state);
  let profile: () => Promise<any> = async () => ({
    isHeyboxAppLoggedIn: false,
    authorization: null,
    userInfo: null,
  });
  const storage = new Map<string, unknown>();
  if (authenticated)
    storage.set("wt_heybox_session_v1", {
      token: "test_".padEnd(43, "x"),
      accountKey: "account-a",
      expiresAt: Date.now() + 60000,
      user: { id: "fixture-user-a" },
    });
  const sdk = {
    on(name: string, callback: (value?: any) => void) {
      const set = events.get(name) || new Set();
      set.add(callback);
      events.set(name, set);
      return () => set.delete(callback);
    },
    auth: { getAccountState: () => read() },
    user: { getInfo: () => profile() },
    storage: {
      getStorage: async ({ key }: { key: string }) => ({ data: storage.get(key) }),
      setStorage: async ({ key, data }: { key: string; data: unknown }) => {
        storage.set(key, data);
      },
    },
  } as unknown as SDK;
  return {
    sdk,
    storage,
    profile(read: () => Promise<any>) {
      profile = read;
    },
    change(value: typeof state) {
      state = value;
      for (const callback of events.get("heybox_app_login_change") || []) callback(value);
    },
    hold(value: ReturnType<typeof deferred<typeof state>>) {
      read = () => value.promise;
    },
    emit(name: string) {
      for (const callback of events.get(name) || []) callback();
    },
  };
}

test("same-account foreground confirmation preserves an in-flight private response", async () => {
  const f = fixture(),
    response = deferred<{ ok: boolean }>();
  const api: APIRequest = async () => response.promise as any;
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const ready = deferred<{ isHeyboxAppLoggedIn: boolean; accountKey: string }>();
  f.hold(ready);
  const pending = account.request("account/workspace");
  await Promise.resolve();
  f.emit("show");
  response.resolve({ ok: true });
  ready.resolve({ isHeyboxAppLoggedIn: true, accountKey: "account-a" });
  assert.deepEqual(await pending, { ok: true });
  account.dispose();
});

test("an actual Host account switch discards the old private response", async () => {
  const f = fixture(),
    response = deferred<{ private: string }>();
  const account = createAccount(f.sdk, async () => response.promise as any);
  await account.initialize();
  const pending = account.request("account/workspace");
  await Promise.resolve();
  f.change({ isHeyboxAppLoggedIn: true, accountKey: "account-b" });
  response.resolve({ private: "old-account" });
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof MiniappError && error.code === "ACCOUNT_CHANGED",
  );
  account.dispose();
});

test("a query submitted during foreground confirmation waits, then uses the same account", async () => {
  const f = fixture();
  const calls: { path: string; options: unknown }[] = [];
  const api: APIRequest = async (path, options) => {
    calls.push({ path, options });
    if (path === "queries")
      return {
        id: "qjob_fixture00001",
        status: "ready",
        stage: "ready",
        result: { items: [], queryId: "query_fixture00001" },
      } as any;
    throw Error("Unexpected request");
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  const ready = deferred<{ isHeyboxAppLoggedIn: boolean; accountKey: string }>();
  f.hold(ready);
  f.emit("show");
  const pending = runtime.query(
    "search",
    { nickname: "fixture", requestId: "query_fixture00001" },
    new AbortController().signal,
    () => {},
  );
  await Promise.resolve();
  assert.equal(calls.length, 0);
  ready.resolve({ isHeyboxAppLoggedIn: true, accountKey: "account-a" });
  assert.deepEqual(await pending, {
    items: [],
    queryId: "query_fixture00001",
    contentSafetyVersion: undefined,
  });
  assert.equal(calls.length, 1);
  assert.ok((calls[0].options as { token?: string }).token);
  runtime.dispose();
  account.dispose();
});

test("confirmed anonymous access retains a device ticket and does not use account credentials", async () => {
  const f = fixture(false);
  const calls: any[] = [];
  const api: APIRequest = async (path, options) => {
    calls.push({ path, options });
    if (path === "device") return { ticket: "fixture-ticket" } as any;
    return { ok: true } as any;
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  assert.deepEqual(await runtime.request("session"), { ok: true });
  assert.equal(calls[1].options.device, "fixture-ticket");
  assert.equal(calls[1].options.token, undefined);
  assert.equal((calls[0].options.body.fingerprint as string).length, 64);
  runtime.dispose();
  account.dispose();
});

test("native JSON text responses decode before job fields are read", async () => {
  const sdk = {
    network: {
      request: async () => ({ status: 200, data: '{"id":"qjob_fixture00001","status":"ready"}' }),
    },
  } as unknown as SDK;
  const result = await createAPI(sdk)<{ status: string }>("queries/fixture00001");
  assert.equal(result.status, "ready");
});

test("business requests stay on the CF gateway and reject alternate origins before networking", async () => {
  const urls: string[] = [];
  const sdk = {
    network: {
      request: async ({ url }: { url: string }) => {
        urls.push(url);
        return { status: 200, data: { ok: true } };
      },
    },
  } as unknown as SDK;
  const api = createAPI(sdk);
  await api("config");
  await api("queries/qjob_fixture00001");
  for (const path of [
    "https://api-nas.mrtreasure.cc/wt-stats/v1/session",
    "//192.168.1.1:15432/session",
    "../session",
    "queries/../../session",
    "queries/%2f%2fexample.com",
  ]) {
    await assert.rejects(
      api(path),
      (error: unknown) => error instanceof MiniappError && error.code === "INVALID_API_PATH",
    );
  }
  assert.deepEqual(urls, [
    "https://api.mrtreasure.cc/wt-stats/v1/config",
    "https://api.mrtreasure.cc/wt-stats/v1/queries/qjob_fixture00001",
  ]);
});

test("HTTP and Host errors remain visible, and writes are not retried", async () => {
  let calls = 0;
  const sdk = {
    network: {
      request: async () => {
        calls++;
        throw { code: "REQUEST_UNSUPPORTED" };
      },
    },
  } as unknown as SDK;
  await assert.rejects(
    createAPI(sdk)("queries", { body: {} }),
    (error: unknown) =>
      error instanceof MiniappError && error.message.includes("REQUEST_UNSUPPORTED"),
  );
  assert.equal(calls, 1);
  const http = {
    network: {
      request: async () => ({
        status: 429,
        data: '{"code":"QUERY_LIMIT","message":"今日查询次数已用尽"}',
      }),
    },
  } as unknown as SDK;
  await assert.rejects(
    createAPI(http)("queries", { body: {} }),
    (error: unknown) =>
      error instanceof MiniappError && error.code === "QUERY_LIMIT" && error.status === 429,
  );
});

test("ready task summaries fetch their actor-bound result rather than leaving the UI waiting", async () => {
  const f = fixture();
  const calls: string[] = [];
  const api: APIRequest = async (path) => {
    calls.push(path);
    return (
      path === "queries"
        ? { id: "qjob_fixture00001", status: "ready", stage: "ready" }
        : {
            id: "qjob_fixture00001",
            status: "ready",
            result: { items: [], queryId: "query_fixture00001" },
          }
    ) as any;
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  const result = await runtime.query(
    "search",
    { nickname: "fixture", requestId: "query_fixture00001" },
    new AbortController().signal,
    () => {},
  );
  assert.deepEqual(result, {
    items: [],
    queryId: "query_fixture00001",
    contentSafetyVersion: undefined,
  });
  assert.deepEqual(calls, ["queries", "queries/qjob_fixture00001"]);
  runtime.dispose();
  account.dispose();
});

test("invalid job responses fail visibly rather than polling an undefined task", async () => {
  const f = fixture();
  const api: APIRequest = async () => ({}) as any;
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  await assert.rejects(
    runtime.query("search", {}, new AbortController().signal, () => {}),
    (error: unknown) => error instanceof MiniappError && error.code === "INVALID_QUERY_RESPONSE",
  );
  runtime.dispose();
  account.dispose();
});

test("a transient result-read timeout retries GET without replaying the query POST", async () => {
  const f = fixture();
  const calls: string[] = [];
  let reads = 0;
  const api: APIRequest = async (path) => {
    calls.push(path);
    if (path === "queries") return { id: "qjob_fixture00001", status: "ready" } as any;
    if (++reads === 1) throw new MiniappError("REQUEST_TIMEOUT", "timeout");
    return {
      id: "qjob_fixture00001",
      status: "ready",
      result: { items: [], queryId: "query_fixture00001" },
    } as any;
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  await runtime.query("search", {}, new AbortController().signal, () => {});
  assert.equal(calls.filter((x) => x === "queries").length, 1);
  assert.equal(reads, 2);
  runtime.dispose();
  account.dispose();
});

test("an ambiguous query submission reuses the exact durable idempotency key and payload", async () => {
  const f = fixture();
  const submissions: unknown[] = [];
  let attempts = 0;
  const api: APIRequest = async (path, options) => {
    assert.equal(path, "queries");
    submissions.push(options?.body);
    if (++attempts === 1) throw new MiniappError("REQUEST_TIMEOUT", "timeout");
    return {
      id: "qjob_fixture00001",
      status: "ready",
      result: { items: [], queryId: "query_fixture00001" },
    } as any;
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  await runtime.query(
    "search",
    { nickname: "fixture", requestId: "query_fixture00001" },
    new AbortController().signal,
    () => {},
  );
  assert.equal(submissions.length, 2);
  assert.deepEqual(submissions[0], submissions[1]);
  runtime.dispose();
  account.dispose();
});

test("a Host account switch prevents an ambiguous submission from retrying as another account", async () => {
  const f = fixture();
  let submissions = 0;
  const api: APIRequest = async () => {
    submissions++;
    f.change({ isHeyboxAppLoggedIn: true, accountKey: "account-b" });
    throw new MiniappError("REQUEST_TIMEOUT", "timeout");
  };
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const runtime = createRuntime(f.sdk, api, account);
  await assert.rejects(
    runtime.query("search", {}, new AbortController().signal, () => {}),
    (e: unknown) => e instanceof MiniappError && e.code === "ACCOUNT_CHANGED",
  );
  assert.equal(submissions, 1);
  runtime.dispose();
  account.dispose();
});

test("a verified association approval replaces the phone session with the unified account", async () => {
  const f = fixture();
  Object.assign(f.sdk.auth, {
    login: async () => ({ code: "fixture-code", accountKey: "account-a" }),
  });
  const api: APIRequest = async () =>
    ({
      status: "approved",
      session: {
        token: "unified_".padEnd(43, "x"),
        expiresInSeconds: 3600,
        user: {
          id: "fixture-web-user",
          displayName: "Fixture Heybox",
          avatarUrl: "https://example.invalid/avatar.png",
        },
      },
    }) as any;
  const account = createAccount(f.sdk, api);
  await account.initialize();
  await account.approvePair({
    pairingCode: "AABBCCDDEEFF",
    purpose: "bind",
    origin: "https://wt.mrtreasure.cc",
    targetName: "Fixture web",
    expiresAt: Date.now() + 60000,
    status: "pending",
  });
  let user: string | undefined;
  account.subscribe((view) => {
    user = view.user?.id;
  });
  assert.equal(user, "fixture-web-user");
  assert.equal(
    (f.storage.get("wt_heybox_session_v1") as { accountKey: string }).accountKey,
    "account-a",
  );
  account.dispose();
});

test("an association response cannot replace the session after a native Host account switch", async () => {
  const f = fixture();
  Object.assign(f.sdk.auth, {
    login: async () => ({ code: "fixture-code", accountKey: "account-a" }),
  });
  const response = deferred<any>();
  const api: APIRequest = async () => response.promise;
  const account = createAccount(f.sdk, api);
  await account.initialize();
  const pending = account.approvePair({
    pairingCode: "AABBCCDDEEFF",
    purpose: "bind",
    origin: "https://wt.mrtreasure.cc",
    expiresAt: Date.now() + 60000,
    status: "pending",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  f.change({ isHeyboxAppLoggedIn: true, accountKey: "account-b" });
  response.resolve({
    status: "approved",
    session: {
      token: "unified_".padEnd(43, "x"),
      expiresInSeconds: 3600,
      user: { id: "fixture-web-user" },
    },
  });
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof MiniappError && e.code === "ACCOUNT_CHANGED",
  );
  account.dispose();
});

test("miniapp avatar always uses the current Host profile, independently of PC avatar", async () => {
  const f = fixture();
  const old = f.storage.get("wt_heybox_session_v1") as any;
  old.user.avatarUrl = "https://example.com/pc-avatar.png";
  f.profile(async () => ({
    isHeyboxAppLoggedIn: true,
    authorization: { profile: "granted" },
    userInfo: {
      app_user_id: "fixture-platform-user",
      profile: { avatar: "https://example.com/heybox-avatar.png" },
    },
  }));
  const account = createAccount(
    f.sdk,
    async () =>
      ({ user: { id: old.user.id, avatarUrl: "https://example.com/other-pc-avatar.png" } }) as any,
  );
  let latest: any;
  account.subscribe((value) => {
    latest = value;
  });
  await account.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(latest.user.avatarUrl, "https://example.com/heybox-avatar.png");
  await account.refreshProfile();
  assert.equal(latest.user.avatarUrl, "https://example.com/heybox-avatar.png");
  account.dispose();
});

test("unavailable Heybox profile never falls back to a PC avatar", async () => {
  const f = fixture();
  (f.storage.get("wt_heybox_session_v1") as any).user.avatarUrl =
    "https://example.com/pc-avatar.png";
  f.profile(async () => {
    throw new Error("profile unavailable");
  });
  const account = createAccount(f.sdk, async () => ({}) as any);
  let latest: any;
  account.subscribe((value) => {
    latest = value;
  });
  await account.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(latest.user.avatarUrl, null);
  account.dispose();
});

test("miniapp API does not expose the PC avatar mutation", async () => {
  const f = fixture(false);
  const api = createAPI(f.sdk);
  await assert.rejects(
    api("auth/avatar", { body: { avatarId: "cardicon_01" } }),
    (e: any) => e.code === "INVALID_API_PATH",
  );
  await assert.rejects(api("auth/avatars"), (e: any) => e.code === "INVALID_API_PATH");
});
