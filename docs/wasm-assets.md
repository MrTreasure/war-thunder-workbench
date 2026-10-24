# WebAssembly 运行资产清单

本应用包含一个本地 WebAssembly 运行资产，用于效率分计算。以下是运行资产说明，不包含计算公式、系数、研究样本或计算实现源码。

| 项目 | 声明 |
| --- | --- |
| 本地文件 | `src/assets/player-efficiency.v3.wasm` |
| MIME | `application/wasm` |
| 版本 | `wt-efficiency-v3` |
| 文件大小 | 911 字节 |
| SHA-256 | `561ca43f4df8ea46cc2d0c83878d1d86b36f5deda466fcf97da56a44d8771147` |
| 结构化说明 | `data/player-efficiency-wasm.json` 的 `declaration` |
| 加载与执行入口 | `src/player-efficiency.ts`，`WebAssembly.instantiate` |
| 导出 | `p`，接收 16 个数值参数，返回数值 |
| 授权说明 | `src/assets/player-efficiency.v3.NOTICE.txt`，原始 NOTICE 地址见结构化清单 |

## 用途与执行边界

内部计算玩家、军种和载具共用的 0–2000 效率分，供生涯总览、载具记录、战报与导出卡片使用。输入是应用提供的公开汇总战绩，不包含账号密码、验证码或令牌。影响指标见 `docs/player-stats-efficiency.md`。

二进制没有宿主导入，不直接访问网络、登录凭据或浏览器存储。文件由 Vite 作为同源本地资产发布，浏览器加载后核对大小和 SHA-256，再显式调用 WebAssembly。OPFS 与 Cache Storage 由 TypeScript 适配器处理；历史 Git 地址仅记录资产来源，不作为远程 WASM 执行入口。

## 受保护的计算实现

效率分计算实现受独立授权保护，不适用应用的 MIT 授权。计算源码、系数、研究和编译材料不公开分发，不包含在 GitHub 或 QMuse 源码包。获授权维护者使用所有者提供的本地源码；未经授权不反编译或重建，适用法律允许的情形除外。

此说明明确声明二进制用途及执行行为，供平台正常审核，不构成审核豁免。浏览器分发的二进制不能保证绝对保密。

## 导入及构建核对

QMuse 官方 CLI 生成 `.local/qmuse-import/source-manifest-v1.json`，其中 `files` 必须列出上述本地文件的路径、大小和 SHA-256。这份官方清单由 CLI 创建，不手工替换。发布脚本在导入前复核它；构建门禁核对本地及构建后二进制、宿主导入和导出声明，且只允许一个哈希匹配的 WASM。
