# 官方版本壁纸目录

本目录只保存官方公开链接和来源证据，图片继续使用官方 HTTPS 地址。后台预览完整显示原图，原图尺寸与页面裁切位置分别处理。

## 本轮覆盖

- 核对 50 篇版本公告与官方壁纸库 4 个分页，公告日期覆盖 2016–2026 年。
- 整理 77 张图片，其中 57 张已关联版本、20 张版本待核对。
- 39 篇公告含明确壁纸下载链接；11 篇未找到明确下载链接，保留缺项。该目录不代表全部历史壁纸已收齐。
- 保留已有图片 ID、原地址、来源日期和默认顺序。历年壁纸扩展目录与现有战报导出素材分开，后台会合并供页面背景选择；不会将尚未准备导出素材的壁纸直接加入战报导出列表。

## 手动更新

运行 `pnpm run refresh:wallpapers`，只生成忽略目录 artifacts 中的候选资料。核对后运行 `pnpm run refresh:wallpapers --apply` 写入 `data/wallpaper-catalog.json` 与现有素材目录，不部署、不修改线上设置。

采集匿名、串行进行，每次请求后随机等待 6–10 秒，复用 6 小时内的完整页面。遇 403、429 或验证立即停止；保留已有成功页，后续可恢复。未创建周期同步任务。只提取页面明确列出的下载地址和分辨率，不猜测高分辨率 URL，不批量下载原图。

版本对应来自官方公告标题、公告链接，以及原图出现在该公告或明确匹配官方版本名称的文件名；元数据记录关联依据。日期是公告页面日期，不冒充已独立核实的游戏上线时间。无法确认的关联保持空值。

## 尚缺明确壁纸下载链接的公告

- [Direct Hit](https://warthunder.com/en/news/7325-news-meet-major-update-direct-hit-en)
- [Ixwa Strike](https://warthunder.com/en/news/7086-news-meet-major-update-ixwa-strike-en)
- [Hot Tracks](https://warthunder.com/en/news/6994-news-meet-major-update-hot-tracks-en)
- [New Power](https://warthunder.com/en/news/6947-news-meet-major-update-new-power-en)
- [Raining Fire](https://warthunder.com/en/news/6852-news-meet-major-update-raining-fire-en)
- [Starfighters](https://warthunder.com/en/news/6741-news-meet-major-update-starfighters-en)
- [Viking Fury](https://warthunder.com/en/news/6634-news-meet-major-update-viking-fury-en)
- [Northern wind](https://warthunder.com/en/news/6526-news-meet-update-1-95-northern-wind-en)
- [Shark Attack](https://warthunder.com/en/news/6457-meet-update-1-93-shark-attack-en)
- [Night Vision](https://warthunder.com/en/news/6373-meet-update-1-91-night-vision-en)
- [Flaming Arrows](https://warthunder.com/en/news/3763-news-update-1-59-flaming-arrows-released-en)
