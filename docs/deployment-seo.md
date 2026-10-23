# Cloudflare、QMuse 部署与搜索收录

## 目标与命令

2026-10-23 用户明确约定：战雷正式站是独立 Workers，不套用共享 Render 正式地址约定。Render 只作预览；wt 不跳转到 Render。

- SEO 主站：`https://wt.mrtreasure.cc/`。
- QMuse 分发入口：`https://render.qmuse.pub/p/muse/8645013411493394`。
- 验收预览使用 `https://render.mrtreasure.cc/war-thunder-trees/`，使用 `noindex`；旧 `/muse/war-thunder-trees/` 仅作兼容跳转。
- 后端继续通过既有 `api.mrtreasure.cc` Cloudflare Tunnel 提供服务。CF 上传内容仅为已验证的静态构建，不包含后端、凭据、研究目录或原始数据 JSON。

```sh
pnpm run deploy:cf --dry-run
pnpm run deploy:qmuse --dry-run
pnpm run deploy:preview --dry-run

# 预览确认后，执行对应命令才会真正发布
pnpm run deploy:cf
pnpm run deploy:qmuse
pnpm run deploy:preview
```

三个命令均执行 `check`、`build`。CF dry run 生成本地上传目录并通过 Wrangler 校验；QMuse dry run 检查构建与现有绑定，不调用平台。QMuse 命令使用固定版本 CLI，先导入绑定应用，再正式发布 READY 版本，最后核对线上 `appVersionId`。导入成功本身不代表已发布。失败时保留部署 ID，避免重复创建部署。`.qmuse/project.json` 只由 CLI 更新，发布命令不改绑定。

`pnpm run import:qmuse` 仍仅导入，不等同于 `deploy:qmuse`。

## 免费托管评估

采用 **Workers Static Assets**，不添加 Worker 服务端脚本或付费存储。官方价格页注明静态资源请求免费且不限量；若以后添加动态 Worker，则另有 Worker 调用额度和 CPU 限制，不能把静态免费额度套用到动态请求。

- 现有构建约 15 MB，最大单文件约 2 MB，远低于 25 MiB 单文件限制。
- 上传前检查最多 20,000 个文件；历史哈希资产保留在运行目录 `/vol1/1000/appdata/war-thunder-trees/cloudflare/asset-history/`，随后续部署一同上传，保证旧页面的懒加载仍可用。达到限制时阻止发布，需人工规划旧会话保留期，不自动删历史。
- `wrangler.jsonc` 使用现有域名区内的专用自定义域名 `wt.mrtreasure.cc`，不启用 `workers.dev` 和版本预览 URL，避免额外重复收录入口。
- Hash 路由继续工作；不存在的路径返回真正的 404，不把所有错误路径改成首页。HTML `no-store`，哈希资源 immutable，静态介绍页重新验证。Cloudflare 根据请求协商边缘压缩，无需自行生成服务器端解压逻辑。
- Cloudflare Pages 也可免费托管，官方说明 Free 方案每月 500 次构建、20,000 文件、单文件 25 MiB。当前已经本地构建，Workers Static Assets 足以完成发布，不必再接管 Git 构建或新增 Vite 插件。
- 免费不代表中国大陆访问一定稳定或更快；需要实际访问评估，不能承诺百度收录速度或搜索排名。

依据（2026-10-22 读取）：[Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)、[静态资源](https://developers.cloudflare.com/workers/static-assets/)、[静态响应头](https://developers.cloudflare.com/workers/static-assets/headers/)、[Pages 限额](https://developers.cloudflare.com/pages/platform/limits/)。

## 首次正式 CF 部署前

1. 在管理 `mrtreasure.cc` 的 Cloudflare 账号完成 `pnpm exec wrangler login`，或由运行环境提供最小权限的 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。凭据遵循本机 credentials skill，只存密码本或授权的运行环境，不写入仓库。首次发布会创建名为 `war-thunder-workbench` 的静态 Worker 并绑定指定域名；先确认没有同名服务或该域名已有业务。
2. 为现有 stats 服务增加精确 CORS origin `https://wt.mrtreasure.cc`；在后端授权返回 URL allowlist 增加 **`https://wt.mrtreasure.cc/`**。既有 QMuse 和预览入口继续保留。不要开放任意子域、通配符返回 URL 或公网 NAS 端口。部署脚本实际检查预检响应与不发送邮件、不登录的短期授权开始请求，缺少权限时停止。
3. Turnstile 继续运行在 `api.mrtreasure.cc` 登录窗口，登录入口不迁到 NAS，也不需要放宽 Turnstile hostname。人工验收访客访问、查询、主动登录、弹窗返回、退出、地图导出和国家模块懒加载。
4. `deploy:cf` 直接发布独立 `war-thunder-workbench` Worker 和 `wt.mrtreasure.cc` 自定义域名。`deploy:preview` 使用现有兼容发布输入及共享 Render 同步器，禁止拿 Render 发布替代正式 Worker 部署。正式发布完成后核对公网 HTML、JS、CSS 和 sitemap；只有构建或预演成功不能宣称正式站可用。

CF 公网部署校验使用 HTTP/2，并仅在 DNS、TLS、超时或传输中断时尝试该域名发布的其他 IPv4 地址；保留原 URL、SNI 与证书校验，不修改系统 DNS，HTTP 拒绝不会被重试掩盖。`deploy:cf --verify-only` 可以复核已发布版本，不重复上传或创建登录请求。

新域名是不同浏览器 origin，现有 localStorage、OPFS、队列与地图方案不会自动迁移。使用现有分享/导出功能迁移需要的内容，不能宣称跨域自动同步。账号仍通过既有安全登录窗口访问。

## SEO 实现与边界

`data/site-seo.json` 保存三语正式文案。构建生成：

- `/`：中立入口，保留首次按浏览器语言选择和用户手动偏好，不自动跳转；作为语言组的 `x-default`。
- `/zh/`、`/en/`、`/ru/`：固定语言的真实应用入口。首次 HTTP 响应直接提供该语言的首屏正文、标题、description、canonical、OG/Twitter 和 WebApplication JSON-LD。语言路径优先于 query、存储及浏览器语言，不按爬虫 UA 另行返回内容。切换语言保留当前 hash 页面、查询参数、TanStack history state 和草稿。
- `/about/zh/`、`/about/en/`、`/about/ru/`：无需 JavaScript 的完整功能说明，包含六类工具、实际操作步骤、FAQ、来源与语言支持说明。
- `/about/{zh|en|ru}/{stats|research|maps|account-value|lineups|sales}/`：18 个功能说明页，提供各自标题、摘要、相关操作步骤与实际工具入口；语言切换保持当前功能对应关系。
- 所有语言组均有自引用 canonical、双向 hreflang、`x-default`、对应 `lang` 与 JSON-LD `inLanguage`，可见链接连接应用、介绍与功能页。应用仍使用 hash 管理工具状态，不将用户战绩结果或私有草稿生成索引页。
- `/sitemap.xml`：列出 25 个真实 URL，不包含查询串、hash、用户查询结果或私人方案。静态说明页仅使用正文实际修订日期作为 `lastmod`；应用入口不伪造每日更新时间。
- `/robots.txt`：允许公开页抓取并声明 sitemap。未知 URL 返回真正 404，404 页设置 noindex；Render 预览所有页面 noindex。robots 不代替认证或授权。
- `/llms.txt` 与所有说明页的 `index.md`：更新三语应用与功能入口、数据来源和限制。不暴露写入接口、用户查询、凭据或内部实现。`llms.txt` 是辅助约定，不是搜索排名保证或 agent 授权协议。
- `pnpm run build` 的 SEO 检查遍历全部 25 页：核对语言、首屏、唯一 title/canonical、互链、资源真实存在、结构化数据、Markdown、sitemap、404 与部署限定统计。不使用浏览器自动化。

固定语言页与中立入口使用同一 origin，本地研发进度、购物车、队列、地图方案及会话不迁移、不清理。受浏览器拦截而改用整页登录时，前端沿用既有根路径回调并在成功后恢复语言路径；服务端白名单没有放宽。

覆盖关键词：战雷工作台、战雷战绩查询、战雷科技树、战雷走线、战雷账号价值；英文包含 War Thunder Workbench / player stats lookup / tech trees / map routes / account value；俄文包含 статистика игроков / дерево исследования / маршруты на картах / оценка стоимости аккаунта。

### Google 与百度正式收录

上线后分别在 Google Search Console 和百度搜索资源平台验证站点所有权、提交主站 sitemap、检查抓取与索引状态。域名 DNS 验证或平台验证文件需要站长权限及平台提供的真实值；本次没有伪造验证代码，也没有宣称完成账号侧提交。若采用 HTML 验证，可在构建环境设置 `WT_GOOGLE_SITE_VERIFICATION`、`WT_BAIDU_SITE_VERIFICATION`，生成对应首页 meta 标签，再部署。验证值本身不是登录凭据。

建议在 Search Console 依次检查首页、三个固定语言入口及三个介绍页，确认实际抓取正文、Google 选择的 canonical 与索引状态；随后抽查六种功能页，并按页面/国家/查询词观察搜索曝光与点击。实时抓取成功不等于已经编入索引，`site:` 搜索不代替站长平台报告。百度同样先验证站点、提交 sitemap 并查看抓取与索引反馈，不自动批量提交或反复请求收录。

三语静态正文比只靠客户端片段路由更可控。SEO 配置和可抓取不等于已收录，更不能保证具体关键词排名。请用各平台实际抓取/索引报告验收；本任务没有使用浏览器自动化或批量提交工具。

### QMuse 站点可否做 SEO？

2026-10-22 对线上地址的实际 HTTP 检查：

- 主页面 HTTP 200，没有观察到 `X-Robots-Tag: noindex`；原始 HTML 没有 iframe，因此不能说“嵌入 iframe 导致完全不能收录”。
- 平台返回的标题是“战争雷霆研发科技树”，description 是 `QMuse Generated Project`，正文只有空 `#root`。平台替换了源码的 HTML head 和启动页，不能把本地 `index.html` 的 SEO 标签视作 QMuse 已生效。
- 域名根 `/robots.txt` 返回 HTTP 400 `Invalid app URL`。项目无权改变 `render.qmuse.pub` 的根 robots、站点地图、响应头或 DNS 所有权。

所以 **可做有限的基础 SEO，但不适合作为本项目可完全控制的多语言 SEO 主站**。`deploy:qmuse` 的 CLI title 参数提供明确的应用标题；React 启动后补齐当前功能标题、description、canonical、OG 与 JSON-LD，并在 QMuse origin 上使用 QMuse 自己的规范 URL。能够执行 JavaScript 的抓取器可能读取这些元信息；只看初始 HTML 的抓取器和社交预览仍受平台模板限制，百度和 AI 搜索也不能保证执行应用脚本。要实现完整平台侧 SEO，需要 QMuse 支持把自定义 head/正文输出到首次 HTTP 响应，并提供应用级收录与站点验证能力。

未在该域名宣称存在项目可控的 sitemap 或 llms.txt，也没有给 QMuse hash 路由制造虚假的独立收录地址。自有域名介绍页同时保留 QMuse 入口链接。

## 本轮补充：说明内容与 CF 站点分析

### 已补充的三语说明

三份静态介绍页及对应 Markdown 均增加：

- 四组具体操作步骤：战绩查询、研发规划、地图走线、账号估值。覆盖玩家准备做的事情，并链接到实际功能。
- 六组常见问题：游戏密码、未出战载具、缓存延迟、共享前置去重、估值组成、不同域名的本地资料迁移。
- 数据来源入口、未知值处理方式、报价与资料核验时间的含义。说明日期是文案核对日期，不冒充所有游戏资料的刷新日期。
- 页面层级结构化数据和 Markdown alternate 链接。FAQ 用可直接读取的 HTML 展示，不承诺获得搜索结果富摘要。

后续内容优先级：

1. 为战绩、科技树、地图走线、估值分别制作有足够正文的独立教程页，加入真实操作截图和示例。每篇回答独立问题后再加入 sitemap，不批量生成仅替换关键词的空页面。
2. 公开数据来源与更新说明页、账号与额度说明页、隐私与本地保存说明页。额度和费用引用当时真实配置，避免写死无法维持的数字；不公开后端或研究材料。
3. 给地图攻略和具体功能说明维护实际修订记录、适用版本与已知限制。正文真正修订后才更改 `dateModified` / sitemap `lastmod`，不随每次构建刷新。
4. 在 Google Search Console、百度搜索资源平台上线验证后，根据实际展示词、点击和抓取异常补充内容。Web Analytics 不提供完整搜索关键词排名报告，不能替代站长平台。

### Cloudflare Web Analytics 接入

采用 Cloudflare 官方 Web Analytics beacon。使用 `wt.mrtreasure.cc` 专属、手动安装的 Web Analytics 站点；后台 **战雷工具 → 页面分析** 以该站点 siteTag 直接打开对应统计，不再进入账户级总览。

- `data/site-analytics.json` 只存浏览器可公开使用的 beacon token 和域名配置，**不是 Cloudflare API token**，不含任何管理凭据。
- `deploy:cf` 明确设置 `WT_DEPLOY_TARGET=cf`，构建才会向首页、三语说明页和 404 页写入加载器。普通构建、预览构建及 `deploy:qmuse` 均排除此加载器；QMuse 命令显式覆盖目标，避免继承 shell 中的 CF 目标。
- 运行时再次要求 origin 精确等于 `https://wt.mrtreasure.cc`。即使 CF 构建被复制到预览或 QMuse，也不会由此加载 Cloudflare beacon。
- 正式站 HTML 添加 `Cache-Control: no-transform`，避免区域级自动注入覆盖专属统计。加载器仍会在解析完 HTML 后检查现有 beacon，防止重复加载。不修改其他域名的区域统计设置。
- 手动加载使用官方 `https://static.cloudflareinsights.com/beacon.min.js`，相应 CSP 脚本和上报域名沿用 CF 部署配置。
- 不添加昵称、UID、邮箱、查询记录或估值结果的自定义事件，不改写 URL 来制造虚假的页面浏览。Hash 路由不是独立的搜索收录页，CF 的标准统计也不能据此提供完整的功能访问拆分。普通页面和静态三语页仍可查看访问与页面性能。
- 阻止 beacon 或关闭 JavaScript 不影响静态说明正文。页面性能报告依赖真实访问产生的 RUM 数据，尚未部署的构建不会立即出现在面板里。

参考：[官方接入说明](https://developers.cloudflare.com/web-analytics/get-started/)、[Web Analytics 与 SPA](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)、[数据采集说明](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)。

## 部署边界速查

| 命令 | 正式/预览地址 | 部署形态 | 新增统计 |
| --- | --- | --- | --- |
| `deploy:cf` | `https://wt.mrtreasure.cc/` | 独立 Workers Static Assets、自定义域名 | wt 专属 |
| `deploy:preview` | `https://render.mrtreasure.cc/war-thunder-trees/` | 既有 Render 预览同步、noindex | 无 |
| `deploy:qmuse` | `https://render.qmuse.pub/p/muse/8645013411493394` | 原有 QMuse 应用 | 无 |

CF 上传 staging、配置、历史哈希资源位于运行目录，不将源码、凭据或研究文件上传。Wrangler 管理凭据由已授权运行环境提供，密码本索引为 `cloudflare.api_token_worker` 和 `cloudflare.account_id`。
