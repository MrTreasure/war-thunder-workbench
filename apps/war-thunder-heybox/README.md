# 战雷工作台 · 黑盒工坊

独立的小程序构建，保留载具研发、配件研发、战绩查询、参考估值和个人战报。网页正式站和国际站的绑定保持独立。

## 开发

在仓库根目录安装：`pnpm install --frozen-lockfile`。

```sh
pnpm --dir apps/war-thunder-heybox run dev
pnpm --dir apps/war-thunder-heybox run typecheck
pnpm --dir apps/war-thunder-heybox run build
```

远端项目已经绑定，不重复创建。SDK 固定为 0.9.3，目标为 Android / iOS，游戏绑定为 PC《战争雷霆》。网络仅申请自有域名 `api.mrtreasure.cc`；权限审批不阻塞本地开发，但真机网络验收需要审批通过。

## 账号接入

- 小程序通过官方 `auth.login()` 获取一次性授权码，仅交给自有服务换取工作台会话。服务端密钥不进入项目、构建包或日志。
- 已有账号从网页登录后主动关联；网页授权码由小程序确认。新身份须明确选择创建账号，不按昵称自动合并。
- 本地会话同时保存 `accountKey`，启动、返回前台和切号时核对；确认前不展示旧账号资料，不使用 Host Cookie 恢复身份。
- 接口请求仅使用 SDK 的网络能力，不自动重试写请求。长查询使用现有任务接口，不在客户端计算作战效率。

## 当前进度

已接入账号与网络适配代码；移动界面及模块整合仍在开发。模板图标与封面是占位资源，尚未作为可发布版本提交。浏览器模拟不代表真机授权、网络、分享或文件能力已经验收。

文档：[SDK](https://docs.xiaoheihe.cn/hb_sdk/)、[登录](https://docs.xiaoheihe.cn/hb_sdk/guide/auth)、[CLI](https://docs.xiaoheihe.cn/hb_sdk/guide/cli)。
