import type { Request, Response } from 'express';
import { z } from 'zod';
import { transactionService, type CreateTransactionInput } from '../services/transaction-service';
import { prisma } from '../utils/prisma';
import * as R from '../utils/response';

const syncPushSchema = z.object({
  transactions: z.array(z.object({
    id: z.string(),
    amount: z.number().positive(),
    type: z.enum(['DEBIT', 'CREDIT']),
    merchant: z.string().min(1),
    category: z.string().optional(),
    source: z.enum(['MANUAL', 'SMS', 'EMAIL', 'IMPORT']).optional(),
    timestamp: z.string().datetime(),
    note: z.string().optional(),
  })).min(1).max(500),
});

export const syncController = {
  async push(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parse = syncPushSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    const inputs: CreateTransactionInput[] = parse.data.transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      merchant: t.merchant,
      category: t.category,
      source: t.source ?? 'MANUAL',
      timestamp: new Date(t.timestamp),
      note: t.note,
    }));

    const result = await transactionService.bulkCreate(userId, inputs);
    R.ok(res, result);
  },

  async pull(req: Request, res: Response) {
    const userId = req.user!.userId;
    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);

    const transactions = await prisma.transaction.findMany({
      where: { userId, updatedAt: { gt: since } },
      include: { merchant: true, category: true },
      orderBy: { updatedAt: 'asc' },
    });

    R.ok(res, { transactions, pulledAt: new Date().toISOString() });
  },
};
