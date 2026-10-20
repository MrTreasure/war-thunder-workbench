# 陆战地图

预览入口：<https://render.mrtreasure.cc/muse/war-thunder-trees/?guides=1#/maps>。
默认页面不显示入口，只有外层查询字符串 `guides=1` 才启用陆战地图导航与路由。

## 资料和功能

2026-10-21 用户提供两份导出资料，收录 55 张陆战底图、77 张三点占领点位缩略图、309 个任务布局和 2242 个简报点位。列表可按中文、英文和关联攻略搜索；详情可切换任务布局、己方队伍、等高线、点位、布局裁切与参考网格，支持拖动、缩放和复位。地图区域可通过方向键平移、Home 复位。

缩略图由 DOM 点位图缩小至最长边 512 像素。详情保留原始无损 WebP，不从缩略图放大。底图、等高线与点位共用 0–1000 坐标，裁切只调整视窗，不改变各图层的相对位置。等高距 5 米，主等高距 25 米；高度是世界 Y 坐标，不能当作已校准海拔。等高线不包含建筑、桥梁或碰撞/通行性信息。网格来自地图文件参考参数，未与具体对局校准。点位为简报参考位置。

关联攻略保留原始作者链接和年份，仅提示同地图相关资料，不声称旧版攻略与当前任务布局完全一致。冬季地图不会自动继承普通季节攻略。旧攻略数据仍在 `data/map-atlas.json`、`data/map-collections.json`，没有删除或覆盖，也没有继续触发外部采集。

## 图片托管

使用现有 Cloudflare R2 桶 `wt-map-atlas`，公开域名 `https://wtmaps.mrtreasure.cc`，独立前缀 `ground-maps/v1/`。193 个内容哈希命名对象，包括 55 张底图、55 个等高线 SVG、77 张缩略图、6 个图标。等高线以 gzip 传输，保持原始内容；所有对象采用一年 immutable 缓存。原始 ZIP、巨大等高线坐标 JSON 和本机环境均不提交 Git，也不进入 QMuse 产物。

选择 R2 是为了避免把数百 MB 的图片加入源码仓库。R2 标准存储包含免费额度且公网流出免流量费，实际费用取决于账号总用量，参见 [R2 价格说明](https://developers.cloudflare.com/r2/pricing/)。GitHub 建议仓库保持较小，对单文件有大小限制，参见 [GitHub 文件限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

## 重新准备

在独立 Python 环境安装 Pillow 13.0.0、boto3 1.43.115、PyYAML 6.0.3，然后执行：

```sh
python scripts/prepare-ground-maps.py '<解压后的战雷陆战地图目录>' '<解压后的缩略图目录>'
# 确需上传时追加 --upload；现有对象以内容哈希核对后跳过。
```

上传脚本从本机密码本 `cloudflare.r2_admin` 读取凭据，不将密钥写入工程。只上传 `ground-maps/v1/` 下的新内容，不删除既有图床文件。规范数据在 `data/ground-maps.json`，构建后仅由隐藏页面的懒加载 JS 携带，不发布独立 JSON。

常规 `pnpm run check` 会检查地图数量、布局、坐标投影、缩略图关联及资源哈希；`pnpm run build` 保持原有国家数据与禁止独立 JSON 的检查。预览通过现有 `pnpm run publish` 发布，QMuse 仍等待用户确认预览。

## 本次验收记录

- `pnpm run check`、`pnpm run build` 与构建产物检查全部通过；独立 JSON 发布数为 0。
- 193 个 R2 图片公网地址全部返回成功；底图与等高线在实际地图详情正常叠加。
- 公网预览返回 200，内容与当前构建一致，HTML 为 `no-store`；公网浏览器可显示全部 77 个卡片。
- 320 / 375 / 414 / 768 像素列表无横向溢出，375 像素详情按钮与关闭入口可用；桌面详情保持居中。
- 隐藏开关关闭时不加载地图模块；地图页面不加载国家载具数据。
- 等高线 gzip 对象合计约 78.1 MiB，原始约 224.5 MiB；实际传输取决于浏览器协商与边缘缓存。
