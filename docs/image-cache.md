# 国际站公共图片缓存

主分支统一维护 Service Worker。仅生产模式、页面源为 `https://wt.mrtreasure.cc` 时注册 `/wt-image-cache-sw.js`；QMuse、独立 Render 预览及本地开发不注册。原始官方图片 URL 保持不变，无图片代理或转存。

## 范围与策略

- 只接管 GET 图片请求，且路径必须在官方 CDN 的公开范围内：`static.encyclopedia.warthunder.com/gui_skin/`、`/images/`、`/slots/`，以及 `staticfiles.warthunder.com/upload/image/0_Wallpaper_Renders/`。
- 请求带查询参数、Authorization、Range、显式 no-store/reload 时不接管；HTML、脚本、API、账号资料、Canvas 的显式 fetch 和地图文件保留现有规则。
- 请求使用匿名凭据，不跟随重定向。首次打开按需下载，命中后直接返回 CacheStorage 中的图片。可读图片七天后、opaque 图片一天后，在继续显示已缓存图片的同时后台更新；离线时保留旧图。
- 图标最多 48 项，载具／勋章图片最多 96 项，壁纸最多 2 项；按最近访问时间淘汰。所有分组的 opaque 响应合计最多 40 项，因为浏览器对不可读跨域响应可能计入明显高于实际图片大小的配额。限制为条目数，不将不可读响应伪称为已测量字节数。
- 写入不阻塞新图片显示。存储不可用时继续普通网络加载；配额错误只淘汰本组最旧的部分图片。更新仅清理 `wt-public-images-*` 命名空间的旧缓存，永不删除载具 IndexedDB、购物车、档案、队列、地图计划或其他 CacheStorage。
- 不预下载整国图片。首次注册在页面 load 后进行，激活后接管后续图片请求，不强制刷新页面。Service Worker 入口必须 revalidate，哈希 JS／CSS 继续沿用既有 immutable HTTP 缓存。

## 检查与发布

`pnpm run check:image-cache` 是离线行为检查，覆盖域名开关、请求范围、并发下载合并、缓存命中、过期离线读取、条目限额及配额失败；不做浏览器或视觉验收。随后运行项目现有 check／build，从保留四种语言的国际站工作区发布。

API 依据：[Service Worker 注册的同源要求](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)、[Cache.put 支持 opaque 响应](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put)。opaque 响应不暴露 HTTP 状态或响应头，因此无法与可读响应同样验证状态；短有效期和独立条目上限用于约束它。
