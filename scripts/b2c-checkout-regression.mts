// B2C 合并结算端到端回归：多商品下单 → 断言服务端计费(含税运费) + 佣金按总额计提 + SKU 匹配
// 前置：web 服务已启动（默认 http://localhost:3000），且库中存在代理站与商品
// 运行：cd apps/web && DATABASE_URL=... BASE_URL=http://localhost:3000 npx tsx scripts/b2c-checkout-regression.mts
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();
const money = (n: number) => Math.round(n * 100) / 100;

async function getCommissionRate(parentSiteId: string): Promise<number> {
  const rule = await prisma.commissionRule.findFirst({
    where: { siteId: parentSiteId, status: 'active' },
    orderBy: { level: 'asc' },
  });
  return rule && rule.type === 'percentage' ? Number(rule.value) : 0;
}

async function main() {
  const agent = await prisma.agent.findFirst({
    where: { siteId: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  if (!agent || !agent.siteId) {
    console.error('❌ 未找到代理站（agent.siteId 为空）');
    process.exit(2);
  }
  const siteId = agent.siteId;
  const parentSiteId = (agent as { parentSiteId?: string | null }).parentSiteId || siteId;

  const products = await prisma.product.findMany({
    where: { siteId: parentSiteId },
    take: 2,
    select: { sku: true },
  });
  if (products.length < 2) {
    console.error('❌ 主站商品不足 2 个，无法构造多商品订单');
    process.exit(2);
  }

  const items = [
    { sku: products[0].sku, title: products[0].sku, quantity: 2, unitPrice: 353.57 },
    { sku: products[1].sku, title: products[1].sku, quantity: 1, unitPrice: 89.99 },
  ];
  const subtotal = money(items.reduce((s, i) => s + money(i.unitPrice * i.quantity), 0));
  const expShipping = subtotal >= 200 ? 0 : 9.99;
  const expTax = money(subtotal * 0.08);
  const expTotal = money(subtotal + expShipping + expTax);
  const rate = await getCommissionRate(parentSiteId);
  const expCommission = rate > 0 ? money((expTotal * rate) / 100) : 0;

  const resp = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, items, currency: 'USD', source: 'agent_site' }),
  });
  const json = await resp.json();
  const d = json.data || {};

  const checks: Array<[string, boolean]> = [
    ['HTTP 201', resp.status === 201],
    ['status=reported', d.status === 'reported'],
    ['subtotal 匹配', d.subtotal === subtotal],
    ['shipping 匹配', d.shipping === expShipping],
    ['tax 匹配', d.tax === expTax],
    ['total 匹配', d.total === expTotal],
    ['matchedItems=2', d.matchedItems === 2],
    [
      '佣金按总额计提',
      !!d.commission && rate > 0
        ? d.commission.amount === expCommission
        : d.commission === null && rate === 0,
    ],
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(
    `\n构造: subtotal=${subtotal} exp(ship=${expShipping}, tax=${expTax}, total=${expTotal}, commission=${expCommission}@${rate}%)`,
  );
  console.log(`响应: ${JSON.stringify(d)}`);

  // 清理：删除本次回归产生的订单，保持库干净
  if (d.orderId) {
    await prisma.order.delete({ where: { id: d.orderId } }).catch(() => {});
  }

  console.log(failed === 0 ? '\n✅ B2C CHECKOUT REGRESSION PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('回归脚本异常:', e);
  process.exit(3);
});
