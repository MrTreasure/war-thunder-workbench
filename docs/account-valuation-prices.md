# 账户估值历史价格

2026-11-06 核对。`data/account-valuation-price-references.json` 保存估值专用历史价格和整车交易所关联；不修改历史礼包的当前销售资格；交易所已核实入口与价格快照同时进入现有国家资料包。`scripts/prepare-account-valuation.mjs` 生成后端目录时应用这些参考项，后续已核实的现行目录售价优先。管理员已有自定义定价仍优先于目录。

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

这些是对应来源说明的历史参考价格，不承诺当前在售。折扣、参考价值档沿用现有估值系数。全量核对 310 辆候选后，56 辆有历史 GE 报价，其中 20 辆有历史返场参考价、J35A 有官方明确原价 9090 GE，共 21 辆采用估值基准。其他 35 辆已依据同一官方公告中的明确折扣和活动价精确推导常规参考价，并保留原始活动价、折扣及来源；展示标注为参考价，不称为官方直接原价。69-IIA 历史五折价 4190 GE，对应常规参考 8380 GE。

## 交易所和礼包

- 累计补入 92 条官方具体车型页侧栏的整车市场入口；迷彩等附属商品链接不作为整车依据。
- 全目录 233 辆按最近核对的官方最低挂售价标价：231 条有效报价，He 162 A-1 无卖单保持未知；E100 无卖单，按用户明确指定的 2000 GJN 参考上限记录，不能称为实际挂售；历史成交均价不再作为出售参考价。数据来自官方批量市场摘要，4 页请求的间隔均不少于 7 秒，已核对分页终止及两个商品在订单簿中的金额倍率。报价快照数为 1，不冒充最低价档挂单数量。GJN 保留原币展示；新估值请求通过 `valuation_basis=market-cny-v1` 将核实的人民币参考金额纳入总价，旧客户端保持原有计算协议。
- 既有 `averageGjnCents` / `average_gjn_cents` 数值字段保留兼容；以 `method` 的 `official-order-book:lowest-ask;` 前缀明确价格口径。前端不将旧成交均价缓存展示成出售报价。
- 霍克 III、拉斯马森 P-36A、I-301、Po-2M、M8、A13 Mk II 1939 的默认待核价政策改为自动使用已有已核实价格；除用户本轮明确改用 GJN 参考的 E100 外，不重置管理员的已配置金额。
- 历史礼包 61 条逐项归档：36 辆有历史金额（16 辆有单车礼包金额、20 辆仅有联包金额），25 辆尚无金额。用户明确确认这些金额为 USD，并要求按最新可核实汇率折成人民币整数元；保留原始 USD、确认依据及 FX 来源。单车礼包中 4 辆已有较新的 GE 基准，另外 12 辆加入历史礼包折算参考；不将联包金额拆为单车价。礼包整包价与商品 ID 绑定，多辆车来自同一礼包时继续按商品去重。

已保存的旧估值保留其计算时间和历史金额；资料更新后需显式重新计算。核对价格不发起玩家查询、重新登录或新增周期任务。

历史 GE 报价、促销条件和礼包金额独立写入后端历史证据表。美元礼包按用户要求以 CNY 参考值入表，原始 USD 金额与币种确认依据保存在 payload；未找到金额的条目仍为 null。官方资源返回 403 后停止新采集，保留尚未读取来源列表供后续按规则补查。

## 人民币换算与交易所上限

- 中国货币网 2026-11-06 09:15 中间价：1 USD = 6.7168 CNY。记录于 `data/account-valuation-fx.json`，来源 https://www.chinamoney.com.cn/chinese/bkccpr/ 。
- 用户指定 GJN 按 1 GJN ≈ 1 USD 作参考；换算后人民币四舍五入到整数元，内部以整数分保存。原始美元／GJN 精度不损失。
- IS-7、E100 的参考上限均为 2000 GJN。IS-7 本次最低挂售 1999.99 GJN，未超过上限；E100 无挂售，使用用户设定的 2000 GJN 参考上限。两者折合人民币均为 13434 元。
- 交易所载具卡片和详情沿用礼包价样式显示 GJN 数量、来源核对时间；后台另列整数人民币参考。无卖单与用户参考上限区分展示。

## 本轮遗漏与历史渠道核对

补入官方当前在售 6 个人民币礼包，覆盖 8 辆车；PLZ45 整包价 299 元。三车“时刻准备”礼包按商品 15804 去重，仅计算一次 449 元。历史下架、旧礼包下架、限时返场分别记录；过去礼包下架不等于载具所有渠道永久不可获取，未确认的当前状态保持未知。现行官方人民币礼包优先于历史折算参考。

## 交易所估值系数与明细

新规则通过 `valuation_basis=market-cny-v2` 选择，响应沿用既有金额字段。交易所人民币基准在正常价值、折扣价值中均按 100% 计入，参考价值按 50% 计入；金鹰、礼包继续采用各自原有系数。规则快照通过 `marketPurchasePercent` 保留，估值缓存按版本隔离。历史结果保留原计算金额和规则，刷新后才应用新规则。

金鹰、礼包、交易所明细均按每页 10 项展示，使用相同国家、军种、等级筛选；各列表页码独立，筛选变化重置页码。礼包按包内任一匹配车型纳入筛选，整包计价、整包分页，不拆分金额。
