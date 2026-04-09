import { prisma } from '../utils/prisma';

// ── Cache helpers ──────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getCached<T>(userId: string, type: string, period: string): Promise<T | null> {
  const row = await prisma.insightsCache.findUnique({
    where: { userId_type_period: { userId, type, period } },
  });
  if (!row) return null;
  if (Date.now() - row.generatedAt.getTime() > CACHE_TTL_MS) return null;
  return row.data as T;
}

async function setCache(userId: string, type: string, period: string, data: unknown) {
  await prisma.insightsCache.upsert({
    where: { userId_type_period: { userId, type, period } },
    create: { userId, type, period, data: data as object },
    update: { data: data as object, generatedAt: new Date() },
  });
}

export function invalidateCache(userId: string) {
  return prisma.insightsCache.deleteMany({ where: { userId } });
}

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// ── Summary ────────────────────────────────────────────────────────────────────
export type MonthlySummary = {
  year: number;
  month: number;
  totalSpend: number;
  totalIncome: number;
  netFlow: number;
  transactionCount: number;
  debitCount: number;
};

export const analyticsService = {
  async getMonthlySummary(userId: string, year: number, month: number): Promise<MonthlySummary> {
    const period = periodKey(year, month);
    const cached = await getCached<MonthlySummary>(userId, 'summary', period);
    if (cached) return cached;

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const [debits, credits, count] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'DEBIT', timestamp: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'CREDIT', timestamp: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: { userId, timestamp: { gte: from, lte: to } } }),
    ]);

    const result: MonthlySummary = {
      year,
      month,
      totalSpend: debits._sum.amount ?? 0,
      totalIncome: credits._sum.amount ?? 0,
      netFlow: (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0),
      transactionCount: count,
      debitCount: debits._count,
    };

    await setCache(userId, 'summary', period, result);
    return result;
  },

  async getCategoryBreakdown(userId: string, year: number, month: number) {
    const period = periodKey(year, month);
    const cached = await getCached<unknown[]>(userId, 'categories', period);
    if (cached) return cached;

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const rows = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'DEBIT', timestamp: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const totalSpend = rows.reduce((s: number, r: typeof rows[0]) => s + (r._sum.amount ?? 0), 0);

    const breakdown = await Promise.all(
      rows.map(async (row: typeof rows[0]) => {
        const category = row.categoryId
          ? await prisma.category.findUnique({ where: { id: row.categoryId } })
          : null;
        const total = row._sum.amount ?? 0;
        return {
          categoryId: row.categoryId,
          name: category?.name ?? 'other',
          color: category?.color ?? '#6B7280',
          total,
          count: row._count,
          percentage: totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0,
        };
      }),
    );

    await setCache(userId, 'categories', period, breakdown);
    return breakdown;
  },

  async getTopMerchants(userId: string, year: number, month: number, limit = 5) {
    const period = periodKey(year, month);
    const cacheKey = `merchants_${limit}`;
    const cached = await getCached<unknown[]>(userId, cacheKey, period);
    if (cached) return cached;

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    const rows = await prisma.transaction.groupBy({
      by: ['merchantId'],
      where: { userId, type: 'DEBIT', timestamp: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const result = await Promise.all(
      rows.map(async (row: typeof rows[0]) => {
        const merchant = row.merchantId
          ? await prisma.merchant.findUnique({ where: { id: row.merchantId } })
          : null;
        return {
          merchantId: row.merchantId,
          name: merchant?.name ?? 'Unknown',
          total: row._sum.amount ?? 0,
          count: row._count,
        };
      }),
    );

    await setCache(userId, cacheKey, period, result);
    return result;
  },

  async getBehavioralInsights(userId: string, year: number, month: number): Promise<string[]> {
    const period = periodKey(year, month);
    const cached = await getCached<string[]>(userId, 'insights', period);
    if (cached) return cached;

    const now = new Date(year, month - 1);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const [current, previous] = await Promise.all([
      analyticsService.getMonthlySummary(userId, year, month),
      analyticsService.getMonthlySummary(userId, prevYear, prevMonth),
    ]);

    const breakdown = await analyticsService.getCategoryBreakdown(userId, year, month);
    const insights: string[] = [];

    // Spend vs previous month
    if (previous.totalSpend > 0 && current.totalSpend > 0) {
      const delta = ((current.totalSpend - previous.totalSpend) / previous.totalSpend) * 100;
      if (delta < -10) {
        insights.push(`Spent ${Math.abs(Math.round(delta))}% less than last month — great progress!`);
      } else if (delta > 20) {
        insights.push(`Spending up ${Math.round(delta)}% vs last month. Worth reviewing.`);
      }
    }

    // Savings rate
    if (current.totalIncome > 0) {
      const rate = Math.round(((current.totalIncome - current.totalSpend) / current.totalIncome) * 100);
      if (rate >= 30) {
        insights.push(`Saving ${rate}% of income this month — excellent!`);
      } else if (rate > 0) {
        insights.push(`Saving ${rate}% of income — room to grow.`);
      } else if (rate < 0) {
        insights.push('Spending exceeded income this month. Consider reviewing subscriptions.');
      }
    }

    // Top category dominance
    if (Array.isArray(breakdown) && breakdown.length > 0) {
      const top = breakdown[0] as { name: string; percentage: number };
      if (top.percentage > 40) {
        insights.push(`${top.name} accounts for ${top.percentage}% of spending — your biggest category.`);
      }
    }

    // Transaction frequency
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysPassed = Math.min(now.getDate(), daysInMonth);
    if (current.debitCount > 0 && daysPassed > 7) {
      const dailyRate = current.debitCount / daysPassed;
      if (dailyRate > 3) {
        insights.push(`Averaging ${dailyRate.toFixed(1)} transactions/day — high activity month.`);
      }
    }

    if (insights.length === 0) {
      insights.push('Add more transactions to unlock personalized insights.');
    }

    await setCache(userId, 'insights', period, insights);
    return insights;
  },
};
