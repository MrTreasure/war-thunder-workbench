# 账户估值历史价格

2026-11-06 核对。`data/account-valuation-price-references.json` 保存估值专用历史价格和整车交易所关联；不修改科技树的当前销售资格。`scripts/prepare-account-valuation.mjs` 生成后端目录时应用这些参考项，后续已核实的现行目录售价优先。管理员已有自定义定价仍优先于目录。

## 历史金鹰售价

| 载具 | GE | 来源 |
| --- | ---: | --- |
| 零战五二型甲 | 3850 | [官方来源](https://warthunder.com/en/news/9891-shop-special-dont-miss-out-on-decals-discounts-and-rare-vehicles-for-japans-national-foundation-day-en) |
| Bf 109 Z | 2980 | [官方来源](https://warthunder.com/en/news/10042-shop-the-bf-109-z-1-discounts-on-bf-109-and-fw-190-variants-en) |
| Z 20 | 6090 | [官方来源](https://wiki.warthunder.com/unit/germ_destroyer_class1936_z20_karlgalster) |
| 伊尔-2M (“复仇者”号) | 1300 | [官方来源](https://warthunder.com/en/news/9913-shop-special-a-decal-decoration-the-object-140-and-discounts-on-soviet-vehicles-en) |
| 工兵 | 3850 | [官方来源](https://warthunder.com/en/news/10087-shop-special-rn-geniere-discounts-and-a-new-decal-for-italian-navy-day-en) |
| 清霜 | 4880 | [官方来源](https://warthunder.com/en/news/9891-shop-special-dont-miss-out-on-decals-discounts-and-rare-vehicles-for-japans-national-foundation-day-en) |
| ▀拉-5FN | 5250 | [官方来源](https://warthunder.com/en/news/9974-shop-get-the-german-la-5fn-as-it-temporarily-returns-to-mark-the-la-5s-first-flight-en) |
| ▂P-39N-0 (波克雷什金座机) | 1300 | [官方来源](https://warthunder.com/en/news/9946-shop-the-p-39n-0-is-temporarily-available-for-alexander-pokryshkins-birthday-en) |
| P-47M-1-RE (博斯特威克座机) | 6090 | [官方来源](https://warthunder.com/en/news/10239-shop-special-a-decal-a-discount-a-rare-vehicle-for-the-us-air-forces-birthday-en) |
| P-51D-10 | 4880 | [官方来源](https://warthunder.com/en/news/10239-shop-special-a-decal-a-discount-a-rare-vehicle-for-the-us-air-forces-birthday-en) |
| 佩-2 205 型 | 1500 | [官方来源](https://warthunder.com/en/news/9913-shop-special-a-decal-decoration-the-object-140-and-discounts-on-soviet-vehicles-en) |
| J 35A | 9090 | [官方来源](https://warthunder.com/en/news/10278-shop-the-j35a-returns-with-a-discount-for-the-dragons-first-flight-en) |
| 喷火 FR Mk XIVE (普伦德加斯特座机) | 6090 | [官方来源](https://warthunder.com/en/news/10231-shop-special-a-decal-discounts-for-battle-of-britain-day-en) |
| 喷火 LF Mk IXC (普拉吉斯座机) | 6090 | [官方来源](https://warthunder.com/en/news/10231-shop-special-a-decal-discounts-for-battle-of-britain-day-en) |
| ▂喷火 Mk IXC | 6090 | [官方来源](https://warthunder.com/en/news/9992-shop-celebrating-vasily-matsievichs-birthday-with-the-return-of-the-spitfire-mk-ixc-en) |
| SAV 20.12.48 | 1300 | [官方来源](https://warthunder.com/en/news/10039-shop-special-a-decal-and-the-sav-201248-for-swedish-national-security-forces-day-en) |
| T-2 早期型 | 8910 | [官方来源](https://warthunder.com/en/news/8993-shop-the-t-2-early-is-available-on-the-anniversary-of-its-first-flight-en) |
| KV-1E | 3200 | [官方来源](https://warthunder.com/en/news/9913-shop-special-a-decal-decoration-the-object-140-and-discounts-on-soviet-vehicles-en) |
| T-34 (近卫坦克第 1 旅) | 1300 | [官方来源](https://warthunder.com/en/news/9913-shop-special-a-decal-decoration-the-object-140-and-discounts-on-soviet-vehicles-en) |
| ▂“瓦伦丁”Mk IX | 1000 | [官方来源](https://warthunder.com/en/news/9895-shop-special-celebrate-valentines-day-with-a-decal-and-the-return-of-a-rare-tank-en) |
| ▀惠灵顿 Mk IC | 1000 | [官方来源](https://wiki.warthunder.com/unit/wellington_mk1c_luftwaffe) |

这些是对应来源说明的历史参考价格，不承诺当前在售。折扣、参考价值档沿用现有估值系数。全量核对 310 辆候选后，56 辆有历史 GE 报价，其中 20 辆有历史返场参考价、J35A 有官方明确原价 9090 GE，共 21 辆采用估值基准。其他 35 辆只有明确促销实际价，记录在 `pending`，不把促销价冒充原价后再打折。

## 交易所和礼包

- 累计补入 92 条官方具体车型页侧栏的整车市场入口；迷彩等附属商品链接不作为整车依据。
- 全目录 233 辆按最近核对的官方最低挂售价标价：231 条有效报价，E100 与 He 162 A-1 无卖单保持未知；历史成交均价不再作为出售参考价。数据来自官方批量市场摘要，4 页请求的间隔均不少于 7 秒，已核对分页终止及两个商品在订单簿中的金额倍率。报价快照数为 1，不冒充最低价档挂单数量。GJN 继续独立展示，不并入人民币总价。
- 既有 `averageGjnCents` / `average_gjn_cents` 数值字段保留兼容；以 `method` 的 `official-order-book:lowest-ask;` 前缀明确价格口径。前端不将旧成交均价缓存展示成出售报价。
- 霍克 III、拉斯马森 P-36A、I-301、Po-2M、M8、A13 Mk II 1939 的默认待核价政策改为自动使用已有已核实价格；不重置管理员的已配置金额。
- 历史礼包 61 条逐项归档：36 辆找到历史金额但原件未标币种，25 辆尚无金额；全部人民币报价保持未知。不按英文页面猜 USD，也不按美元、相近等级或其他礼包换算。礼包整包价与商品 ID 绑定，多辆车来自同一礼包时继续按商品去重。

已保存的旧估值保留其计算时间和历史金额；资料更新后需显式重新计算。核对价格不发起玩家查询、重新登录或新增周期任务。

历史 GE 报价、促销条件以及礼包的未定币种金额独立写入后端历史证据表；未核实币种的 `currency`、数值金额均保持 null，展示文本与礼包内容原样留存，不进入人民币估值。官方资源返回 403 后停止新采集，保留尚未读取来源列表供后续按规则补查。
