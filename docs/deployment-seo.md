# SEO 与站点分析

部署目标、授权、命令和资源顺序统一见[发布说明](../deploy/README.md)。本文记录现行搜索配置与已核实的平台边界。

## 国际站

`https://wt.mrtreasure.cc/` 使用独立 Workers Static Assets，必须从多语言工作区构建。中立首页和中、英、俄、日四个应用入口提供可直接读取的首屏正文；四语总介绍与七类功能说明提供独立 HTML 和 Markdown。七类功能为战绩、研发、地图、账号估值、出击队列、折扣、模拟挂载。

国际构建生成 37 个真实 URL，包含自引用 canonical、双向 hreflang、x-default、语言与结构化资料、sitemap、robots 和 llms 文本。Hash 功能路由仅是应用状态，不伪装为独立收录页。预览使用 noindex，不计为正式收录入口。

2026-11-04 文案核对：登录后的研发计划、研发购物车、队列、挂载方案和关注列表使用账号云端工作区；游客资料和地图编辑方案仍保存在各自浏览器。地图方案可通过项目文件备份，不宣称切换域名会自动迁移本机资料。模拟挂载需登录，支持应用内大厅与机型推荐关联，暂不提供外部分享码。导弹对比最多六种；炸区估算按页面说明适用于空历常见四战区可刷新地图，未知参数不补造。

说明修订日期与游戏资料核验时间分别维护，不能随构建伪装更新。首次响应中的正文与生成的 Markdown 来自同一份 `data/site-seo.json`。

## 百度与爬虫策略

源站 robots 明确提供 `User-agent: Baiduspider` 与 `Allow: /`，并保留 sitemap。Cloudflare Bot Preference Sync 会在源站文件前注入其管理的规则，其中可能有同名 Baiduspider 的 Disallow。按 RFC 9309 §2.2.1–2.2.2，同名组应合并，等长 Allow 优先；新增明确 Allow 使百度搜索抓取可用，而不关闭 zone 级管理设置或开放其他被禁的爬虫。

维护时必须核对公网合并后的 robots，而非只看源文件。公开说明页不匹配工具入口的 AI 拦截规则；当前异常探测挑战排除 Cloudflare 已验证的机器人。搜索爬虫仍受其它安全规则约束，不因仅带百度 User-Agent 就赋予 WAF 绕过权限。抓取许可不等于搜索引擎已收录，也不等于已观察到真实百度爬虫访问。

来源：[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)、[Cloudflare 管理的 robots](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)。

## 中文主站：独立域名与 QMuse 边界

主站现为 `https://wt.app.qmuse.pub/`，仍更新既有 QMuse 应用 `8645013411493394`，不迁移绑定。运行时 canonical、OG、Twitter 与 WebApplication 资料指向这个独立域名；旧平台入口也规范到新主站。QMuse 目标的本地构建使用新域名，国际站仍使用 wt.mrtreasure.cc，两个站点不互相误标 canonical。

2026-11-04 实际 HTTP 检查：主站返回 200，首次 HTML 的 title 为“战争雷霆研发工作台”、description 为“QMuse Generated Project”，root 为空，没有 canonical。`/robots.txt`、`/sitemap.xml`、`/about/zh/` 返回平台 404。独立域名没有自动取消平台对入口 HTML 和资源路由的控制。

因此可以补齐应用启动后的基础 SEO，但完整的首次 HTML SEO、可抓取说明页、站点地图与验证文件，需要 QMuse 平台支持自定义 head／首屏正文及静态路径映射。不能把本地 dist 中的文件当成主站已经提供，也不能因独立域名就宣称 sitemap 或服务端渲染已生效。主站的运行时元信息不保证所有抓取器或社交预览执行 JavaScript。

## Cloudflare Web Analytics

国际站使用 wt 域名专属的官方 Web Analytics beacon，后台“页面分析”指向该站统计。`data/site-analytics.json` 仅保存浏览器公开标识，不是管理 API token。

仅 `WT_DEPLOY_TARGET=cf` 构建注入统计加载器，运行时要求精确 wt origin；QMuse 和预览排除它。不重复注入，不发送昵称、UID、邮箱、查询内容或估值等自定义事件。阻止统计不影响工具使用。标准 Web Analytics 不等同于搜索关键词排名或 Hash 功能页访问统计。

来源：[接入](https://developers.cloudflare.com/web-analytics/get-started/)、[SPA](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)、[采集范围](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)。

## 收录与站点验证

Google Search Console、百度搜索资源平台需要真实站长授权、所有权验证和 sitemap 提交。构建可接受真实的 `WT_GOOGLE_SITE_VERIFICATION`、`WT_BAIDU_SITE_VERIFICATION`；平台主站是否保留这些标签须另行检查首次 HTML，不能伪造验证值或制造不存在的验证路径。

页面可抓取、代码与部署通过、站长平台验证、搜索引擎收录是不同状态。公开搜索未返回有效结果时不能判断未收录；site: 也不能代替 Search Console 网址检查。本站维护脚本不自动提交或反复请求收录。
