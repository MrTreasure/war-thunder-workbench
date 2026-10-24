# 战雷工作台 · 黑盒工坊

独立的小程序构建，保留载具研发、配件研发、战绩查询、参考估值和个人战报。网页正式站和国际站的绑定保持独立。

## 开发

在仓库根目录安装：`pnpm install --frozen-lockfile`。

```sh
pnpm --dir apps/war-thunder-heybox run dev
pnpm --dir apps/war-thunder-heybox run typecheck
pnpm --dir apps/war-thunder-heybox run build
```

远端项目已经绑定，不重复创建。SDK 固定为 0.9.3，目标为 Android / iOS，游戏绑定为 PC《战争雷霆》。网络仅申请自有域名 `api.mrtreasure.cc`；权限审批不阻塞本地开发；远端版本的网络调用需要平台批准。

## 账号接入

- 小程序通过官方 `auth.login()` 获取一次性授权码，仅交给自有服务换取工作台会话。服务端密钥不进入项目、构建包或日志。
- 已有账号从网页登录后主动关联；网页授权码由小程序确认。新身份须明确选择创建账号，不按昵称自动合并。
- 本地会话同时保存 `accountKey`，启动、返回前台和切号时核对；确认前不展示旧账号资料，不使用 Host Cookie 恢复身份。
- 接口请求仅使用 SDK 的网络能力，不自动重试写请求。长查询使用现有任务接口，不在客户端计算作战效率。

## 当前进度

首版移动界面已整合研发、战绩和账号三个入口，研发画布复用主分支；估值和战报从战绩进入。图标和封面由既有官方素材裁切合成，来源见 `data/heybox-branding.json`。计算包不包含 WASM；作战效率只展示服务端结果。

本地手机调试要求同一局域网。异地验收使用官方远端版本预览：`hb-sdk remote deploy --release-note "移动端预览"` 上传并提审，默认不自动发布；通过 `hb-sdk remote preview 0.1.0` 取得当前版本预览信息。预览权限按平台白名单控制。网络权限尚未批准时，远端版本的登录、战绩等接口以及外部图片可能不可用，不能将本地临时权限当作线上批准。

构建门禁验证十个国家的懒加载文件、哈希、无独立数据 JSON 和无 WASM。界面及真实小黑盒授权仍需人工真机验收，浏览器模拟不代表真机通过。

文档：[SDK](https://docs.xiaoheihe.cn/hb_sdk/)、[登录](https://docs.xiaoheihe.cn/hb_sdk/guide/auth)、[CLI](https://docs.xiaoheihe.cn/hb_sdk/guide/cli)。
