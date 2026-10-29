# 科技树独立设计原型

这是保留的独立设计工具，不是当前工作台入口或正式视觉规范；现行组件规则见[style.md](../../style.md)，交付流程见[发布说明](../../deploy/README.md)。原型中的拥有状态仅用于演示。

按用户游戏截图制作的独立静态原型。使用现有 canonical 载具数据、官方原始载具图片及货币／护身符／黑桃素材。`data/research-tree-preview.json` 记录参考布局、拥有状态示例及素材来源。

运行 `node scripts/prepare-data.mjs` 后执行 `node scripts/build-tree-preview.mjs`，页面与带哈希的 CSS、JS、同源字体写入忽略目录 `artifacts/tree-design-preview/site/`。

支持低阶／现代区域、缩放、载具组展开，以及点击卡片切换拥有状态示例。状态仅保留当前页面内存，不读取登录、不修改真实车库或研发进度。礼包金额来自已核对的整包 CNY 记录；没有凭据的市场报价不补造。

这是视觉预览，不接入正式科技树路由。图片沿用官方 HTTPS 来源；没有生成图片或使用图片替代网页内容。UI 视觉验收由用户打开页面确认。
