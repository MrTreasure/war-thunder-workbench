# Nginx 预览资源缓存

`nginx-war-thunder-assets.inc` 在 `render.mrtreasure.cc` 的 server 块内引入，仅匹配 `/muse/war-thunder-trees/assets/`。

```nginx
include /etc/nginx/sites/war-thunder-assets.inc;
```

主 HTML 继续使用原有的 `no-store`，使新版本入口立即生效。带内容哈希的 JS、CSS、字体使用一年缓存；发布时保留旧文件，已打开的页面可以继续使用原版本资源。

`pnpm run publish` 为所有构建资源生成 `.gz` 文件。配置启用 `gzip_static`、`gzip_vary` 和 `gzip_proxied any`，让经过代理的请求也能使用预压缩资源。修改前备份原配置，先执行 `nginx -t`，通过后再平滑加载配置。

## 2026-10-20 核对

- 原 `/muse/` 规则把哈希资源也设为 `no-store`，导致浏览器和 CDN 无法正常复用。
- 带 `Via` 请求头时，原配置不返回压缩资源；调整后返回预压缩内容，并保留安全响应头。
- 14 个构建文件已从 Nginx 逐个读取核对；13 个资源的压缩内容解压后与构建一致，HTML 仍禁止缓存。
- 中国资料原文件 735,523 字节，预压缩传输 55,009 字节；字体由 169,352 字节压缩到 89,229 字节。
- 公网已返回 `CF-Cache-Status: HIT`，但测试中仍出现 TLS 握手和传输超时。压缩与缓存改善传输量和重复访问，不能保证跨境线路的首次加载耗时。

## 首屏脚本

四个轻量路由设置 `codeSplitGroupings: []`，让共用工作台直接进入应用入口，避免为跳转页、布局和页面适配层依次请求脚本。应用脚本从 7 个减少为 1 个，预压缩约 148 KB。

十国资料继续按选择动态加载，未选国家时不加载资料；国家文件校验、缓存和分享码规则保持兼容。仍使用 QMuse 提供的单一 Vite 插件配置。
