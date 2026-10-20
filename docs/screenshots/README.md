# README 截图

截图来自实际线上应用：https://render.qmuse.pub/p/muse/8645013411493394

- 截图日期：2026-10-20；应用数据核对日期：2026-10-19。
- 工具：Playwright CLI + Chromium，无界面截图。
- 独立浏览器上下文；首页在选择国家前截图。
- 载具、配件面板与五组队列均通过页面操作配置，队列按“保存队列”保存后再拍列表。
- 首页、科技树、研发与列表为 1600 × 1000；队列配置为 1600 × 1300。
- 原始截图未合成或改写画面内容；图片、国旗及 Logo 从页面原始官方 HTTPS 链接加载。
- 演示进度和单价仅用于说明计算方式，队列不是最优搭配建议。
- 五组队列的车辆 ID、RB 和分享码见 [示例数据](../examples/lineups.json)。
- [manifest.json](manifest.json) 记录各截图尺寸、字节数与 SHA256。

| 文件 | 内容 |
| --- | --- |
| `home.png` | 尚未选择国家的首次访问首页 |
| `tree.png` | 中国陆军 RB 科技树，90% 缩放 |
| `vehicle-detail.png` | ZTZ99A 详情、图片、Wiki 标题链接与两个研发入口 |
| `vehicle-rank-viii.png` / `vehicle-rank-vii.png` | 同一目标在 VIII / VII 计价起点的不同结果 |
| `vehicle-filters.png` | 搜索 ZTZ、Rank VII、常规研发与补研策略 |
| `modifications.png` | 已完成两个配件，另投入 5,000 RP |
| `lineup-china-117.png` | 中国 11.7 配置，含常规 / 礼包 / 联队载具 |
| `lineup-germany-57.png` / `lineup-germany-67.png` | 德国 5.7 / 6.7 配置 |
| `lineup-usa-70.png` / `lineup-usa-top.png` | 美国 7.0 / 顶级房 12.7 配置 |
| `lineups-china.png` / `lineups-germany.png` / `lineups-usa.png` | 已保存队列列表 |
| `lineup-share.png` | 美国顶级队列分享弹窗 |
| `cart.png` | 载具与配件两项报价合并 |
