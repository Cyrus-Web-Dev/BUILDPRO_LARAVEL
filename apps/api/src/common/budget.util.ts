import { Prisma } from '@prisma/client';

export type BudgetStatus = 'OK' | 'WARNING' | 'OVER';
export const WARNING_THRESHOLD = 0.8; // peringatan mulai 80% anggaran terpakai

export function budgetStatus(budget: Prisma.Decimal, realized: Prisma.Decimal): BudgetStatus {
  if (budget.lte(0)) return realized.gt(0) ? 'OVER' : 'OK';
  const ratio = realized.div(budget);
  if (ratio.gt(1)) return 'OVER';
  if (ratio.gte(WARNING_THRESHOLD)) return 'WARNING';
  return 'OK';
}

export function usagePercent(budget: Prisma.Decimal, realized: Prisma.Decimal): number {
  if (budget.lte(0)) return 0;
  return realized.div(budget).mul(100).toDecimalPlaces(2).toNumber();
}
