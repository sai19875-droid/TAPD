// 税费/运费边界值回归（直接测试真实 lib/billing.ts，服务端权威计费）
// 运行：cd apps/web && npx tsx scripts/billing-regression.ts
import { computeTotals, computeShipping, computeTax } from '../src/lib/billing';

interface Case {
  name: string;
  subtotal: number;
  exp: { shipping: number; tax: number; total: number };
}
const cases: Case[] = [
  { name: 'empty/zero', subtotal: 0, exp: { shipping: 0, tax: 0, total: 0 } },
  { name: 'below threshold (199.99)', subtotal: 199.99, exp: { shipping: 9.99, tax: 16.0, total: 225.98 } },
  { name: 'at threshold (200)', subtotal: 200, exp: { shipping: 0, tax: 16.0, total: 216.0 } },
  { name: 'above threshold (200.01)', subtotal: 200.01, exp: { shipping: 0, tax: 16.0, total: 216.01 } },
  { name: 'retail 353.57 (free ship)', subtotal: 353.57, exp: { shipping: 0, tax: 28.29, total: 381.86 } },
  { name: 'retail 89.99 (flat ship)', subtotal: 89.99, exp: { shipping: 9.99, tax: 7.2, total: 107.18 } },
  { name: 'large 1000', subtotal: 1000, exp: { shipping: 0, tax: 80.0, total: 1080.0 } },
];

let failed = 0;
for (const c of cases) {
  const r = computeTotals(c.subtotal);
  const ok =
    r.shipping === c.exp.shipping && r.tax === c.exp.tax && r.total === c.exp.total;
  if (!ok) failed++;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${c.name.padEnd(26)} subtotal=${c.subtotal} -> ship=${r.shipping} tax=${r.tax} total=${r.total}` +
      (ok ? '' : `  (exp ship=${c.exp.shipping} tax=${c.exp.tax} total=${c.exp.total})`),
  );
  // 单独校验底层函数
  if (computeShipping(c.subtotal) !== c.exp.shipping || computeTax(c.subtotal) !== c.exp.tax) {
    failed++;
    console.log(`   FAIL  raw fn mismatch for ${c.name}`);
  }
}
console.log(failed === 0 ? '\n✅ ALL BILLING TESTS PASSED' : `\n❌ ${failed} BILLING CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
