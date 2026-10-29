# GitHub 仓库与 jsDelivr 限制

核对日期：2026-10-29。本页区分 Git 仓库存储、GitHub 建议、jsDelivr 单文件读取、包目录和整仓回退。不要仅凭一次 403 报错判断全部静态资源不可用。

## 已确认的限制口径

| 场景                             | 正确解释                                                                                      | 一手依据                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub 仓库约 1 GB               | GitHub 建议理想仓库小于 1 GB、强烈建议小于 5 GB；这不是 jsDelivr 的 1 GB 流量或资源额度       | [GitHub 仓库大小说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github#repository-size-limits) |
| GitHub 普通 Git 单文件           | 超过 50 MiB 会警告，超过 100 MiB 会阻止；浏览器上传另有 25 MiB 限制。这些均不是仓库总大小限制 | [GitHub 单文件限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github#file-size-limits)         |
| jsDelivr 正常读取 GitHub 单文件  | 不适用「仓库总大小 50 MB」阈值；大仓库中的明确文件路径仍可正常读取                            | [维护者 2023-12-06 解释](https://github.com/jsdelivr/jsdelivr/issues/18544#issuecomment-1842631796)                                                       |
| jsDelivr GitHub 包目录／文件列表 | 有 50 MB 包大小限制，可返回 403；目录 API 失败不证明单文件都失败                              | [官方 API 文档](https://github.com/jsdelivr/data.jsdelivr.com#restrictions)                                                                               |
| 单文件读取失败后的整仓回退       | jsDelivr 可能转为下载整个仓库，此时 50 MB 限制可能导致文件请求也报错                          | [维护者 2026-10-16 解释](https://github.com/jsdelivr/jsdelivr/issues/18755#issuecomment-6213681269)                                                       |
| npm 包                           | 维护者明确将 150 MB 与 npm 区分，不应将该数字直接套到所有 GitHub 请求                         | [维护者解释](https://github.com/jsdelivr/jsdelivr/issues/18544#issuecomment-1842631796)                                                                   |
| jsDelivr 获取 GitHub 单个文件    | 主 README 另有默认 20 MB 单文件限制；它不是 GitHub 自身的单文件限制，也不是仓库总大小限制     | [jsDelivr Restrictions](https://github.com/jsdelivr/jsdelivr#restrictions)                                                                                |

主 README 对包大小的概述和 Data API 文档存在口径差异，需结合维护者对具体读取路径的解释。不能把它们简化成「GitHub 仓库上限统一是 50 MB／150 MB／1 GB」。

## 为什么同一个文件会先失败、后来成功

正常路径是 jsDelivr 读取 GitHub 单个文件。维护者说明，单文件端点读取异常时，会尝试通过另一个 GitHub 服务取得整仓 tarball；整仓过大则回退失败，向调用方返回 package size 错误。

单文件不存在也可能触发该回退。[2023 年维护者补充](https://github.com/jsdelivr/jsdelivr/issues/18544#issuecomment-1842636445)。历史案例中，连接超时也曾导致类似问题，但这不能证明本项目某次失败的具体原因。[历史排查记录](https://github.com/jsdelivr/jsdelivr/issues/18393#issuecomment-1120190332)。

所以，下面两种判断都不准确：

- 仓库一旦超过 50 MB，所有 CDN 文件就必然不可用。
- 50 MB 只影响目录 API，永远不会影响文件请求。

缓存命中有助于成功读取，但「大仓库单文件可用」本身就是受支持的读取方式，不能仅解释成旧缓存的特殊现象。外部响应头不能证明 CDN 内部究竟在哪一步失败，应把推断与已核实事实分开。

## 本项目的定点验证

2026-10-29 已核对：

| 资源                                                                                            | 结果                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 生产提交 `2c9461fa1de6867f446acdfa250d90a46ff3a6ac` 的 `war-thunder/catalog/manifest.js`        | HTTP 200，37,960 字节，SHA-256 与生产指针一致                                                                                   |
| 首次报错提交 `0d4db8615ef11b4c3cd493181afeba67ce2a93f1` 的同一索引地址                          | 后续 HTTP 200，67,140 字节，SHA-256 与该提交产物一致；该索引另因超出现有前端 64 KiB 协议上限而被后续精简，这与 CDN 仓库限制无关 |
| `data.jsdelivr.com/v1/package/gh/MrTreasure/oss-files@2c9461fa1de6867f446acdfa250d90a46ff3a6ac` | HTTP 403，返回 50 MB package 大小提示                                                                                           |

对应提交的图床 tree 文件内容合计约 408 MB，其中地图约 360 MB、载具目录约 19 MB。这个合计不包含 Git 历史对象，不等于 `.git` 的磁盘占用，也不等于 HTTP 压缩后的流量或整仓回退实际处理的 archive 大小。

## 项目处理原则

1. 固定完整提交 ID、明确文件路径和内容哈希，不依赖目录 API 判断资源是否存在。
2. 发布前核对目标文件和索引，先上传数据，再切换服务端版本指针。文件的字节数、SHA-256、国家和 schema 必须一致。
3. 保留现有 CDN → GitHub raw 回退及已验证的本地缓存。两条远端路径都依赖 GitHub，不能称为完全独立的容灾来源。
4. HTTP 200 不代表内容正确；哈希不一致的数据不能发布或进入可信缓存。
5. 地图压缩以传输体积、解码成本、放大效果和导出需求评估。不能以「仓库超过 50 MB 必须失效」为压缩或迁移的依据。
6. R2 或独立资源托管可按稳定性、缓存控制和维护成本评估，不因上述数字直接自动拆仓、迁移、删除原件或更改线上地址。

本页只修正维护判断，不修改生产资源和调度，不触发前端部署。
