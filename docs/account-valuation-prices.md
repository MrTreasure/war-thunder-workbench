# 账户估值历史价格

2026-11-06 核对。`data/account-valuation-price-references.json` 保存估值专用历史价格和整车交易所关联；不修改科技树的当前销售资格。`scripts/prepare-account-valuation.mjs` 生成后端目录时应用这些参考项，后续已核实的现行目录售价优先。管理员已有自定义定价仍优先于目录。

## 历史金鹰售价

| 载具 | GE | 来源 |
| --- | ---: | --- |
| 零战五二型甲 | 3850 | [2026 日本建国纪念日](https://warthunder.com/en/news/9891-shop-special-dont-miss-out-on-decals-discounts-and-rare-vehicles-for-japans-national-foundation-day-en) |
| KV-1E | 3200 | [2026 苏联载具活动](https://warthunder.com/en/news/9913-shop-special-a-decal-decoration-the-object-140-and-discounts-on-soviet-vehicles-en) |
| T-34（近卫坦克第 1 旅） | 1300 | 同上 |
| 佩-2 205 型 | 1500 | 同上 |
| 伊尔-2M“复仇者” | 1300 | 同上 |
| SAV 20.12.48 | 1300 | [2026 瑞典活动](https://warthunder.com/en/news/9877-shop-the-sav-201248-for-swedish-armed-forces-day-en) |
| 德国惠灵顿 Mk IC | 1000 | [官方 Wiki](https://wiki.warthunder.com/unit/wellington_mk1c_luftwaffe) |
| Z 20 | 6090 | [官方 Wiki](https://wiki.warthunder.com/unit/germ_destroyer_class1936_z20_karlgalster)；[2020 公告明确这批返场车不打折](https://warthunder.com/en/news/6694-shop-may-sale-in-war-thunder-en) |

这些是对应来源说明的历史参考价格，不承诺当前在售。折扣、参考价值档沿用现有估值系数。M26E1、UH-1C/XM30、Ic 型自行火炮、考埃尔及 M43“幼狮”目前仅找到明确促销报价，记录在 `pending`，不把促销价冒充原价后再打折。

## 交易所和礼包

- 补入 37 条官方具体车型页侧栏的整车市场入口；迷彩等附属商品链接不作为整车依据。
- 新关联 37 辆均取得报价，另外补齐既有 LaGG-3-34 行情；采用近 30 个完整 UTC 日的官方日行情，按成交量加权，最后舍入至 0.01 GJN。保存样本量、窗口、实际核对时间及聚合证据哈希。GJN 继续独立展示，不并入人民币总价。
- He 112 B-2/U2、Bf 109 E-7/U2 在该窗口无成交，保持未知。
- 霍克 III、拉斯马森 P-36A、I-301、Po-2M、M8、A13 Mk II 1939 的默认待核价政策改为自动使用已有已核实价格；不重置管理员的已配置金额。
- 历史礼包人民币原价没有充分证据时保持未知；不按美元、相近等级或其他礼包换算。礼包整包价与商品 ID 绑定，多辆车来自同一礼包时继续按商品去重。

已保存的旧估值保留其计算时间和历史金额；资料更新后需显式重新计算。核对价格不发起玩家查询、重新登录或新增周期任务。
