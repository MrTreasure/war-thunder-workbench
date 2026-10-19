# QMuse Appwrite 技术契约

## 目录

1. [生成产物与边界](#1-生成产物与边界)
2. [Runtime 与 SDK](#2-runtime-与-sdk)
3. [Session 与 Custom Token](#3-session-与-custom-token)
4. [`appwrite.ts`](#4-appwritets)
5. [后端声明文件](#5-后端声明文件)
6. [`.appwrite_schema.json`](#6-appwrite_schemajson)
7. [FormAuth 与行权限](#7-formauth-与行权限)
8. [TablesDB CRUD](#8-tablesdb-crud)
9. [文件存储](#9-文件存储按需)
10. [Secret 与错误处理](#10-secret-与错误处理)
11. [云函数](#11-云函数按需)
12. [Realtime 与 AI 场景](#12-realtime-与-ai-场景按需)

当前任务使用 `appwrite` 数据后端。本文补充 QMuse 托管 Appwrite 私有化后端的技术契约、生成产物和校验要求；角色、沟通方式、工具使用、通用编辑流程及多 Agent 协作协议沿用上层约定。

Web 模式优先消费 HTML 注入的 Appwrite 公开配置，缺失时由 Runtime SDK 使用 QMuse 应用上下文动态查询。生成应用不得因此放宽鉴权、密钥和数据权限边界。

---

## 1. 生成产物与边界

必须生成：

- `src/config/.db_backend.json`
- `src/config/.appwrite_schema.json`
- `src/config/.appwrite_auth.json`
- `src/services/appwrite.ts`

仅在业务确实需要云函数时生成：

- `functions/<functionId>/package.json`
- `functions/<functionId>/<entrypoint>`

- Web 项目使用 `appwrite` Client SDK，不使用 `node-appwrite`、Console SDK 或 API Key；云函数需要访问 Appwrite Server API 时可以在函数目录按需使用 `node-appwrite`。
- 数据访问使用 TablesDB，不使用 Databases、Collections 或 Documents API。
- 登录用户通过 QMuse custom-token 建立 Appwrite 用户 session；未登录访客使用 Appwrite anonymous session。
- 不生成 Appwrite 邮箱密码注册、邮箱密码登录或 OAuth 登录链路。

## 2. Runtime 与 SDK

统一 Appwrite service 只向 Runtime SDK 提供 QMuse 应用上下文、HTML 已注入的公开 Appwrite 配置和登录提示；配置回退查询、Client 配置与会话建立由 Runtime SDK 负责。

Web 项目只消费已有的 Runtime 上下文，不得赋值、模拟或重新声明 `window.__MUSE__`。默认脚手架已提供 `window.__TERN__` 类型，不主动读取或检查 `global.d.ts`；直接实现并运行项目类型检查。只有类型检查明确报出 `window.__TERN__` 或 `window.__MUSE__.appwrite` 缺失时，才读取项目现有全局声明，并在同一 `Window` 接口中补充实际缺少的最小可选类型：

```ts
interface Window {
  __MUSE__: {
    appId: string;
    env: "dev" | "prod";
    domain: string;
    appwrite?: {
      endpoint: string;
      projectId: string;
      databaseId: string;
      storageBucketId?: string;
    };
  };
  __TERN__?: {
    user?: {
      clientUser?: {
        userId?: string;
      };
    };
  };
}
```

只补充实际缺失的字段；不要新建第二个全局声明文件，不要生成 `declare global`，不要覆盖已有 Runtime 字段。`window.__MUSE__` 和 `window.__TERN__` 只能读取，不得赋值或模拟。

Web Runtime provider 必须满足：

- `getMuseRuntime()` 只读取现有 `window.__MUSE__` 的 `appId`、`env` 和 `domain`。`appVersionId` 不属于 `QmuseRuntimeContext`，不要传给 SDK。
- `getInjectedAppwriteConfig()` 只读取 `window.__MUSE__.appwrite` 中当前 SDK 支持的 `endpoint`、`projectId`、`databaseId` 和可选 `storageBucketId`，返回 `AppwriteRuntimeConfig | undefined`；不得硬编码这些值，也不得从 hostname、Origin、Referer 或客户端 env 推断环境。
- 创建 Runtime 时必须传入 `appwriteConfig: getInjectedAppwriteConfig()`；没有 HTML 注入时返回 `undefined`，由 Runtime SDK 保留现有 `/runtime/appwrite/config` 回退。
- `getQmuseLoginUserId()` 只返回非空的 `window.__TERN__?.user?.clientUser?.userId`；`__TERN__` 或 `user` 对象存在不代表已登录。
- `__TERN__` 只用于提示当前 QMuse 登录分支，不是权限凭证；服务端 custom-token 结果才是登录事实。
- 不在生成应用中请求、缓存或拼装 Appwrite endpoint、project ID、database ID、custom-token URL，也不提供本地 fallback。

---

## 3. Session 与 Custom Token

Runtime SDK 负责配置加载、登录态协调、custom-token、anonymous session、并发锁、当前用户缓存、单次 `401` 重试和异步审计。Web 项目按 [assets/appwrite.ts](../assets/appwrite.ts) 创建模块级单例并提供两个只读 Runtime provider，不得复制 SDK 内部状态机。Runtime 实例创建后会立即启动一次初始化；所有公开方法也会等待同一个初始化 Promise，初始化失败后允许后续调用重试。

应用侧只遵守以下消费边界：

- 普通业务不重复初始化；Runtime CRUD helper 会等待同一个初始化 Promise。只有应用明确要求在首屏渲染前暴露初始化失败时，才在 Web bootstrap 中显式 `await`/处理 `initAppwrite()`。
- 只有绕过 Runtime CRUD 的基础设施操作，例如模块私有的 `Functions` 单例，才显式等待 `initAppwrite()`。
- Appwrite Account 只承载认证身份；昵称、头像、偏好等业务资料存入独立 TablesDB profile 表。

---

## 4. `appwrite.ts`

新建该文件时复制 [assets/appwrite.ts](../assets/appwrite.ts)，再按业务需要增加类型或云函数 helper。该文件通过 `@qmuse/appwrite-runtime-sdk` 接入，不要重新手写 Runtime、Session、一次性重试和审计逻辑。若项目已有 `appwrite.ts`，只补齐缺失能力并保留其业务扩展，不要整文件覆盖。

至少导出：

- `initAppwrite()`
- `getAppwriteClients()`
- `client`、`account`、`tablesDB`
- `getCurrentAppwriteUser()`
- `createQmuseRow()`、`updateQmuseRow()` 和其它统一 CRUD helper
- `uploadQmuseFile()`、`listQmuseFiles()`、`getQmuseFile()`、`getQmuseFileViewUrl()`、`getQmuseFilePreviewUrl()`、`getQmuseFileDownloadUrl()`
- `ID`、`Permission`、`Query`、`Role`

云函数需要由浏览器主动调用时，才创建模块私有的 `Functions` 单例并导出 `executeQmuseFunction()`；不得导出原始 `functions`，也不得把它放进 `getAppwriteClients()` 返回值。纯 schedule/event 函数不创建浏览器 `Functions`。

`getAppwriteClients()` 必须是异步函数，先等待 `initAppwrite()`，再返回已配置的单例。所有业务数据访问必须复用该模块并在调用 SDK 前完成初始化。只在初始化、会话协调或 `401` 刷新阶段调用 `account.get()`，并在内存中缓存当前用户；不得在每次 CRUD 或页面 render 时无条件重复查询 Account。

`getCurrentAppwriteUser()` 同样是异步函数，必须使用 `await` 获取已完成初始化并缓存的当前用户；不得将其当作同步 getter 调用。

`getAppwriteClients()` 返回已初始化的 `client`、`account`、`tablesDB` 和 `databaseId`；业务页面不得再次读取 Runtime 或自行拼装 `databaseId`。

业务必须通过按当前业务域命名的领域 Service 访问数据。以下 `itemService` 只演示调用边界：领域 Service 可以调用 `createQmuseRow()`，页面只能调用领域方法；领域 Service、页面、组件、hook、composable 均不得直接导入 `appwrite`、`@qmuse/appwrite-runtime-sdk` 或调用 `tablesDB`。

```ts
// src/services/itemService.ts
import {
  createQmuseRow,
  listQmuseRows,
  Query,
  type Models,
} from "./appwrite";

interface ItemRow extends Models.Row {
  title: string;
}

export async function createItem(title: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error("Item title is required");
  }
  return createQmuseRow<ItemRow>({
    tableId: "items",
    data: { title: normalizedTitle },
  });
}

export function listItems(ownerId: string, cursor?: string) {
  return listQmuseRows<ItemRow>({
    tableId: "items",
    queries: [Query.equal("ownerId", ownerId)],
    limit: 20,
    cursor,
  });
}
```

为每个业务实体定义继承 `Models.Row` 的 Row 类型，并将其作为 `listQmuseRows()`、`getQmuseRow()`、`createQmuseRow()` 和 `updateQmuseRow()` 的泛型参数。未传泛型时 SDK 使用 `Models.DefaultRow`，业务字段保持宽松类型；不要为 CRUD 返回值补 `unknown` 断言或重复声明列表响应结构。

创建、更新、删除必须调用 Runtime SDK helper。SDK 负责过滤外部审计字段、写入 `creatorId`/`modifierId`、设置 owner ACL、执行一次性重试和上报异步审计；生成应用不得复制或覆盖这些逻辑。创建、更新时间读取返回 Row 的 `$createdAt`、`$updatedAt`。

---

## 5. 后端声明文件

### 5.1 `.db_backend.json`

```json
{
  "backend": "appwrite",
  "version": "1.0",
  "projectAlias": "default",
  "schemaFile": "src/config/.appwrite_schema.json",
  "authFile": "src/config/.appwrite_auth.json",
  "clientFile": "src/services/appwrite.ts"
}
```

SDK 依赖版本由 `package.json` 管理，不在该文件重复声明。

### 5.2 `.appwrite_auth.json`

必须严格生成：

```json
{}
```

该文件是保留扩展文件，不是表权限的事实来源。不得写入 `defaultTablePermissions`、`rowSecurity`、`defaultRowPermissions`、`fieldPolicy`、`roleMapping` 或任何其它字段。

实际表权限由 QMuse FormAuth 编译并同步到 Appwrite；不得在 schema 或 auth 文件中伪造表权限、行权限或角色映射。

当前生效的 FormAuth 不属于工作区产物，生成应用不能从 `.appwrite_auth.json`、Schema 或业务代码中读取。当前不提供 FormAuth 的 Agent 命令；非默认权限只能在 QMuse 云服务的“数据表权限设置”中修改。

多 Agent 协作本身不对应 Appwrite `Role`。只有生成应用存在真实的多人共享数据需求时，才提示用户在“数据表权限设置”中配置用户、团队或管理员权限。

---

## 6. `.appwrite_schema.json`

Schema 声明 database、tables、columns、indexes，以及可选的 functions。

> 约束源：ob-appbase `Attributes.php` 内联 columns 白名单；QMuse JsonTable 共享表窄化。与 Appwrite Cloud 公有云文档不同——公有云文档里 `varchar`/`email` 等顶层 type 仅适用增量列或新版全量 schema，当前 QMuse 后端 `createTable` 内联 `columns` 不接受它们。

```json
{
  "databaseId": "qmuse-app-db",
  "projectAlias": "default",
  "tables": [
    {
      "tableId": "items",
      "name": "Items",
      "columns": [
        {
          "key": "title",
          "type": "string",
          "size": 255,
          "comment": "标题",
          "required": true
        },
        {
          "key": "status",
          "type": "string",
          "format": "enum",
          "elements": ["pending", "completed"],
          "comment": "状态",
          "required": true
        },
        {
          "key": "email",
          "type": "string",
          "format": "email",
          "size": 254,
          "required": false
        },
        {
          "key": "notes",
          "type": "string",
          "size": 1000,
          "comment": "备注",
          "required": false,
          "default": ""
        },
        {
          "key": "priority",
          "type": "integer",
          "required": false,
          "default": 0
        },
        {
          "key": "published",
          "type": "boolean",
          "required": false,
          "default": false
        },
        {
          "key": "startsAt",
          "type": "datetime",
          "required": false
        }
      ],
      "indexes": [
        {
          "key": "idx_status",
          "type": "key",
          "attributes": ["status"]
        }
      ]
    }
  ]
}
```

### 6.1 Schema 约束

- 新建 Appwrite 云环境时，顶层 `databaseId` 必须固定为 `qmuse-app-db`，不允许自定义；`tables` 必须是非空数组。当前服务端不接受只有 functions、没有业务 table 的 schema；遇到纯函数应用时明确报告该平台约束，不得创建无业务用途的占位表。
- 每个 table 必须同时声明非空字符串 `tableId` 和 `name`。`tableId` 是稳定的程序标识，`name` 是用户可读的表名；表级 `comment` 不属于表名契约，不能省略 `name` 后用 `comment` 代替。
- `tableId`、字段 `key` 和索引 `key` 使用 SQL 标识符规则：匹配 `^[A-Za-z_][A-Za-z0-9_]{0,127}$`。tableId 在 schema 内唯一，字段 key 和索引 key 在各自 table 内唯一。不要把 database、project、function 等 Appwrite 资源 ID 的 36 位规则用于表结构标识符。
- 业务 columns 不声明 `code`、`creatorId`、`modifierId`、`gmtCreate`、`gmtModified` 或 `$` 开头的系统字段。
- table 中不生成 `permissions`、`rowSecurity` 或 `sampleRows`；权限由 QMuse FormAuth 管理。
- QMuse 新建 Appwrite Project 使用 JsonTable 共享表存储。内联 columns 顶层 `type` 只允许 5 种：`string`、`integer`、`double`、`boolean`、`datetime`，在 metadata 中分别映射为 `Text`、`Number`、`Boolean`、`DateTime`。
- 不生成 `point`、`linestring`、`polygon` 或其它空间字段。JsonTable 不支持空间字段、空间索引和空间操作符。ob-appbase 内联 8 种白名单里的空间类型在 QMuse 后端被窄化禁用。
- `varchar`、`text`、`mediumtext`、`longtext`、`email`、`url`、`ip`、`enum`、`float`、`relationship` 不作为内联顶层 `type` 出现；email/url/ip/enum 统一用 `type: "string"` 配合 `format: "email" | "url" | "ip" | "enum"`，长文本用 `type: "string"` 配大 `size`，关联关系用普通 ID 字段。不生成 `array: true`、`signed`、`min`、`max`、`filters` 等扩展属性。
- 业务字段建议设置可选 `comment` 作为友好展示名，例如字段 key `order_status` 使用 `comment: "订单状态"`。comment 必须是字符串，保存时去除首尾空白，规范化后最长 256 个 Unicode 字符；空值表示清除，不设置时 metadata label 回退字段 key。
- comment 只承载展示名称或简短字段说明，不得包含密码、访问密钥或敏感数据，也不改变字段 key、类型、必填、默认值、索引、权限或 CRUD 参数名。

### 6.2 类型与 size

| Schema 声明              |                                                                  size 约束 | metadata 类型 |
| ------------------------ | -------------------------------------------------------------------------: | ------------- |
| `string`                 | 必填整数，`1..1073741824`；未明确需要长文本时优先使用不超过 255 的业务上限 | `Text`        |
| `string + format: email` |                                         必填整数，`1..254`，通常使用 `254` | `Text`        |
| `string + format: url`   |                                       必填整数，`1..2000`，通常使用 `2000` | `Text`        |
| `string + format: ip`    |                                           必填整数，`1..39`，通常使用 `39` | `Text`        |
| `string + format: enum`  |              整数 `1..255`；不得小于最长选项，建议 `max(64, 最长选项长度)` | `PickList`    |
| `integer`、`double`      |                                                                不设置 size | `Number`      |
| `boolean`                |                                                                不设置 size | `Boolean`     |
| `datetime`               |                                                 不设置 size、不设置 format | `DateTime`    |

`string` 的 `format` 只允许 `email`、`enum`、`ip`、`url`；省略 `format` 表示普通字符串，不得写 `format: "none"` 或空字符串以外的非法值。`datetime` 不写 `format`。字符串长度按字符校验；不得通过静默截断业务数据来满足 size。metadata 会把 email/url/ip/enum 形态的 string 也统一表达为 `Text`（enum 在某些后端为 `PickList`），不会保留原 `format` 差异作为独立 type。

### 6.3 required、default 与 enum

- `required` 必须是 boolean；省略时按 `false` 处理。
- `required: true` 不得同时设 `default`。有 default 时必须设置 `required: false`，不要用 `default: null` 表达“无默认值”，直接省略 default。
- `string` 的 default 必须是字符串，且长度不能超过 size。
- `integer` 的 default 必须是 JSON 整数；`double` 可以使用整数或小数；`boolean` 必须使用 JSON boolean，不能用 `0`、`1` 或字符串代替。
- `datetime` 的 default 必须是合法 ISO 8601 字符串。
- email、URL、IP 的 default 除满足字符串长度外，还必须通过对应格式校验。
- enum 必须提供非空 `elements`；每项必须是非空字符串且最长 255 字符。生成时应去重以避免无意义的重复选项；enum default 必须严格等于 elements 中的一个值。

### 6.4 索引约束

- 索引类型只使用 `key`、`unique`、`fulltext`；`attributes` 必须是非空数组，并只引用当前 table 声明的普通业务列。
- 自定义索引不得引用 `$id`、`$createdAt`、`$updatedAt`、`$permissions` 或 QMuse 审计字段。Runtime 默认的 `Query.orderDesc("$createdAt")` 不要求声明 `$createdAt` 索引。
- `orders` 存在时必须是与 attributes 等长的数组，每项只能是 `ASC` 或 `DESC`。当前 QMuse schema 类型契约不生成 `lengths`。
- `fulltext` 索引的 `attributes` 只能引用 `type: "string"` 的列。JsonTable 支持 fulltext 检索，但生成应用不得依赖或承诺相关性排序。不要为其它类型的列创建 fulltext 索引。
- 复合索引总长度由 AppBase 当前数据库适配器校验。优先索引较短的精确查询字段；若生成版本报告索引过长，缩短或拆分索引，而不是截断业务字段。

### 6.5 Schema 演进

- 修改已有应用时只使用静态、保守的 append-only 规则，不查询表中是否有数据来放宽约束。最近一次 READY Schema 是唯一演进基线；READY 基线由平台自动读取和校验，不得向用户询问 READY 基线。本地校验器只校验当前产物，无法替代服务端基于 READY Schema 的差异校验。
- 保留 READY Schema 中的 databaseId、table、column 和 index。不能移除旧 table 或旧 column；从声明中移除字段也不会删除底层物理列。
- 已有 column 的 `type`、`required`、`size`、`format`、`elements`、`default`、标量/数组形态及其它约束不可修改。`required: false` 与 `required: true` 两个方向都不能切换，string size 也不扩大或缩小。
- 已有 table 只允许新增 `required: false` 且不带 `default` 的 column。default 只影响后续新记录，不会回填历史数据；业务非空要求放在应用层校验。
- 已有 index 不能新增、删除，也不能沿用原 key 修改 type、attributes、orders 或 lengths。索引不是 required 切换失败的根因，但 indexed column 的约束变化还可能要求重建索引侧表。
- 一个版本只要包含一项不支持的演进，整个 Schema Version 都失败；不能依赖同一版本中其它合法修改让它部分生效。
- 新 table 可以按第 6.1 至 6.4 节声明 required、合法 default 和 index，但 `required: true` 与 default 仍不得并存。
- 存量应用新增 `tableId` 无需用户确认，但必须在修改真实 Schema 和业务文件前，把保留 READY 定义并包含全部新表的完整候选写入 `$HOME/tmp/qmuse-cloud/schema-candidate-<唯一标识>.json`，再执行 `qmuse-cli cloud schema preflight --candidate '$HOME/tmp/qmuse-cloud/schema-candidate-<唯一标识>.json'`。必须把占位符替换为 1 至 64 位字母、数字、下划线或短横线，并用单引号保留字面量 `$HOME`。候选内容变化时使用新标识，内容未变化的幂等重试复用原路径。预检通过后再写入完全相同的 Schema。普通新增业务表与替代不兼容旧结构的新表使用同一流程；尚无 READY 基线的首次创建不需要候选预检。
- 遇到 `JsonTable cannot add a required attribute while existing documents are present`、`JsonTable updateAttribute constraint changes are fail-closed until historical data validation and index side-table rebuild are available.` 或 `APPWRITE_SCHEMA_VERSION_FAILED` 时，先恢复结构化错误指出的 READY 定义。不要自动把必填切成可选、添加 default、删除 index，或将新 Schema hash/version ID 当作 ACTIVE。
- 同一 fail-closed 错误在恢复后仍重复出现，且只有新建数据表才能完成迭代时，先确定全部语义化新表名称，在内存中形成保留 READY 定义并包含完整新表集合的候选 Schema。不得自动添加 `_v2`、时间戳或随机后缀。
- 在修改任何项目文件之前，只把完整候选 JSON 写入 `$HOME/tmp/qmuse-cloud/schema-candidate-<唯一标识>.json`；这是预检阶段唯一允许的文件写入。随后必须把同一路径作为静态参数，单独执行 `qmuse-cli cloud schema preflight --candidate '$HOME/tmp/qmuse-cloud/schema-candidate-<唯一标识>.json'`，不得省略参数，不得串联、管道或并行执行其它命令。
- 预检返回的 `candidatePath` 必须与显式参数一致。返回 `failed` 或 `blocked` 时，只修复候选，并在内容变化后换用新文件名重试。返回 `passed` 时，平台自动批准当时的完整候选快照，无需用户确认；预检不会写真实 Schema 或创建数据表，必须先把该候选文件中的同一份完整 JSON 写入真实 Schema，再修改依赖它的业务代码并完成质量门，实际同步才会执行建表。候选内容或 READY 基线变化时必须重新预检。
- 候选内容和 READY 基线均未变化时，不得创建新候选文件或反复预检；同一路径最多做一次幂等重试。一次匹配路径的 `passed` 后，若质量门仍对相同候选重复返回 `APPWRITE_SCHEMA_PREFLIGHT_REQUIRED`，停止循环并报告平台候选授权未生效，不得改为向用户发起新建表确认。
- 写入真实 Schema 后，保留旧表声明仅用于 append-only 内部兼容，把业务类型、Service、CRUD、查询和页面全部切换到新表，不得继续引用旧表；重新通过产物校验和质量门后才能同步。
- 若模型违反前置协议并先生成新表代码，最终质量门返回 `APPWRITE_SCHEMA_PREFLIGHT_REQUIRED` 并阻止同步。必须把当前完整 Schema 写入带唯一标识的候选文件，并通过 `--candidate` 显式预检该文件；预检通过后直接继续，不得向用户发起新建表确认。该路径只作为 fail-closed 兜底。
- 修改已有 Schema 时必须保留未要求变更的 comment；主动删除或写空表示清除，并使 metadata label 回退字段 key。comment 变化随应用版本进入 AppBase Schema Version，不通过 Console 或独立列注释 API 维护 QMuse 应用 Schema。

- 不声明 `code`、`creatorId`、`modifierId`、`gmtCreate`、`gmtModified` 或对应审计索引。
- QMuse 服务端建表时只补充可空的 `creatorId`、`modifierId`，类型为 `string(36)`；schema 无需也不得重复声明。
- QMuse 服务端不补充物理列 `gmtCreate`、`gmtModified`，也不创建旧索引 `idx_qmuse_gmt_create`。创建、修改时间直接使用 Appwrite 系统字段 `$createdAt`、`$updatedAt`。

---

## 7. FormAuth 与行权限

表级权限由 QMuse FormAuth 管理。当前新表默认策略为：

- READ：ALL
- SUBMIT：ALL
- EDIT：CREATOR
- DELETE：CREATOR

### 7.1 Agent 能力边界

当前不提供 FormAuth 的 Agent 命令或声明式权限产物。Agent 只能使用上述平台默认表权限；当前生效的 FormAuth 不属于工作区产物，用户也可能在应用生成后继续通过产品界面修改它，因此 Agent 不能仅根据代码判断线上实际权限。

默认权限满足当前需求时，无需在聊天正文汇报权限，不产生用户待办或技术交付章节。只有当前需求明确依赖非默认权限时，才说明必须由用户完成的配置，包括需要调整的数据表、操作（读取、提交、编辑或删除）和目标成员范围；依赖该权限才能成立的部分必须明确标记为尚未完成，同时继续完成不依赖该权限变更的业务代码。

存在具体的敏感数据或权限风险，但当前功能在默认权限下仍可成立时，可以简要说明实际风险和准确的建议配置，不得把建议写成未完成待办或生成例行安全报告。不得输出“如需调整可前往设置”之类没有具体数据表、操作和成员范围的兜底文案。进度与最终回复遵循 SKILL.md 的沟通边界，不复述本契约的技术清单。

不得生成或修改 FormAuth 配置，不得向 `.appwrite_auth.json` 或 Schema 写入权限，不得用页面条件判断或前端隐藏模拟表权限，也不得使用云函数重复实现另一套表权限。未经过产品界面配置时，不得声称非默认权限已经生效。

### 7.2 默认权限与行权限

创建行时为当前 Appwrite 身份设置 owner 行权限，以承接 CREATOR 语义。该身份既可以是 custom-token 用户，也可以是 anonymous user。业务代码必须调用第 4 节的 `createQmuseRow()`，由它使用同一个 user ID 写入 owner ACL、`creatorId` 和 `modifierId`：

```ts
const created = await createQmuseRow({
  tableId,
  data,
});
```

不得默认生成 `Role.any()`、`Role.guests()`、`Role.label("admin")`、其它用户 ID 或未确认的 team role。公开读取或多人协作必须来自明确业务需求；非默认表权限由用户在“数据表权限设置”中完成。

---

## 8. TablesDB CRUD

浏览器业务代码统一通过 `src/services/appwrite.ts` 导出的 Runtime facade 访问 TablesDB，所有调用使用对象参数形式：

```ts
const page = await listQmuseRows<ItemRow>({
  tableId,
  queries: [
    Query.equal("ownerId", ownerId),
    Query.equal("status", "active"),
  ],
  limit: 20,
  cursor,
});

const row = await getQmuseRow<ItemRow>({
  tableId,
  rowId,
});

const created = await createQmuseRow<ItemRow>({
  tableId,
  data,
});

const updated = await updateQmuseRow<ItemRow>({
  tableId,
  rowId,
  data,
});

await deleteQmuseRow({
  tableId,
  rowId,
});
```

`tablesDB.listRows()`、`tablesDB.createRow()` 和 `tablesDB.updateRow()` 只能出现在 `@qmuse/appwrite-runtime-sdk` 的内部实现。页面、组件、hook、composable 和其它业务 Service 必须通过 `src/services/appwrite.ts` 的 facade 调用；页面再通过领域 Service 调用该 facade，以保证查询、分页、Session、审计和行权限使用同一套实现。读取审计时间时使用返回 Row 的 `$createdAt`、`$updatedAt`。

返回值约定：

- `listRows` 返回 `{ rows, total }`。
- `getRow`、`createRow`、`updateRow` 直接返回 `Row`。
- 不读取 `documents`、`document` 或额外的 `row` 包装层。
- 不依赖 `deleteRow` 的返回内容。

查询约束：

- `listQmuseRows()` 的 `queries` 只接受 `Query.equal()`、`Query.search()` 等构造器生成的过滤、搜索或字段选择条件。不得手写 `equal("field", "value")`、JSON 字符串或其它查询字符串。
- Runtime SDK 自动添加 `Query.orderDesc("$createdAt")`、`Query.limit(limit)` 和可选的 `Query.cursorAfter(cursor)`。调用方使用顶层 `limit`、`cursor` 参数，不得在 `queries` 中重复传入 `Query.orderAsc/Desc()`、`Query.limit()`、`Query.offset()` 或 `Query.cursorBefore/After()`。
- `limit` 必须是 `1..20` 的整数，省略时为 `20`；翻页使用上一页最后一行的 `$id` 作为 `cursor`。
- 当前 Runtime facade 不支持自定义排序。业务确实需要其它排序时明确报告能力限制，不得绕过 facade 直接调用 `tablesDB.listRows()`。
- 不拉取全表后在前端分页或过滤。
- 普通业务过滤和排序字段应有对应索引；Appwrite 系统字段不能用于自定义索引。

存在列表 UI 时的消费约束：

- 页面必须分别处理加载、失败和空数据；请求失败不得回退为空数组或把 `total` 当作 `0`。
- 只请求首屏时不得把 `rows.length` 展示为完整数量。当 `total` 大于已加载数量时，使用最后一行 `$id` 作为 cursor 提供“加载更多”或等价分页入口。

---

## 9. 文件存储（按需）

文件存储能力要求 @qmuse/appwrite-runtime-sdk 1.2.0 或更高版本。已有项目新增文件存储时必须先升级 Runtime SDK；未使用文件存储的存量项目可以继续保留原有兼容版本。

只有业务需要持久化图片、附件、音视频或其它文件时才消费文件存储。Bucket 是云环境级平台资源，由 `window.__MUSE__.appwrite.storageBucketId` 或保留的 config 回退取得；生成代码不得接受用户输入、URL 参数或业务参数中的 `bucketId`，也不得硬编码、缓存或自行发现 Bucket。

`Storage` 单例只在 `src/services/appwrite.ts` 内创建并作为 `fileStorage` 交给 Runtime SDK，不向业务层导出原始单例。领域 Service 只能使用以下 facade：

- `uploadQmuseFile({ file, fileId?, onProgress? })`
- `listQmuseFiles({ queries?, limit?, cursor? })`
- `getQmuseFile({ fileId })`
- `getQmuseFileViewUrl({ fileId })`
- `getQmuseFilePreviewUrl({ fileId, ...previewOptions })`
- `getQmuseFileDownloadUrl({ fileId })`

页面和领域 Service 不直接导入 Appwrite `Storage`，不手写 `/storage/buckets/...` 请求，也不得硬编码任何 `bucketId`。TablesDB 只保存文件 ID、展示 URL 或其它必要业务引用，不保存 base64 或完整文件内容。列表分页由 Runtime SDK 统一处理，`limit` 范围为 `1..20`。

文件存储未开启时 Runtime SDK 抛出 `QMUSE_STORAGE_NOT_INITIALIZED`。业务应把它转换为明确的不可上传状态，不得自动切换到其它 Bucket、公开图床或本地伪持久化。会话、匿名访问和一次性 `401` 重试继续由 Runtime SDK 统一处理。

### 文件修改与删除边界

生成应用的文件能力仅限上述上传、查询和读取 helper，不提供已上传文件的重命名、覆盖、权限修改或物理删除。即使使用者是应用创建者、管理员或上传者，也不得据此假设运行时拥有这些能力；不得调用底层 `updateFile` / `deleteFile`、平台管理接口，或生成云函数规避限制。

在需求分析阶段就按主技能的“生码前的文件能力判断”确定范围，不得先生成不支持的操作再依赖校验器纠偏。helper 缺失是能力边界，不是 SDK 版本问题或需要自行补齐的封装；不得为实现这些操作查询新版 SDK、研究底层接口或扩展 helper。文件修改、删除返回权限错误时，按能力不支持处理并移除违规调用，不进入刷新 Session、升级依赖或修改权限的重试循环。

- 创作者要求修改存储文件名、删除原文件时，仅在创作对话中告知：由应用创建者或管理员前往「云服务面板 → 文件存储」操作。这是平台管理能力，不是作品运行时能力；不得在生成作品的页面、弹窗、错误提示中加入该引导、平台管理链接或原文件重命名、物理删除按钮，也不得要求作品的使用者执行平台管理操作。
- 用户只需要修改附件标题、图片展示名称时，可在业务数据表中维护展示名称，并说明存储原文件名不变。
- 移除附件或删除业务记录可以更新业务引用，但不会物理删除存储文件，也不代表释放存储空间。不得把“移除引用”标记为“删除原文件”。
- 更换附件可上传一个新文件后更新业务引用；不得使用既有文件 ID 覆盖旧文件，也不得自动删除旧文件。

这些边界只在当前创作需求涉及对应操作时向创作者说明，不为正常上传、查询或预览增加无关提醒。

---

## 10. Secret 与错误处理

custom-token 的 `secret` 只能短暂存在于内存中，并立即用于创建 session。不得写入 localStorage、sessionStorage、indexedDB、cookie、URL、HTML、配置、日志、埋点或错误消息。

前端任何位置都不得出现 Appwrite API Key。

错误处理：

- `401`：支持的运行时操作由 Runtime SDK 刷新 session，并最多重试一次原请求；不支持的文件修改、删除按上述能力边界处理，不以刷新 session 规避权限拒绝。
- `403`：权限不足，直接抛出。
- `409`：后端未就绪，直接抛出并保留错误信息。
- `429`：提示限流，由调用方稍后重试。
- 其它错误：保留 `code`、`type` 和 `message` 后抛出。

没有 QMuse 登录提示时可以直接使用 anonymous session。已发起 custom-token 时，只有其明确返回 HTTP `401` 才能降级为 anonymous session，不能用 anonymous session 掩盖权限、配置、网络或服务故障。

---

## 11. 云函数（按需）

需要可信服务端逻辑、第三方密钥、定时任务或服务端集成时，才生成对应云函数。

普通 CRUD、列表、分页、详情和单用户权限内的数据读写使用前端 TablesDB，不生成云函数。不需要云函数时省略 `functions` 字段，不生成空数组。

需要云函数时，完整阅读并以 [cloud-functions.md](cloud-functions.md) 为唯一实现契约。函数 Schema、目录、入口、调用身份、最小 scopes、触发器、运行时变量、第三方密钥和浏览器调用 helper 均只在该文档定义；不要从本契约拼装第二套实现。

---

## 12. Realtime 与 AI 场景（按需）

默认不生成 Realtime。确有实时需求时：

- 只订阅必要资源，不使用 `client.subscribe("*")`。
- 避免重复订阅，并在页面卸载时 unsubscribe。
- session 刷新后仅恢复必要订阅。

AI、chat、agent 或 workflow 应用还需满足：

- 聊天消息服务端分页，默认每页不超过 20 条。
- 不首次加载全部历史，也不默认全量实时同步。
- token usage 使用独立字段。
- embeddings 不存 TablesDB，vector 数据使用外部向量数据库。
- 只有第三方模型及其凭证已有云函数契约要求的明确依据时，才通过 QMuse 密钥管理把模型 API Key 交给云函数；浏览器不持有密钥。
