# SEO 与站点分析

部署目标、授权、命令和资源顺序统一见[发布说明](../deploy/README.md)。本文只记录搜索收录和统计配置，避免重复维护发布流程。

## 站点边界

- 国际站为 `https://wt.mrtreasure.cc/`，拥有独立 Workers Static Assets、canonical、多语言说明和统计配置。必须在多语言工作区构建，不以中文 main 覆盖。
- QMuse 正式站是既有平台应用；只能控制应用提供的内容，不能宣称可修改平台域名根的 robots、DNS 或 sitemap。
- Render 为独立验收预览，使用 `noindex`。已停用的 Render 旧路径不提供 SEO 兼容跳转。
- 只上传静态产物，不包含后端、凭据、原始资料 JSON、研究报告或测试玩家样本。

## 可抓取正文

国际站构建生成英、俄、日静态介绍及 Markdown，包含战绩、研发规划、地图、参考价值的操作说明、常见问题和来源入口。首页及介绍页维护 title、description、canonical、OG 与结构化资料；sitemap、robots 和 llms 文本来自同一构建。

Hash 功能路由不是独立收录页，不能用多个片段 URL 冒充多个已收录页面。后续独立教程必须有实际正文和适用范围后再加入 sitemap，不批量生成只替换关键词的空页。

文案修订日期、sitemap 的内容更新时间与游戏资料核验时间分别维护；不能每次构建都伪装内容更新。跨域本地数据不会自动迁移，登录云端状态与本地地图方案须按各自保存方式说明。

## QMuse 的限制

平台可能替换本地 HTML head 和启动页。本地构建存在 SEO 标签不等于 QMuse 首次 HTTP 响应已经包含它们；运行时补充的标签也不能保证所有抓取器或社交预览都执行 JavaScript。

QMuse 部署只更新现有应用。不得给平台域名制造不存在的 sitemap 或验证地址，也不声称已经完成平台根域站点验证。

## Cloudflare Web Analytics

国际站使用 wt 域名专属的官方 Web Analytics beacon，后台「页面分析」指向该站统计。

- `data/site-analytics.json` 仅保存可公开的浏览器 beacon 标识和域名配置，不是管理 API token。
- `WT_DEPLOY_TARGET=cf` 才在构建中加入统计加载器；QMuse 和预览构建排除它，运行时还要求精确的 wt origin。
- 保留统计脚本与上报域名的 CSP，仅统计普通页面访问和性能，不发送昵称、UID、邮箱、查询内容或估值结果等自定义事件。
- 不重复注入 beacon；阻止统计脚本不影响应用功能或静态介绍。
- 标准 Web Analytics 不等同于搜索关键词排名报告，也不能把 Hash 切页直接解释成完整功能访问统计。

说明来源：[Web Analytics 接入](https://developers.cloudflare.com/web-analytics/get-started/)、[SPA](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)、[采集范围](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)。

## 搜索站点验证

Google Search Console、百度搜索资源平台需要站长账号完成真实所有权验证及 sitemap 提交。若平台采用 HTML meta 验证，可由维护环境注入 `WT_GOOGLE_SITE_VERIFICATION`、`WT_BAIDU_SITE_VERIFICATION` 后构建，不伪造验证值。

页面可抓取、配置完整、部署成功与已被搜索引擎收录是不同状态。本次文档维护没有联网核对收录、提交站长验证或发布任何站点；实际结果以对应平台报告为准。
