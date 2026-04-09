import type { Request, Response } from 'express';
import { analyticsService } from '../services/analytics-service';
import * as R from '../utils/response';

function parsePeriod(query: Record<string, string | undefined>) {
  const now = new Date();
  const year = parseInt(query.year ?? String(now.getFullYear()), 10);
  const month = parseInt(query.month ?? String(now.getMonth() + 1), 10);
  return { year, month };
}

export const analyticsController = {
  async summary(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { year, month } = parsePeriod(req.query as Record<string, string | undefined>);
    const data = await analyticsService.getMonthlySummary(userId, year, month);
    R.ok(res, data);
  },

  async categories(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { year, month } = parsePeriod(req.query as Record<string, string | undefined>);
    const data = await analyticsService.getCategoryBreakdown(userId, year, month);
    R.ok(res, data);
  },

  async merchants(req: Request, res: Response) {
    const userId = req.user!.userId;
    const q = req.query as Record<string, string | undefined>;
    const { year, month } = parsePeriod(q);
    const limit = parseInt(q.limit ?? '5', 10);
    const data = await analyticsService.getTopMerchants(userId, year, month, limit);
    R.ok(res, data);
  },

  async insights(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { year, month } = parsePeriod(req.query as Record<string, string | undefined>);
    const data = await analyticsService.getBehavioralInsights(userId, year, month);
    R.ok(res, data);
  },
};
