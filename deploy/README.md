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

## 源站耗时与文件缓存

2026-10-20 在同一预览服务启用了以下配置：

- `nginx-render-timing.conf`：在 `http` 上下文声明 JSON 日志格式，安装为 `sites/render-timing.conf`，由现有 `sites/*.conf` 加载。
- `nginx-render-observability.inc`：在 render 站点内替换原来的 `access_log` 声明。保留原日志，并增加 `render_timing.log`；两个日志都使用 32 KB 缓冲，最长 1 秒写出。
- `nginx-war-thunder-assets.inc`：仅为不可变的哈希资源缓存文件描述符与元数据，最多 512 项；60 秒校验，不缓存文件不存在等错误。HTML 不使用文件缓存。

站点中的日志声明为：

```nginx
include /etc/nginx/sites/render-observability.inc;
```

耗时日志记录状态码、实际传输字节、请求耗时、连接复用次数、压缩编码和 Cloudflare 的 `CF-Ray`。不记录查询参数、Cookie 或认证头。保留原访问日志的既有格式，已有日志处理工具仍可读取。

`request_seconds` 测量 Nginx 接收请求至向其客户端发送完响应的时间；此处客户端通常是本机隧道，不等于用户浏览器的完整下载时间。命中 CDN 缓存的请求不会到达源站，因此也不会产生新的源站记录。`gzip_static` 直接发送预压缩文件时，`gzip_ratio` 可以为空，应以传输字节和 `content_encoding` 为准。

### 本次验证

- 配置语法检查通过，使用平滑重载生效。
- 14 个构建文件从源站读取后与本地逐一比对一致，13 个资源均返回 gzip，HTML 保持 `no-store`，安全响应头仍在。
- 源站请求约 0.7～3.9 毫秒；缺失文件返回 404，未被标为不可变资源。
- 15 个核对请求均写入合法的 JSON 耗时日志，查询参数未进入新日志。
- 主脚本公网请求命中 CDN，gzip 传输 148,482 字节，TLS 建连约 3.3 秒、首字节约 3.6 秒、总耗时约 12.9 秒。IPv6 的一次请求及后续 IPv4 HTML 请求均在 TLS 握手阶段超时，尚未到达源站。
- 隧道检查时有 4 条连接，均接入洛杉矶。缓存命中的脚本传输不经过源站隧道，当前证据不足以支持更换隧道协议或强制地址族；此次保留现有隧道设置。
- 其他 Muse 页面未发现可复用同等缓存策略的哈希脚本或样式；不为可原地更新的文件设置一年不可变缓存。

这些测量来自部署机器，不能代替不同地区用户的访问结果。缓存和源站设置已经生效，公网耗时仍需结合用户地区与 CDN 链路判断。未调整 worker、连接数、内存或付费 CDN 服务。

### 回退

本次配置备份位于部署机器的 `appdata/war-thunder-trees/backups/nginx-observability-20261020-143305/`，`manifest.json` 记录哪些文件原先存在。

回退时恢复备份中的 `render.conf` 和 `war-thunder-assets.inc`，移除本次新增的 `render-timing.conf` 与 `render-observability.inc`，随后执行 `docker exec static-server nginx -t`；通过后执行 `docker exec static-server nginx -s reload`。应用静态文件无需重新发布。
