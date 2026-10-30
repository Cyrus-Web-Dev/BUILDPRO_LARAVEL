import { Prisma } from '@prisma/client';
import { budgetStatus, usagePercent } from './budget.util';

/** Menghitung ulang total realisasi sebuah item RAB (di dalam transaksi) dan menghasilkan alert bila perlu. */
export async function checkItemBudget(
  tx: Prisma.TransactionClient,
  item: { id: string; code: string; name: string; budget: Prisma.Decimal },
) {
  const agg = await tx.realization.aggregate({ where: { rabItemId: item.id }, _sum: { amount: true } });
  const realized = agg._sum.amount ?? new Prisma.Decimal(0);
  const status = budgetStatus(item.budget, realized);
  return {
    item: {
      id: item.id, code: item.code, name: item.name,
      budget: item.budget.toNumber(), realized: realized.toNumber(),
      remaining: item.budget.sub(realized).toNumber(),
      usagePercent: usagePercent(item.budget, realized), status,
    },
    alert:
      status === 'OK'
        ? null
        : {
            level: status,
            message:
              status === 'OVER'
                ? `Biaya "${item.name}" MELEBIHI anggaran RAB`
                : `Biaya "${item.name}" sudah mencapai 80% atau lebih dari anggaran RAB`,
          },
  };
}
