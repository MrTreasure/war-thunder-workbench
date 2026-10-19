# QMuse Appwrite 云函数契约

## 目录

1. [生成决策](#1-生成决策)
2. [Schema 声明](#2-schema-声明)
3. [代码目录与入口](#3-代码目录与入口)
4. [运行时 SDK 与身份](#4-运行时-sdk-与身份)
5. [触发方式](#5-触发方式)
6. [密钥](#6-密钥)
7. [浏览器调用边界](#7-浏览器调用边界)

## 1. 生成决策

默认不生成云函数。先判断前端 Appwrite Client SDK、TablesDB、FormAuth 和行权限能否安全完成需求。

不生成云函数：

- 普通 CRUD、列表、分页、详情和搜索。
- 登录用户读写自己的数据。
- 公开或认证用户可见数据的普通读写。
- 直接展示已有表数据。

生成云函数：

- 定时统计、过期清理或周期同步。
- 用户、文件或数据事件触发的可信联动。
- 跨用户、管理员级聚合、批量迁移或服务端 RBAC。
- 调用邮件、短信、支付、模型或其它需要密钥的第三方服务。
- webhook 接收与验签。
- 不能在客户端安全完成的多步服务端操作。

不需要时不要在 `.appwrite_schema.json` 中生成 `functions` 字段，也不要写 `functions: []`。

## 2. Schema 声明

在 `.appwrite_schema.json` 顶层、与 `tables` 平级的位置声明 `functions`。以下是合并到现有 schema 的片段；完整 schema 仍须包含 `databaseId` 和至少一个真实业务 table，不能为纯函数应用发明占位表：

```json
{
  "functions": [
    {
      "functionId": "daily-report",
      "name": "每日统计报表",
      "runtime": "node-22",
      "entrypoint": "src/main.js",
      "commands": "npm install",
      "timeout": 60,
      "enabled": true,
      "execute": ["users"],
      "scopes": ["databases.read", "rows.read"],
      "schedule": "0 8 * * *",
      "path": "functions/daily-report"
    }
  ]
}
```

字段约束：

| 字段         | 规则                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| `functionId` | 必填；匹配 `^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$`；函数内唯一                                   |
| `name`       | 必填、非空                                                                                   |
| `runtime`    | 默认 `node-22`；可用 `node-22` 至 `node-25`，以及 `node-18.0` 至 `node-21.0`                 |
| `entrypoint` | 默认 `src/main.js`                                                                           |
| `commands`   | 默认 `npm install`                                                                           |
| `timeout`    | `1..900` 的整数，默认 15 秒                                                                  |
| `enabled`    | 默认 `true`                                                                                  |
| `execute`    | 调用主体，默认 `["users"]`；按实际业务最小化，只使用明确需要的 `any`、`users` 或 `team:<id>` |
| `scopes`     | 运行时动态 API Key 权限；必须按实际操作最小化                                                |
| `events`     | 事件触发列表；按需生成                                                                       |
| `schedule`   | 五段 Cron；按需生成                                                                          |
| `path`       | 默认 `functions/<functionId>`；必须以 `functions/` 开头且不含 `..`                           |

当前部署链路不会应用 `memorySize`，不要生成这个字段。

`functions` 声明中不要配置 `variables`。QMuse 会把通过密钥管理设置的密钥自动关联并注入云函数。

不要依赖默认 scopes；当前默认范围包含读写权限。显式声明最小权限，例如：

- 只读表数据：`["databases.read", "rows.read"]`
- 读写表数据：`["databases.read", "databases.write", "rows.read", "rows.write"]`
- 读取用户：仅在确有需要时追加 `"users.read"`

## 3. 代码目录与入口

每个函数都生成与 `path` 一致的目录：

```text
functions/
└── daily-report/
    ├── package.json
    └── src/
        └── main.js
```

使用 ESM：

```json
{
  "name": "daily-report",
  "type": "module",
  "main": "src/main.js",
  "dependencies": {
    "node-appwrite": "^23.0.0"
  }
}
```

只有函数需要调用 Appwrite 服务端 API 时才添加 `node-appwrite`；纯计算或只调用第三方 API 的函数不添加。

函数入口使用 v5 context：

```js
export default async ({ req, res, log, error }) => {
  const body = req.bodyJson ?? {};

  try {
    return res.json({ success: true, data: body });
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    return res.json({ success: false, message: "Function failed" }, 500);
  }
};
```

只返回适合暴露给调用方的信息；不要把密钥、内部响应或完整异常对象写进响应和日志。

同一业务域、相同信任边界的紧密操作可以使用单入口 `action` 路由；不要把无关业务强行合并，也不要机械地为每个 action 创建独立函数。

## 4. 运行时 SDK 与身份

函数内访问 Appwrite 时使用运行时注入的内部连接信息：

```js
import { Client, TablesDB } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(req.headers["x-appwrite-key"]);

const databaseId = process.env.QMUSE_APPWRITE_DATABASE_ID;
if (!databaseId) {
  throw new Error("QMuse Appwrite database ID is missing");
}

const tablesDB = new TablesDB(client);
```

- `APPWRITE_FUNCTION_API_ENDPOINT` 和 `APPWRITE_FUNCTION_PROJECT_ID` 由 Appwrite 原生注入；`QMUSE_APPWRITE_DATABASE_ID` 由 QMuse 在 deployment 前自动创建为非密钥 Function Variable。
- 使用 TablesDB 时必须直接读取非空的 `process.env.QMUSE_APPWRITE_DATABASE_ID`。不得把 schema 中的 databaseId 复制到函数源码、从浏览器 Runtime 获取或接受调用方传入。
- 管理员或跨用户操作：使用 `x-appwrite-key`，权限受 schema 的 `scopes` 限制。
- 代表当前用户操作：使用 `x-appwrite-user-jwt`，并让行权限继续生效。
- 先明确函数的数据范围。动态 Key 只授予函数服务端能力，不证明调用用户有权读取全局数据；全局或跨用户结果敏感时，必须额外校验调用用户的业务权限。
- 不接受浏览器传入的 user ID、databaseId、endpoint 或 project ID 作为授权或资源归属依据。
- 不使用浏览器的 `window.__MUSE__`、外部 ALB/CDN 地址或前端传入的 endpoint。
- 直接由用户调用的函数按业务要求校验用户身份。
- schedule/event 函数通常没有用户 session，不要无条件要求 `x-appwrite-user-id`；依靠平台触发边界、最小 scopes 和业务幂等保护。

## 5. 触发方式

五段 Cron 示例：

| 表达式         | 含义        |
| -------------- | ----------- |
| `*/15 * * * *` | 每 15 分钟  |
| `0 * * * *`    | 每小时      |
| `0 8 * * *`    | 每天 8 点   |
| `0 0 * * 1`    | 每周一 0 点 |
| `0 8 * * 1-5`  | 工作日 8 点 |

事件示例：

- `users.*.create`
- `users.*.delete`
- `tablesdb.*.tables.*.rows.*.create`
- `buckets.*.files.*.create`
- `functions.*.deployments.*.create`

配置事件前检查函数写入路径。监听某类行创建事件的函数不得再次创建会匹配同一事件的行，否则会形成递归触发。必要时增加来源标记、幂等键或过滤条件。

## 6. 密钥

禁止：

- 在 `functions` 声明中配置 `variables`。
- 在 schema 中声明 `secret: true`。
- 使用 `QMUSE_APPWRITE_DATABASE_ID` 作为 Project 密钥名；这是平台保留的 Function Variable。
- 把真实密钥或占位密钥写入 schema、源码或 `package.json`。
- 手工声明密钥到函数的变量映射。

只有云函数需要真实第三方密钥，且密钥有以下至少一项可验证依据时，才进入后续流程：

- 用户明确指定并要求接入的第三方服务，其官方接入文档明确要求该凭证。
- 当前轮开始前项目中已经存在的第三方集成，其配置或代码明确使用该凭证。
- 已加载能力或已读取官方接入文档给出的明确要求；文档必须对应前两项已经确定的服务，不得据此自行选择服务商。

普通 Appwrite 数据表、FormAuth、Runtime 配置和 custom-token 不执行 `set-secret`。仅凭 AI、支付、短信等功能类型不构成密钥依据；当前轮新生成的代码、函数或 schema 不能反过来作为依据。没有依据时停止依赖该密钥的部分；不得编造服务地址或模型，也不得发明密钥名称并要求用户填写。

对每个密钥名称单独执行：

```bash
qmuse-cli cloud set-secret "SECRET_KEY"
```

密钥名称必须匹配 `^[A-Za-z][A-Za-z0-9_]*$`。只把名称作为命令参数，密钥值交给 CLI 的安全交互流程；命令中的名称与函数源码中的属性名必须完全一致。

在实际消费处直接读取：

```js
const apiKey = process.env.SECRET_KEY;
```

允许把读取结果赋给 `apiKey`、`password` 等业务变量；禁止给密钥名称定义 `envKey`、`secretName` 等别名，也禁止计算属性、动态模板、解构、环境对象别名或包装函数：

```js
const envKey = "SECRET_KEY";
const apiKey = process.env[envKey];

const apiKey = process.env["SECRET_KEY"];
const { SECRET_KEY } = process.env;
const env = process.env;
const apiKey = env.SECRET_KEY;
const getSecret = key => process.env[key];
```

QMuse 通过源码中的字面量属性识别密钥与云函数的消费关系；即使间接写法在 Node.js 运行时能取到值，也不能生成。不得把密钥值写入命令行、对话、源码、schema、配置、日志、错误响应或临时文件；命令失败时停止依赖该密钥的实现，不得用明文文件兜底。

## 7. 浏览器调用边界

仅当云函数需要由浏览器主动调用时，才在 `src/services/appwrite.ts` 创建模块私有的 `Functions` 单例并导出 `executeQmuseFunction()`。该 helper 必须等待 `initAppwrite()`，第一次执行返回 `401` 时调用 `refreshAppwriteSession()` 后重试一次；其它错误和第二次失败直接抛出。领域 Service 调用 helper，页面、组件和 hook 只调用领域 Service。纯 schedule/event 函数不生成浏览器调用代码。

不得导出原始 `functions`，不得让领域 Service 直接调用 `functions.createExecution()`，也不要在每次执行前强制刷新健康 Session：

```ts
import { Functions } from "appwrite";

const functions = new Functions(client);

function getAppwriteErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }
  const code = Number((error as { code?: unknown }).code);
  return Number.isFinite(code) ? code : null;
}

export async function executeQmuseFunction({
  functionId,
  body,
}: {
  functionId: string;
  body?: string;
}) {
  await initAppwrite();
  try {
    return await functions.createExecution({ functionId, body });
  } catch (error) {
    if (getAppwriteErrorCode(error) !== 401) {
      throw error;
    }
  }

  await refreshAppwriteSession();
  return functions.createExecution({ functionId, body });
}
```

领域 Service 只传 `functionId` 和可选的 JSON `body`，浏览器调用统一使用 Appwrite 默认的 `POST` 与同步执行模式；不得增加 `method`、`ExecutionMethod` 或 SDK 重载参数类型提取。第二次执行的错误直接抛出。Runtime SDK 的 Session 协调只覆盖其 CRUD helper；若函数调用必须在没有 `401` 的情况下感知同页登录、退出或切换账号，先扩展并发布 Runtime SDK 的通用包装能力，不要在生成应用中复制 Session 状态机。
