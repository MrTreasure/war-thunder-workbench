# 项目维护说明

本文供希望参与完善项目的朋友参考。使用介绍见 [README](../README.md)。

## 本地运行

需要 Node.js **22.12+**（或符合 Vite 8 要求的更新版本）、**pnpm 12.3.4**。刷新数据还需要 Python 3 与 curl。依赖版本已固定，请保留 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发地址为 `http://localhost:5178`。开发命令会先从仓库的规范 JSON 生成国家模块，不要求先联网刷新游戏数据。

```bash
pnpm run check        # 类型、Lint 与数据一致性
pnpm run build        # 构建并检查产物与十国数据哈希
pnpm run preview      # http://localhost:4178
```

可分别运行 `pnpm run typecheck`、`pnpm run lint`、`pnpm run check:data`。页面入口为 `#/tree` 与 `#/lineups`；国家、军种和模式可通过外层查询参数指定，例如 `?country=china&category=ground&mode=rb#/tree`。

地图与攻略入口及资料提取方式见[攻略页维护说明](route-guides.md)。

### 部署

`pnpm run build` 输出静态文件到 `dist/`，可部署到支持相对静态资源路径的站点。上传全部构建资源后再切换 HTML，并保留旧哈希资源供已打开的页面继续使用。国家资料随哈希 JS 模块发布，**不发布独立 JSON 文件**。

本仓库采用 QMuse 模板，Vite 插件统一由 `@qmuse/vite-config` 配置。使用 QMuse 时，应绑定自己的应用，再通过 qmuse-cli 导入；`.qmuse/` 为本地平台配置，不纳入 Git。`publish` / `release` 脚本是原维护环境的专用发布流程，不能直接作为通用部署命令使用。

## 数据与计算

### 数据来源

- 科技树、载具资料、图片、RP 与配件成本：[War Thunder Wiki](https://wiki.warthunder.com/)。
- 礼包人民币价格：[Gaijin 官方商店](https://store.gaijin.net/catalog.php?category=WarThunder&skin_lang=zh)，直接采集人民币标价，不使用汇率换算。价格核对结果与来源保存在 `data/store-prices.json`，可运行 `pnpm run refresh:prices` 更新。
- 简体中文名称与等级门槛：公开的原版游戏文件镜像 [War-Thunder-Datamine](https://github.com/gszabi99/War-Thunder-Datamine)。本地 JSON 保留固定版本、原文、哈希与核对时间；它不是官方 API。
- 分房规则：来源记录在 [data/lineup-rules.json](../data/lineup-rules.json)。
- Logo、国旗与壁纸使用原始官方 HTTPS 地址；图片可用性取决于对应站点。来源记录在 [data/branding.json](../data/branding.json) 与 [data/flags.json](../data/flags.json)。

当前收录 **10 国、44 棵可用科技树、3,236 条载具记录**，其中直升机 **112 条**，覆盖十国，包含研发关系、权重、配件和游戏简体中文名称。[直升机资料与范围](helicopters.md)。缺少对应军种的国家显示空状态。无法可靠匹配的少量配件名称保留英文，不使用臆测翻译。

### 数据组织与更新

| 路径 | 内容 |
| --- | --- |
| `data/trees.json`、`research.json`、`planning.json` | 科技树、研发点与等级门槛 |
| `data/modifications.json` | 配件总成本、逐项成本与核对依据 |
| `data/localization.json` | 原版简体中文映射与来源 |
| `data/lineup-rules.json`、`lineup-codebook.json` | 分房规则与稳定分享编码 |
| `src/routes/` | TanStack 文件路由 |
| `src/Workbench.tsx` | 共享状态与国家资料加载 |
| `src/generated/` | 生成的导航清单与国家 JS 运输模块 |
| `scripts/`、`schema/` | 采集、构建、校验与数据结构 |
| `docs/screenshots/`、`docs/examples/` | 功能图片与示例队列 |

```bash
pnpm run refresh               # 联网刷新规范 JSON，不发布
pnpm run refresh:localization  # 单独更新中文映射
pnpm run check
pnpm run build
```

刷新失败保留此前的核对数据与时间，不把失败请求标记成新快照。RP 未知与零成本有明确区别；配件逐项成本须核对完整总额。等级自动补位提供有效方案，不承诺全局最省。

分享编码字典只追加，不能重排、重编号或复用退休编码，以保证旧分享码稳定。

### 本地存储

研发进度、配件进度、购物车与队列分别保存在当前浏览器。工具会检查已下载资料是否完整；自动清理过期资料时，不会删除个人进度或队列。

这些数据不自动跨浏览器、设备或域名同步，也不会从游戏账号自动读取；清除站点数据会移除本地记录，请按需导出购物车或保存队列分享码。

## 参与贡献

欢迎提交功能建议、数据问题与修复。反馈数据问题时，请附上国家、军种、载具名称、模式、游戏版本和可核对来源；界面问题请附截图与屏幕尺寸。

提交代码前运行 `pnpm run check` 与 `pnpm run build`。载具数据和来源应维护在 `data/*.json`，不要写进 JSX；同时保留已有存储格式与分享码兼容性。开发约定见 [AGENTS.md](../AGENTS.md)。

