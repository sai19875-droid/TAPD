// 种子数据校验：确认内测所需的核心实体齐备（主站/商品/代理站/佣金规则/订单回流）
// 运行：cd apps/web && DATABASE_URL=... npx tsx scripts/seed-check.mts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const report: Record<string, unknown> = {};

  const sites = await prisma.site.count();
  const products = await prisma.product.count();
  const agents = await prisma.agent.count();
  const rules = await prisma.commissionRule.count();
  const orders = await prisma.order.count();
  const pages = await prisma.sitePage.count();

  // 演示主站 + 代理站
  const demoSite = await prisma.site.findFirst({
    where: { id: process.env.DEMO_SITE_ID || 'site-demo-1' },
    include: { products: { take: 5, select: { sku: true } }, agents: true },
  });
  const demoProducts = demoSite?.products ?? [];
  const demoAgent = demoSite?.agents?.[0] ?? null;

  report.summary = { sites, products, agents, rules, orders, pages };
  report.demoSite = {
    id: demoSite?.id ?? null,
    domain: demoSite?.domain ?? null,
    products: demoProducts.map((p) => p.sku),
    agentSiteId: demoAgent?.siteId ?? null,
    commissionRate: demoAgent?.commissionRate ?? null,
  };

  const gaps: string[] = [];
  if (sites < 1) gaps.push('无站点');
  if (products < 2) gaps.push('商品 < 2');
  if (agents < 1) gaps.push('无代理商');
  if (rules < 1) gaps.push('无佣金规则');
  if (!demoSite) gaps.push('演示主站 site-demo-1 缺失');
  if (demoProducts.length < 2) gaps.push('演示主站商品 < 2');
  if (!demoAgent?.siteId) gaps.push('演示代理站未绑定站点');

  report.gaps = gaps;
  console.log(JSON.stringify(report, null, 2));
  console.log(gaps.length === 0 ? '\n✅ 种子数据齐备，可进入内测' : `\n⚠️ 缺口: ${gaps.join('; ')}`);

  await prisma.$disconnect();
  process.exit(gaps.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('校验异常:', e);
  process.exit(3);
});
