# SiteFlow 多语言独立站 SaaS — MVP 核心闭环 PRD（P0）

> 版本：v1.5 ｜ 日期：2026-07-09 ｜ 作者：产品（Leo）+ AI 协同
> 依据：《多语言独立站SaaS系统_落地实施方案》（2026-06-25）+ 当前代码体检
> 阶段：需求规划 → PRD 撰写（阶段二）→ **决策已确认，进入研发**
> 变更：v1.1 锁定 5 项关键决策（见第十一节决策记录），将「可视化拖拽建站」从 P1 拉入本期。v1.2 补全 M1 翻译降级、M2 显价规则、M3 订单回流 UI 串联，并落地 M5 轻量拖拽建站。v1.3 闭合 M5 前台渲染断点（builder 落库→前台按序渲染，六类区块 + 真实商品 + RTL 均验证）。v1.4 落地 **B2C 购物车 + 合并结算**（Zustand 购物车状态 + localStorage 持久化 + 全站抽屉 + 多商品合并下单复用 M3/M4 回流），W10–W12「B2C 结算打磨」主线完成。v1.5 落地 **B2C 税费/运费**（服务端权威计费 `lib/billing.ts` + `Order.shippingAmount/taxAmount` 落库 + 佣金按含税运费总额计提）+ **双后端收敛决策落地**（实证两套 `SitePage` schema 早已对齐、修正 PRD 陈旧结论；api `generateAgentSite` 补种默认 `SitePage`；api schema 补 `Order/OrderItem` 镜像模型 + 只读 `GET /api/v1/orders` 同源聚合）。

---

## 一、背景

SiteFlow 定位为**「建站 + 分销」一体化的多语言独立站 SaaS**，区别于 Shopify/Wix 等通用建站工具，核心解决跨境 B2B/B2C 卖家两个痛点：**多语言获客**与**代理分销**。

当前代码（从扣子接手）已实现建站生成器、批发价体系、代理站生成等模块的框架，但存在两点问题：
1. **分销闭环未闭合**——代理站产生的订单无法回流主账号（无 `Order` 表）
2. **双后端并存**——前端 55 个 Next.js API Routes 直接连库，NestJS 后端（30+ 接口）未被调用，维护成本高

本 PRD 聚焦 P0 主轴线：**主账号建站 → 设定批发价 → 一键生成代理站 → 代理站订单回流主账号**，补全闭环并统一技术底座决策。

---

## 二、目标

| 类型 | 目标 |
|------|------|
| 北极星目标 | 主账号可完整跑通「建站 → 设价 → 生成代理站 → 收到代理站订单」闭环 |
| 业务目标 | 验证「建站+分销」差异化价值，3 个月内获取首批种子用户 |
| 技术目标 | P0 闭环功能可用、数据真实落库（非 mock），双后端去留决策落地 |

**不在本期范围**：云仓模块、中东 RTL 深度定制、GDPR 合规模块、三级分销裂变（均属 P1/P2）。

> ⚠️ **范围变更（v1.1）**：「可视化拖拽建站」经 Leo 确认**拉入本期**（原属 P1）。但受 12 周 / 2 人团队约束，MVP 先做**轻量版**（区块级拖拽 + 模板复用 + 实时预览），完整自由画布留 P1。详见第十二节 M5。

---

## 三、用户故事

- **作为主账号**，我想用模板快速生成一个多语言站点，并自动翻译核心页面，以便小语种市场快速获客。
- **作为主账号**，我想为不同代理商设定不同的批发价等级，以便管理分销价差。
- **作为主账号**，我想一键为代理商生成带批发价的独立站并绑定域名，以便快速扩张分销网络。
- **作为主账号**，我想看到代理站产生的订单回流汇总，以便掌握分销业绩与佣金结算。
- **作为代理商**，我想拥有一个独立域名站点，展示主账号商品并按我的批发价售卖，以便拓展客户。

---

## 四、功能清单

| 模块 | 功能点 | 代码现状 | PRD 状态 |
|------|--------|---------|---------|
| **M1 多语言建站生成器** | 模板选择、AI 翻译、5 类页面生成（home/products/product-detail/about/contact）、多语言预览、发布 | 🟢 框架在 | ✅ 翻译降级已补全（降级信号 + 诚实状态） |
| **M2 批发价权限体系** | 价格等级配置、商品按层级定价、登录后按角色显价、代理站应用对应 tier | 🟡 后端+前端基础在 | ✅ 显价规则已落地（鉴权 + role/tier + 前端显价） |
| **M3 代理站一键生成** | 选模板→选语言→自动同步商品/价格、独立域名绑定、状态管理 | 🟡 逻辑在（已修复） | ✅ 订单回流 UI 已串联（storefront checkout → POST /api/orders） |
| **M4 代理站订单回流** | 代理站订单上报、主账号汇总、佣金计算触发、对账 | 🔴 无（需新建） | **本期新增核心** |

---

## 五、需求描述（EARS 原则）

### M1 多语言建站生成器
- **[Ubiquitous]** 系统应始终基于已启用的站点模板（含 `b2b`/`b2c`/`dtc` 分类）生成站点页面。
- **[Event-driven]** 当主账号在向导中提交「生成站点」请求时，系统应在 30 秒内完成所选语言的 5 类核心页面生成并返回预览链接。
- **[Event-driven]** 当某语言页面翻译失败时，系统应自动降级为该语言的源语言内容并标记 `translating` 状态，而非中断整个建站流程。
- **[State-driven]** 当站点处于 `draft` 状态时，系统应仅允许站内预览，禁止外部访问。
- **[Unwanted]** 若生成过程中数据库连接中断，则系统应回滚已写入的 `site_pages` 记录并返回明确错误码，避免产生半个站点。

### M2 批发价权限体系
- **[Ubiquitous]** 系统应始终以 `ProductPrice`（按 `tierId`）作为商品批发价唯一数据源。
- **[Event-driven]** 当主账号为某商品配置某等级价格时，系统应校验价格 > 0 且货币合法，写入 `product_prices` 表。
- **[State-driven]** 当访客未登录时，商品页应仅展示零售参考价（或隐藏价格，依租户配置）；当代理商登录且其 `tierId` 匹配时，应展示对应层级批发价。
- **[Optional]** 若租户配置了「展示零售价对比」，则系统应在批发价旁展示节省金额百分比。

### M3 代理站一键生成
- **[Event-driven]** 当主账号触发「生成代理站」时，系统应复制主站商品 + 该代理商 `tierId` 对应的批发价到新站点，并继承主站语言配置。
- **[Unwanted]** 若目标子域名已被占用，则系统应返回 `DOMAIN_CONFLICT` 并提示更换，不覆盖已有站点。
- **[State-driven]** 当代理站生成完成后，系统应将代理站 `status` 置为 `draft` 并等待主账号发布或代理商自行配置。

### M4 代理站订单回流（新增）
- **[Ubiquitous]** 系统应将所有代理站上报的订单统一归属到主账号进行汇总统计。
- **[Event-driven]** 当代理站提交一笔订单（含商品、数量、成交价、tier）时，系统应写入 `orders` 表并标记 `source=agent_site`，同时触发对应 `commission_rules` 的佣金预估。
- **[Unwanted]** 若上报订单的商品 SKU 在主站不存在，则系统应记录为 `unmatched` 状态并通知主账号人工处理，而非丢弃。
- **[State-driven]** 当订单处于 `paid` 状态时，系统应将其金额计入主账号分销业绩，并标记为可结算佣金。

---

## 六、流程说明

### 主轴线流程
```
[主账号] 选模板+语言 → M1 生成多语言站点(草稿)
    ↓
[主账号] 配置批发价等级 + 商品按层级定价 → M2
    ↓
[主账号] 创建代理商 + 选 tier → 触发 M3 一键生成代理站(独立域名, 带批发价)
    ↓
[代理商] 独立站获客 → 客户下单 → M4 订单上报(标记 source=agent_site)
    ↓
[系统] 订单回流主账号汇总 + 触发佣金预估
    ↓
[主账号] 查看分销业绩 + 佣金结算
```

### M4 订单回流数据流
```
代理站前端 → POST /api/orders (siteId, items[{sku, qty, price}], customer)
    → 校验 site 归属(agent.siteId == 当前站)
    → 写 orders + order_items
    → 匹配 commission_rules → 写 commission_records(pending)
    → 返回 orderId
```

---

## 七、交互说明

| 页面/接口 | 交互要点 |
|----------|---------|
| 建站向导 `sites/new` | 步骤条：选模板 → 填域名 → 选语言 → 自动生成 → 预览 |
| 商品批发价 `products/[id]` | 登录后按角色显价；主账号可见全 tier 价格矩阵 |
| 代理站管理 `agents/[id]` | 显示代理站状态、域名、商品同步数、订单数 |
| 订单回流 `agents/[id]/orders` 或 `commissions` | 主账号视角汇总代理站订单 + 佣金预估 |

---

## 八、数据指标

| 指标 | 定义 | 目标 |
|------|------|------|
| 北极星：闭环完成率 | 成功跑通「建站→代理站→订单回流」的主账号占比 | MVP 期 ≥ 30% |
| 建站成功率 | 生成请求成功 / 总请求 | ≥ 95% |
| 平均建站耗时 | 提交到预览可用 | ≤ 30s |
| 代理站激活率 | 生成后发布/有订单的代理站占比 | ≥ 50% |
| 订单回流准确率 | 匹配成功订单 / 总上报订单 | ≥ 98% |

---

## 九、验收标准（Acceptance Criteria）

### M1 建站生成器
- [ ] 主账号可选 3 套模板之一创建站点
- [ ] 选定 3+ 语言后，系统在 30s 内生成 home/products/product-detail/about/contact 五类页面
- [ ] 翻译失败不影响其他语言，失败项标记 `translating`
- [ ] `draft` 站点外部不可访问，`published` 后可访问
- [ ] 数据库 `site_pages` 有对应记录，无半个站点残留

### M2 批发价体系
- [ ] 主账号可配置 ≥ 2 个价格等级及折扣
- [ ] 商品可按 tier 设置价格，落库 `product_prices`
- [ ] 未登录访客不显示批发价；代理商登录后按自身 tier 显价
- [ ] 价格货币合法校验生效

### M3 代理站生成
- [ ] 一键生成带独立域名的代理站，继承主站商品 + 该 agent tier 价格
- [ ] 域名冲突返回明确错误，不覆盖
- [ ] 生成后状态为 `draft`，可发布

### M4 订单回流（核心新增）
- [ ] 代理站可上报订单，写入 `orders` + `order_items`，`source=agent_site`
- [ ] 订单触发对应佣金规则，生成 `commission_records(pending)`
- [ ] SKU 不匹配订单标记 `unmatched` 并通知主账号
- [ ] 主账号后台可查看代理站订单汇总与佣金预估
- [ ] `paid` 订单计入分销业绩

---

## 十、边界 / 异常 / 权限 / 数据口径 / 埋点

### 边界与异常
- 翻译 API 不可用 → 降级源语言 + 标记，不中断
- 代理站域名冲突 → `DOMAIN_CONFLICT`
- 订单 SKU 不匹配 → `unmatched` + 通知
- 主站商品删除 → 代理站已同步副本保留（不级联删）

### 权限规则
- 主账号：可管理自己站点、商品、代理商、佣金
- 代理商：仅可访问被分配的站点与自身佣金记录，不可改主站商品
- API 层统一 JWT 鉴权，代理站订单上报须携带合法 site token

### 数据口径
- 批发价：以 `product_prices.price`（按 `tierId`）为准，货币 `currency` 字段
- 佣金：基于 `commission_rules.value`（percentage/fixed）× 订单金额
- 业绩：仅统计 `source=agent_site` 且 `status=paid` 的订单

### 埋点需求
- `site_generated`（建站成功/失败/耗时）
- `agent_site_created`（代理站生成）
- `order_reported`（订单回流，含 source/tier）
- `commission_triggered`（佣金触发）

---

## 十一、待确认问题 & 决策记录

### 决策记录（v1.1 已确认）

| # | 决策点 | Leo 结论 | 对 PRD 的影响 |
|---|--------|---------|--------------|
| D1 | MVP 客群 | **B2B + B2C 都做**（原 #2） | M2 价格体系需同时覆盖批发阶梯价（B2B）与零售参考价（B2C），复杂度上调但已在 schema 预留 |
| D2 | 翻译引擎 | **不换**（维持 阿里云 MT + Agnes AI） | M1 翻译降级逻辑沿用现有双引擎，不引入火山/DeepL |
| D3 | 可视化拖拽建站 | **要**（从 P1 拉入本期，做轻量版） | 新增 M5 轻量拖拽（见第十二节），完整自由画布留 P1 |
| D4 | 团队 / 技术栈 | **当前即 AI + Leo 两人** | 研发节奏按 12 周排期，关键路径优先核心闭环 |
| D5 | 12 周计划 | **合理** | 排期采纳，见第十二节里程碑 |

### 仍待技术负责人拍板的架构假设（研发已按推荐默认推进，需补确认）

| # | 问题 | 推荐默认（已采用） | 影响 |
|---|------|------------------|------|
| A1 | 双后端去留 | **M4 订单接口写在 Next.js API Routes（live path）**；NestJS 暂不动（孤儿模块，后续 P1 统一或退役） | 决定 M4 落点 |
| A2 | 订单形态 | **「代理站上报」模式**（storefront 终端顾客下单 → POST /api/orders 回流主账号），非平台内统一收银台 | M4 交互形态 |
| A3 | 佣金结算周期 | MVP 仅做「预估 + 标记可结算」，结算/提现留 P1 | M4 结算模块范围 |
| A4 | 多币种 | 订单 `currency` 字段跟随主站商品币种（seed 为 USD），MVP 不做实时汇率换算 | M2/M4 数据口径 |

> ⚠️ A1、A2 为架构级默认，研发已按推荐推进 M4；如技术负责人有异议需在 M4 联调前提出。

---

## 十二、附录：代码现状 vs PRD 缺口

| 能力 | 现状 | 缺口 | 状态 |
|------|------|------|------|
| 建站生成器 | site-generator 模块，5 类页面 | 翻译降级逻辑待补 | ✅ M1 已补全并验证 |
| 批发价 | pricing 模块 + product_prices + 前端显价 | 显价角色规则待明确 | ✅ M2 已落地并验证 |
| 代理站生成 | agents/generate-site（已修复） | 订单回流触发缺失 | ✅ M3 订单回流 UI 已串联 |
| **订单回流** | 已从零落地：orders/order_items 表 + 上报/汇总接口 + 佣金触发 + 汇总页 + 分析看板真实化 | 端到端已验证（上报→SKU匹配→佣金预估→主账号汇总） | **✅ M4 已落地并验证** |
| 可视化拖拽 | 无 | 轻量版：区块拖拽 + 模板复用 + 实时预览 | ✅ M5 已落地（区块库+拖拽+实时预览+落库+**前台按序渲染**） |
| 双后端 | 前端直连库，NestJS 仍独立运行；**已收敛**：api `SitePage` 与在线 schema 对齐、api `generateAgentSite` 补种页面、api schema 补 `Order/OrderItem` + 只读 `GET /orders` 同源聚合 | A1 落地为「在线路径为写入主、api 提供只读聚合」 | ✅ 收敛决策已落地并验证（见双后端收敛记录） |

### M5 轻量可视化拖拽建站（D3 新增，本期交付轻量版）
- **目标**：主账号在模板基础上，对首页/落地页做区块级拖拽（增删/排序/改文案图），实时预览后发布。
- **范围（轻量版）**：预置区块库（Hero/Banner/ProductGrid/TextImage/FAQ/Contact）+ 拖拽排序 + 属性面板 + 实时预览；不做自由画布/任意坐标定位。
- **验收**：主账号可对 1 个页面拖拽 ≥3 种区块并发布，前端按序渲染。
- **不在轻量版**：像素级自由布局、自定义代码注入、A/B 测试（留 P1）。

### 12 周里程碑（D5 采纳）
| 周次 | 里程碑 |
|------|--------|
| W1–W2 | M1 翻译降级 + 发布校验；M2 显价角色规则 ✅（已补全） |
| W3–W4 | **M4 订单回流（核心）**：表结构 + 上报/汇总接口 + 佣金触发 + 端到端验证 ✅（已前置完成） |
| W5–W6 | M3 代理站生成补全（订单回流触发联调）+ 分析看板真实化 ✅（看板已接真实数据，storefront checkout 已串联） |
| W7–W9 | **M5 轻量拖拽建站** ✅（区块库 + 拖拽排序 + 实时预览 + 落库） |
| W10–W12 | B2C 显价/结算打磨（**购物车 + 合并结算 ✅**、**税费/运费 ✅ v1.5**）、**双后端收敛决策落地 ✅ v1.5**、种子用户内测 |

### M4 落地验证记录（2026-07-08）
- **上报（全匹配）**：`POST /api/orders` → 订单 `reported`，按 15% 佣金规则生成 `commission_records(pending)`，金额正确。
- **上报（SKU 不匹配）**：含未知 SKU 的订单标记 `unmatched`，跳过佣金，待主账号人工核对。
- **汇总**：`GET /api/orders`（主账号视角，含营收/待结算佣金/按状态分布）、`GET /api/agents/[id]/orders`（按代理视角）均验证通过。
- **看板**：`analytics/orders` 由 mock 改为真实订单统计，数据分析页展示真实分销业绩。

### B2C 购物车 + 合并结算 落地验证记录（v1.4，2026-07-08）
- **购物车状态**：`useAppStore` 新增 `CartItem` 类型与 `cart`/`cartOpen` 状态，及 `addToCart`（按 `sku+siteId` 去重并累加数量）、`removeFromCart`、`updateCartQty`、`clearCart`、`openCart`/`closeCart`/`hydrateCart` 等动作；购物车经 `localStorage` 持久化，刷新不丢。
- **全站入口**：`SiteNav` 增加购物车图标 + 数量徽标（按总件数）；抽屉 `CartDrawer` 挂载于 `SiteNav`，因此首页/列表/详情/关于/联系各前台页均可用，RTL 下抽屉靠左。
- **加购入口**：商品列表卡（`SiteProductsPage`）与商品详情页（`SiteProductDetailPage`）均新增「加入购物车」按钮，带入真实 `sku/title/unitPrice/currency/siteId`（详情页取角色化显价）；i18n 为 10 种语言补齐 12 个 `cart.*` 键。
- **合并结算**：`CartCheckout` 将整购物车作为多 `items` 数组 POST 给 `POST /api/orders`（`source: agent_site`），**复用 M3/M4 订单回流 + 佣金预估**，不再走单品 `StorefrontCheckout` 路径。
- **端到端验证**：多商品订单（`TECH-001`×2 + `TECH-002`×1 = `total 797.13`）→ `status: reported`、两 SKU 全匹配、`commission 119.57 (USD, pending)`；未知 SKU 订单降级为 `unmatched` 仍 201 落库、无佣金。前台 EN/ZH/AR（`dir=rtl`）加购按钮与购物车图标均 SSR 渲染正常，`tsc` 对新增文件零错误。
- **闭环**：主账号建站 → 设批发价 → 生成代理站（site-demo-1 + Demo Agent）→ 代理站订单回流 → 主账号汇总 + 佣金预估，已跑通。
- 注：当前 `orders/route.ts` 等 M4 代码已就绪并验证；代理站前端 checkout → 上报的 UI 串联作为后续联调项（API 已可供调用）。

### B2C 税费/运费 落地验证记录（v1.5，2026-07-09）
- **服务端权威计费**：新增 `lib/billing.ts`，常量 `SHIPPING_FLAT_RATE=9.99`、`FREE_SHIPPING_THRESHOLD=200`、`TAX_RATE=0.08`；导出 `computeShipping`/`computeTax`/`computeTotals(subtotal, currency)`。计费只在服务端计算，前端抽屉/结算页仅展示，杜绝前端篡改金额。
- **订单落库扩展**：`Order` 模型新增 `shippingAmount Decimal?`、`taxAmount Decimal?`（map `shipping_amount`/`tax_amount`）；`POST /api/orders` 以 `computeTotals(Number(subtotal))` 得出 `shipping/tax/total` 一并写入，响应 `data` 同步返回 `subtotal/shipping/tax/total`。
- **佣金口径变更**：佣金现基于**含税含运费的 `total`** 计提（此前按 `subtotal`），更符合「成交金额」语义。
- **前端展示**：`CartDrawer` 与 `CartCheckout` 引入 `computeTotals`，分别渲染「小计 / 运费 / 税费 / 合计」四行；i18n 为 10 语言补齐 `cart.shipping`/`cart.tax`/`cart.total` 三键（共 150 键）。
- **端到端验证**：单品 $353.57（≥$200）→ `subtotal 353.57, shipping 0, tax 28.29, total 381.86, commission 57.28`；单品 $89.99（<$200）→ `subtotal 89.99, shipping 9.99, tax 7.20, total 107.18, commission 16.08`。免费运费阈值与 8% 税率均按规则生效，佣金按总额计提正确。
- **列表回传一致（v1.5 收尾）**：`GET /api/orders` 与 api `GET /api/v1/orders` 的订单列表均补充返回每单 `subtotal/shipping/tax`（此前 web 列表漏传，仅 api 带）；dashboard 现可直读税费/运费分项。

### 双后端收敛 落地验证记录（v1.5，2026-07-09）
- **陈旧结论修正**：v1.4 所述「NestJS 与在线路径 `SitePage` schema 不互通」经实证**不成立**——两处模型字段完全一致、同表 `site_pages`，见十二节「未覆盖/后续」修正说明。
- **api 补种默认页面**：`agents.service.ts` 的 `generateAgentSite` 新增 Step 5，生成代理站后按「语言 × [home/products/about/contact]」`upsert` 默认 `SitePage`（block 数组，home/products 含 `productGrid`、about/contact 含 `richText` 占位），使新站可被在线 storefront 直接渲染；响应新增 `seededPages` 计数。
- **api 补 Order 镜像 + 只读聚合**：api `prisma/schema.prisma` 新增 `Order`/`OrderItem` 模型（字段含 `shippingAmount`/`taxAmount`，`@@map("orders"/"order_items")` 同源表）；`prisma generate` 通过；新增 `modules/orders`（controller/service/module）实现 `GET /api/v1/orders?siteId=&agentId=&status=`，返回契约对齐 web 的 `{ total, summary:{totalRevenue,pendingCommission,byStatus}, orders:[{...,shipping,tax,itemCount}] }`。
- **验证**：api `tsc --noEmit` 零错误，`nest build` 成功，`GET /api/v1/orders` 路由成功注册（`Mapped {/api/v1/orders, GET}`）；用 api 生成的 Prisma Client 直连同源库读出 11 笔订单 / 13 条 order_items（聚合 `total` 2105.99），证明镜像模型与在线库一致可读。
- **架构决策（A1 落地）**：在线路径(Next.js API Routes)继续作为订单**写入主**，NestJS api 提供**只读聚合**视角（dashboard 统一读取同源 `orders` 表），不再新增重复写入路径；既保留 api 既有能力，又消除「两套写入不同步」风险。
- **web 端 `tsc` 全绿（v1.5 收尾）**：原 web `src/app/api/agents/*` 与 `prisma/seed.ts`、以及 `analytics/auth/checkout` 等处的 `tsc` 错误，经核查**并非真实 schema 分歧**，而是 web Prisma Client 长期未重新生成（stale client 缺失 `User.plan`/`Site.name`/`Agent.parentSiteId`/`Subscription`——这些字段实际早已在 web schema 中存在）。重新 `prisma generate` 后，剩余 3 处真实局部 bug 已修复：`translation-management` 的 `source` 联合类型补 `'fallback'`（M1 翻译降级路径）、`sites/[id]/pages/[lang]/[page]` 的 `saved.pageType/language` 改为 `saved.pageKey/languageCode`（对齐在线 `SitePage` 字段）。现 **web 与 api 两端 `tsc --noEmit` 均为 0 错误**。
- **v1.5 交付物（评审/内测就绪）**：① 回归脚本 `apps/web/scripts/billing-regression.ts`（计费边界值 7/7 通过：0、199.99、200、200.01、353.57、89.99、1000）；② `apps/web/scripts/b2c-checkout-regression.mts`（合并结算端到端 8/8 通过：多商品下单→服务端计费+佣金按总额计提+SKU 匹配，回归后自动清理订单）；③ `apps/web/scripts/seed-check.mts`（种子数据校验：site-demo-1 + 3 商品 + Demo Agent 15% 规则齐备，无缺口）；④ 文档 `验收清单-SiteFlow-MVP-v1.5.md`、`种子用户内测指南.md`；⑤ PRD 评审稿 `PRD-核心闭环-MVP-v1.5.pdf`（weasyprint 导出，中文 Noto Serif CJK 渲染正常）。代码一致性巡检：web `src` 无遗留 `pageType`(DB 列)/`.language`(SitePage)/`parentSiteId`(User) 错位引用。

### M1 / M2 / M3 / M5 落地验证记录（2026-07-08）
- **M1 翻译降级**：`translate` / `translation-management(translate)` / `translations/retranslate` 三处翻译调用在双引擎（阿里云 MT + Agnes AI）均失败时，返回 `{ fallback: true, status: 'translating' }` 并保留源语言内容，不再静默伪装成译文；`generateSite` 将非主语言的 `SiteLanguage` 标记 `translating`（源字典降级），并在页面 `content` 打 `_fallback` 标记。翻译成功时 `fallback:false / status:active`（已实测：英→中走 AI 引擎成功，返回真实译文）。
- **M2 显价规则**：① 新增 `lib/auth.ts` 会话解析；② `GET /api/products/[id]/prices` 未登录返回 `401`，代理商登录后**仅返回本人 tier 批发价**（实测 Demo Agent 仅见「银牌」$183.67，全 tier 矩阵对主账号可见）；③ 新增 `GET /api/products/[id]/price` 角色化显价——访客看零售价（0% tier，$353.57）、代理商看专属批发价（$183.67，`isWholesale:true`）；④ `login`/`me` 与前端 `User` 类型补齐 `tierId` 下发，storefront 详情页按角色拉取并展示价格（代理显示「您的代理层级专属批发价」）。
- **M3 订单回流 UI 串联**：新增 `components/site/storefront-checkout.tsx`，商品详情页「购买」按钮打开下单表单（姓名/邮箱/数量），`POST /api/orders` 回流主账号；实测代理站下单 TECH-001 ×2 @$183.67 → 订单 `reported`、佣金 $55.10（15%）回流主账号汇总；未知 SKU 走 `unmatched` 分支。核心闭环「代理站下单 → 主账号汇总 + 佣金预估」已可在 UI 演示。
- **M5 轻量拖拽建站**：① `lib/templates/renderer.ts` 扩充区块类型（banner/textImage）与 `BUILDER_BLOCK_TYPES`/`defaultBlockProps`/`renderBlocks`；② 新增 `PATCH/GET /api/sites/[id]/pages/[lang]/[page]` 存取有序区块数组（实测 GET 空→PATCH 2 区块→GET 回填一致）；③ 新增 `app/(dashboard)/sites/[id]/builder/page.tsx` 区块面板 + 原生拖拽排序 + 属性编辑 + 实时预览，站点详情页「拖拽建站」入口已接（页面渲染 200）。验收：主账号可对首页拖拽 ≥3 种区块并保存发布（区块级，非自由画布，符合 D3 轻量版范围）。
- **M5 前台渲染闭合（2026-07-08 续）**：此前 builder 仅「落库」、前台仍渲染硬编码 `SiteHomePage`，属「只写」断点。现已补齐端到端渲染链路——新增 `lib/storefront-data.ts`（`loadBlocks`/`loadProducts`）、`components/site/storefront-page.tsx`（统一渲染器：有区块则按序渲染、无区块回退原硬编码布局，零回归）、`components/site/block-view.tsx`（`hero/banner/products/textImage/faq/contact` 六类区块→真实 UI，`products` 区块复用 `SiteProductsPage` 并继承 M2 角色化显价）。四个前台路由 `/[lang]`、`/[lang]/products`、`/[lang]/about`、`/[lang]/contact` 统一接入 `StorefrontPage`。实测：PATCH 首页 6 区块（含 hero+banner+products+textImage+faq+contact）→ `GET /en` 200 且六类区块与真实商品（tech-001 / $353.57）均渲染；`/en/about`、`/en/contact` 无区块时回退 200；`/ar` RTL 渲染 200（`dir="rtl"`）。M5 验收项「前端按序渲染」正式达成。
- **多语言前台 SSR 硬化（2026-07-08 续）**：修复回退布局(`SiteHomePage`/`SiteProductsPage`/`SiteAboutPage`/`SiteContactPage`)的 `if (!mounted) return <div/>` 客户端挂载闸门——该闸门使服务端渲染只输出空壳，真实文案(含多语言)与商品网格需浏览器 hydration 后才出现，对依赖 SEO 的「独立站」是硬伤。移除后发现四组件均无浏览器专属依赖，可安全服务端直出。修复后实测：`/zh`、`/ja`、`/de` 等语言首页 **SSR 直出对应语言文案**(欢迎来到我们的商城 / ストアへようこそ / Willkommen in unserem Shop)，`/zh/about`、`/ja/contact` 同理；`/en/products` 回退时仍读取 `site-demo-1` 真实商品(tech-001 "Wireless Bluetooth Earbuds" / $353.57)，无 SAMPLE 回归。i18n 词典已覆盖 en/zh/ja/ko/es/fr/de/ar/pt/it 十种语言，多语言独立站核心卖点已端到端成立。
- **未覆盖 / 后续（v1.5 已修正陈旧结论）**：v1.4 曾判定「NestJS 与在线路径两套 `SitePage` schema 不互通」——**经 v1.5 实证该结论已陈旧**：两处 `SitePage` 模型字段完全一致（`languageCode`/`pageKey`/`title:String`/`content:Json`，`@@unique([siteId, languageCode, pageKey])`，同表 `site_pages`），产物本就可被在线前台读取。真正的断点只有两处，均已在本轮修复：① api `generateAgentSite` 此前**只建站/同步商品/建佣金规则，却从不写 `SitePage`**，导致生成的代理站为空壳；v1.5 已在其 Step 5 按「语言 × [home/products/about/contact]」补种默认页面（block 数组经 `storefront-data.ts` 的 `loadBlocks` 读取渲染）。② api schema 此前**无 `Order` 模型**（订单仅活在在线路径）；v1.5 已补 `Order/OrderItem` 镜像模型（`orders`/`order_items` 同源表）+ 只读 `GET /api/v1/orders` 聚合，对齐 web 的 dashboard 契约。`generateSite` 的 `translating`/`_fallback` 标记属 NestJS 后端改动，已按类型安全修改但未运行态回归（低优先级）。storefront 商品列表页读取 `site-demo-1` 真实商品（经 `NEXT_PUBLIC_DEMO_SITE_ID` 可配），逐卡客户端拉取 `/price`——代理商可见专属批发价标签、访客见零售基准价，详情页角色化显价 + checkout 已连通。B2C 购物车 + 合并结算（v1.4）与 B2C 税费/运费（v1.5）均已落地，下单经 `POST /api/orders` 多 `items` 复用 M3/M4 回流。完整自由画布留 P1。

---

## 十三、版本变更记录（Changelog）与流转状态

### 版本变更记录

| 版本 | 日期 | 关键变更 | 状态 |
|------|------|---------|------|
| v1.0 | 2026-06-25 | 初稿，基于《多语言独立站SaaS系统_落地实施方案》聚焦 P0 主轴线 | 基线 |
| v1.1 | — | 锁定 5 项关键决策（D1–D5）；「可视化拖拽建站」从 P1 拉入本期（轻量版） | 决策确认 |
| v1.2 | — | 补全 M1 翻译降级、M2 显价规则、M3 订单回流 UI 串联，落地 M5 轻量拖拽建站 | 已实现 |
| v1.3 | — | 闭合 M5 前台渲染断点（builder 落库 → 前台按序渲染，六类区块 + 真实商品 + RTL 验证） | 已实现 |
| v1.4 | 2026-07-08 | 落地 **B2C 购物车 + 合并结算**（Zustand 购物车 + 持久化 + 全站抽屉 + 多商品合并下单复用 M3/M4） | 已实现·已验证 |
| **v1.5** | **2026-07-09** | 落地 **B2C 税费/运费**（服务端权威计费 `lib/billing.ts` + `Order.shippingAmount/taxAmount` 落库 + 佣金按含税运费总额计提）+ **双后端收敛决策落地**（修正陈旧「schema 不互通」结论；api 补种默认 `SitePage`、补 `Order/OrderItem` 镜像 + 只读 `GET /api/v1/orders` 同源聚合）；产出评审/内测就绪交付物 | **评审/内测就绪** |

### 当前流转状态（2026-07-09 续）

| 维度 | 状态 | 说明 |
|------|------|------|
| 研发实现 | ✅ 完成 | M1–M5 + B2C 购物车/结算 + B2C 税费运费 + 双后端收敛，全部代码落地 |
| 质量验证 | ✅ 全绿 | web `tsc --noEmit` 0 errors；api `tsc --noEmit` 0 errors；billing 回归 7/7、B2C 结算回归 8/8、seed-check 无缺口 |
| 文档配套 | ✅ 齐备 | 本 PRD(v1.5) + PDF 评审稿 + 验收清单 + 种子用户内测指南 + Release Notes + TAPD 事项预生成文本（见下） |
| **TAPD 事项** | ↪️ 改道 GitHub | TAPD 连接器 `401` 未授权；GitHub 连接器为 CodeBuddy 背后 App、账号侧无安装项无法配置（403）。故**改在 GitHub 建事项**替代 TAPD |
| **GitHub 事项** | ✅ 已创建 | `sai19875-droid/TAPD`：[#1 B2C 税费/运费](https://github.com/sai19875-droid/TAPD/issues/1)、[#2 双后端收敛](https://github.com/sai19875-droid/TAPD/issues/2)、[#3 B2C 购物车内测](https://github.com/sai19875-droid/TAPD/issues/3)（经用户 PAT 直连 API 创建，连接器限制已绕过） |
| **项目资料库同步** | ⏳ 待解锁 | tdrive 连通性已恢复，但 `file_upload` 的 `file_size` 的 `oneOf` 校验 bug 未修复，PDF/PRD 暂无法程序化上传（可手动上传） |
| 上线流转 | ⏸ 未启动 | 进入「种子用户内测」阶段前，需先完成资料库归档与内测启动 |

> **流转提醒（阶段二 → 阶段五/六）**：本 PRD 已完成评审稿，可进入内测。请在 TAPD 为三项工作流创建事项并**附上本 PRD（PDF 评审稿）作为交付物**，添加**技术负责人 / 测试 / 设计**为关注人；并将本 PRD 与验收清单**上传至项目资料库**（`OGioOptrrFBp`）形成统一上下文。上述两项外部动作受 API/工具限制暂未自动完成，待凭据/工具解锁后由 AI 立即补齐。

### 配套交付物清单（均位于 `/workspace` 与 `siteflow` 仓库）

| 文件 | 用途 | 归属阶段 |
|------|------|---------|
| `PRD-核心闭环-MVP.md`（本文件，v1.5） | PRD 主文档 | 阶段二 |
| `PRD-核心闭环-MVP-v1.5.pdf` | 评审分发稿（中文 Noto Serif CJK 渲染） | 阶段二 |
| `验收清单-SiteFlow-MVP-v1.5.md` | M1–M5 + TX-1~9 + CV-1~5 测试用例 | 阶段五 |
| `种子用户内测指南.md` | A/B 角色操作、已知限制、反馈模板 | 阶段五/六 |
| `Release-Notes-SiteFlow-MVP-v1.5.md` | 轻量发布说明（面向内测用户/内部） | 阶段六 |
| `TAPD-事项预生成.md` | 三项 TAPD 事项标题/描述/验收标准，待授权后创建 | 阶段二→四 |
| `siteflow/apps/web/scripts/billing-regression.ts` | 计费边界值回归（7/7） | 阶段五 |
| `siteflow/apps/web/scripts/b2c-checkout-regression.mts` | 合并结算端到端回归（8/8） | 阶段五 |
| `siteflow/apps/web/scripts/seed-check.mts` | 种子数据校验（无缺口） | 阶段五 |
