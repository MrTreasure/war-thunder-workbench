# 小程序权限与功能核对

核对日期：2026-10-25；SDK：0.9.3。来源为官方最新权限目录及各 API Reference，并对照现有页面、共用组件与平台只读权限状态。

| 功能 | 实际调用 | 权限 | 当前状态 |
| --- | --- | --- | --- |
| 小黑盒登录、授权头像 | auth.login、user.getInfo | userInfo | 已声明，无单独平台审批 |
| 自有业务 API | network.request | network | 已声明，平台已批准，useOfficialDomain=false；业务仍只走 CF API |
| 会话、匿名设备、研发草稿 | storage.getStorage/setStorage | storage | 已声明，无单独平台审批 |
| 复制主站地址 | device.setClipboard | clipboard | 本地已补声明及 SDK 调用，无单独平台审批；只在用户点击后写入 |
| 登录状态、窗口与安全区域 | auth.getAccountState、viewport.getWindowInfo/setNavigationBarStyle | 无额外权限 | 官方 Reference 确认无需额外声明 |

## 保持未声明的能力

- share：当前没有小程序链接分享、社区分享或 SDK 截图入口。战报目前为页面内文本展示，不代表已经接入截图、导出或保存图片。
- filesystem、media：当前没有选取文件、相册、上传或原生文件保存入口；头像不允许上传。
- steamLibrary：当前不读取 Steam 游戏库，游戏绑定使用战雷 UID。
- leaderboard、cloud_storage：当前不调用小黑盒排行榜或云端存储；本站数据使用已有服务。
- companion、workspaceCards：当前目标仅 Android/iOS，没有桌面程序或 PC 游戏工作区卡片。
- appProtocol：没有调用，不将任意协议执行作为打开主站的替代能力。

出击队列目前仍在网页主站，小程序没有队列分享码复制入口。以后接入此入口时，分享码是普通业务文本，使用 clipboard/device.setClipboard；不因为文本称为“分享码”而额外声明 share。

## 验证与审核边界

- 构建检查当前使用的 userInfo/network/storage/clipboard 均进入 Manifest，禁止主站复制入口回退到原生应用中的浏览器 Clipboard API。
- 原生小程序通过 SDK Host 剪贴板调用；独立静态浏览器预览通过专用适配器使用浏览器剪贴板，不混入正式包。
- 官方 SDK Browser Mock 已完成点击“复制主站地址”与系统剪贴板读回一致性检查；这不证明真机 Host 已通过验收。
- 平台 permission list 的 declared/effective 基于当前本地项目与审批结果，不能用它声称旧审核快照已经新增 clipboard。
- 用户要求本轮不重新提审。0.1.3 已提交快照仍保持原权限，本地声明与调用修复随以后明确授权的新构建提交生效。

参考：[权限目录](https://docs.xiaoheihe.cn/hb_sdk/guide/permissions)、[device.setClipboard](https://docs.xiaoheihe.cn/hb_sdk/reference/sdk/device/setClipboard)。
