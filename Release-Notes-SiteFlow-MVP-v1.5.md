# SiteFlow MVP 发布说明（Release Notes）— v1.5

> 版本：**v1.5** ｜ 发布日期：**2026-07-09** ｜ 维护：产品（Leo）+ AI 协同
> 对应 PRD：`PRD-核心闭环-MVP.md`（v1.5）｜ 适用对象：种子用户 / 内部研发 / 测试

---

## 一句话概述

SiteFlow 的「建站 + 分销」核心闭环已在本版本跑通并具备内测条件：**多语言建站 → 批发价 → 一键代理站 → 订单回流 + 佣金预估** 全链路真实落库；本期新增 **B2C 购物车/合并结算的税费运费计费** 与 **双后端收敛决策落地**，并配套回归脚本、验收清单与内测指南。

---

## 核心能力（截至 v1.5）

| 能力 | 说明 | 状态 |
|------|------|------|
| M1 多语言建站生成器 | 3 套模板 + 阿里云 MT / Agnes AI 双引擎翻译，翻译失败诚实降级（标记 `translating`），10 语言、RTL 支持 | ✅ |
| M2 批发价权限体系 | 按 `tierId` 阶梯定价，未登录看零售价、代理商登录看专属批发价 | ✅ |
| M3 代理站一键生成 | 复制主站商品 + 代理商 tier 价格，独立域名，订单回流 UI 已串联 | ✅ |
| M4 代理站订单回流 | 订单写 `orders` + `order_items`（`source=agent_site`），触发佣金预估，主账号汇总 + 看板真实化 | ✅ |
| M5 轻量可视化拖拽建站 | 区块库（Hero/Banner/ProductGrid/TextImage/FAQ/Contact）+ 拖拽排序 + 实时预览 + 前台按序渲染 | ✅ |
| B2C 购物车 + 合并结算 | Zustand 购物车 + localStorage 持久化 + 全站抽屉 + 多商品合并下单复用 M3/M4 | ✅ |
| **B2C 税费 / 运费**（本期新增） | 服务端权威计费（免运阈值 $200、运费 $9.99、税率 8%），佣金按含税含运费总额计提 | ✅ 新增 |
| **双后端收敛**（本期新增） | 修正「schema 不互通」陈旧结论；api 补种默认 `SitePage` + `Order/OrderItem` 镜像 + 只读 `GET /api/v1/orders` 同源聚合 | ✅ 新增 |

---

## 本期新增 / 变更（v1.5）

### 1. B2C 税费 / 运费（服务端权威计费）
- 新增 `lib/billing.ts`，常量：`SHIPPING_FLAT_RATE=9.99`、`FREE_SHIPPING_THRESHOLD=200`、`TAX_RATE=0.08`。
- 计费**只在服务端**计算，前端仅展示，杜绝金额被前端篡改。
- `Order` 新增 `shippingAmount` / `taxAmount` 落库；`POST /api/orders` 回传 `subtotal/shipping/tax/total`。
- **佣金口径变更**：由「按 `subtotal`」改为「按含税含运费的 `total`」计提，更贴合成交金额语义。

### 2. 双后端收敛决策落地
- 实证在线路径与 NestJS api 的 `SitePage` schema **早已同源对齐**（同表 `site_pages`），修正 PRD 陈旧结论。
- api `generateAgentSite` 补种默认 `SitePage`（语言 × [home/products/about/contact]），新代理站可直接被前台渲染。
- api 新增 `Order/OrderItem` 镜像模型 + 只读 `GET /api/v1/orders` 聚合，契约对齐 web dashboard。
- **架构决策**：在线路径(Next.js API Routes)为订单**写入主**，NestJS api 提供**只读聚合**，消除「两套写入不同步」风险。

---

## 已修复 / 硬化

- web 端 `tsc` 全绿：原报错实为 stale Prisma client + 3 处局部 bug（`'fallback'` 联合类型、`pageType→pageKey`、`language→languageCode`），均已修复。
- 多语言前台 SSR 硬化：移除客户端挂载闸门，SEO 文案服务端直出（/zh /ja /de 等直出对应语言）。
- M5 前台渲染闭合：builder 落库 → 前台按序渲染六类区块 + 真实商品 + RTL，均已验证。

---

## 已知限制（内测期需注意）

| 限制 | 说明 | 计划 |
|------|------|------|
| 多币种 | 订单 `currency` 跟随主站（seed 为 USD），MVP 不做实时汇率换算 | P1 |
| 佣金结算/提现 | MVP 仅做「预估 + 标记可结算」，无真实打款 | P1 |
| 完整自由画布 | M5 仅区块级拖拽，不做像素级自由布局 | P1 |
| 云仓 / GDPR / 三级分销 | 不在本期范围 | P1/P2 |
| tdrive / TAPD 同步 | 资料库上传与 TAPD 事项因外部 API/工具限制暂未自动完成，可手动处理 | 待解锁 |

---

## 验证与质量门禁

- **编译**：web `tsc --noEmit` 0 errors；api `tsc --noEmit` 0 errors。
- **回归**：计费边界值回归 **7/7 PASS**（0、199.99、200、200.01、353.57、89.99、1000）；B2C 合并结算端到端回归 **8/8 PASS**；种子数据校验 **无缺口**。
- **文档**：验收清单（`验收清单-SiteFlow-MVP-v1.5.md`）、内测指南（`种子用户内测指南.md`）、PRD 评审稿 PDF 均齐备。

---

## 如何参与内测

1. 阅读 `种子用户内测指南.md`，按 A/B 角色认领验证场景。
2. 用 seed 站点 `site-demo-1`（Demo Agent）跑通「加购 → 合并结算（看税费/运费）→ 主账号订单回流 + 佣金预估」。
3. 发现问题按指南模板反馈（附环境、复现步骤、截图）；阻断性问题请标注。
4. 评审/验收结论、Bug 将同步挂接到 TAPD 对应事项（待连接器授权后自动建项）。

---

> 本发布说明为 PRD 的轻量衍生件，详细需求、边界与验收标准以 `PRD-核心闭环-MVP.md`(v1.5) 为准。
