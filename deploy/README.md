# 发布说明

## 2026-10-31 图片缓存模式审查

已补齐 `public/wt-image-cache-sw.js` 的请求模式隔离，并升级图片缓存为 v3：
普通图片的 opaque 响应仍可用于 `no-cors` 图片；CORS 图片请求遇到旧 opaque
条目会移除后重取。进行中的下载按 URL 与请求模式分别合并，防止并发时混用。
公开图片白名单、匿名请求、缓存数量/TTL、离线回退和业务存储隔离保持原样。
现有 `check:image-cache` 已增加命中 opaque 缓存与并发混合模式的回归并通过。

2026-10-31 老大已明确授权国际站上线；仅发布图片缓存脚本，多语言 HTML、
页面资源和数据保持原样。Cloudflare 确认仅上传 1 个文件，新版本
`dfdf0b8e-e026-4a28-806c-65ecd011dad5` 承接 100% 流量。
中文与多语言工作区的脚本、现有国际站发布输入已同步。公开 HTTP 校验结果
见下方私有操作记录；不以 API 发布成功代替浏览器验收。
盘点与发布状态记录在 NAS 私有
`/vol1/1000/appdata/cloudflare-sites/operations/frontend-cache-audit-20261031/`。

维护日期：2026-10-29。静态页面由 Cloudflare 或既有 QMuse 应用提供；NAS 目录仅作发布输入，不是公开站点。

## 目标与授权

| 目标 | 地址 | 命令与边界 |
| --- | --- | --- |
| 独立预览 | `https://render.mrtreasure.cc/war-thunder-trees/` | `pnpm run deploy:preview`；代码检查后交用户人工确认 |
| QMuse 正式站 | `https://wt.app.qmuse.pub/` | `pnpm run deploy:qmuse`；预览确认并明确授权后更新既有应用 |
| 国际站 | `https://wt.mrtreasure.cc/` | `pnpm run deploy:cf`；仅在多语言工作区、获授权后发布 |

Render 的 `/muse/*` 与 `/_muse-index/*` 已停用并返回 404，不提供兼容跳转。主站使用独立域名，平台绑定的 QMuse 应用保持原样。

国际站 Worker 保持 `war-thunder-workbench` 原名。预览使用既有共享 Render Worker，不新建部署项目；不能用中文主分支覆盖国际站的英／俄／日内容。

## 检查与预览

```sh
pnpm run check
pnpm run build

# 仅检查和构建，不上传
pnpm run deploy:preview --dry-run

# 发布独立预览；命令自身也运行检查与构建
pnpm run deploy:preview
```

`check` 包含类型、lint、数据、地图编辑器、走线、平台启动与图片缓存检查。预览命令启用独立地图 API 和 CSV 预览资料，不切换正式资料索引或后端现行数据。

发布完成后立即给用户预览链接。默认不运行视觉检查、浏览器截图或全量边缘校验；预览发布脚本已关闭全量边缘校验。界面由用户人工确认，仅明确要求时另做浏览器检查。保留必需的资源、鉴权与凭据隔离检查。

## 正式发布

QMuse 仅更新原绑定应用，`.qmuse/project.json` 由 CLI 管理。`import:qmuse` 只导入，不等于公开部署；`deploy:qmuse` 包含导入、平台发布与状态核对。没有预览确认和正式发布授权时，两者都不执行。

国际站命令要求多语言工作区，使用 wt 域名的 canonical 和专属统计。范围与配置见 [SEO 与站点分析](../docs/deployment-seo.md)。

```sh
# 以下 dry-run 不发布；同样须满足对应工作区与本地绑定条件
pnpm run deploy:qmuse --dry-run
pnpm run deploy:cf --dry-run
```

`pnpm run publish` 和 `release` 是维护环境的底层步骤，单独运行不表示 Cloudflare 已上线；日常预览使用完整的 `deploy:preview`。

## 资源与恢复

1. 只上传允许的构建产物，先上传不可变资源，再切换 HTML；源码、凭据、后端、原始资料与研究目录不进入静态上传。
2. HTML 使用 no-store 或重新验证，哈希 JS／CSS／字体／国家资源使用不可变缓存。旧静态哈希保留给已打开页面；退休评分 WASM 和旧载具格式按专门清理规则处理。
3. 图片提交和文件必须实际存在，再更新资料指针。发布页与资料发布是独立操作，采集完成不自动发布。
4. 失败时读回真实发布状态，按 Git 版本恢复需要的入口；不能把上传成功写作用户验收通过。完成后清理临时构建副本与回滚包，保留必要检查记录。
5. 后端属于独立私有服务；前端发布不附带后端提交、上传或数据库切换。

## 目录中的历史配置

`nginx-*.inc`、`nginx-render-timing.conf` 是旧 NAS 静态站配置样本，保留供本地历史排查，不是现行 Cloudflare 发布输入。不要按旧文档安装 include、重载 Nginx 或恢复已停用的公开路由。当前边缘响应头由 Cloudflare 发布配置管理，`cloudflare-headers.txt` 为项目规则样本。

完整约束见 [AGENTS.md](../AGENTS.md)，维护入口见 [文档索引](../docs/README.md)。
