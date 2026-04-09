import type { Request, Response } from 'express';
import { z } from 'zod';
import { transactionService } from '../services/transaction-service';
import * as R from '../utils/response';

const createSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['DEBIT', 'CREDIT']),
  merchant: z.string().min(1).max(200),
  category: z.string().optional(),
  accountId: z.string().optional(),
  source: z.enum(['MANUAL', 'SMS', 'EMAIL', 'IMPORT']).optional(),
  timestamp: z.string().optional(),
  note: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = createSchema.partial();

const bulkSchema = z.object({
  transactions: z.array(createSchema).min(1).max(500),
});

function parseTimestamp(ts?: string) {
  return ts ? new Date(ts) : undefined;
}

export const transactionsController = {
  async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const q = req.query as Record<string, string | undefined>;

    const result = await transactionService.findAll(userId, {
      category: q.category,
      type: q.type as 'DEBIT' | 'CREDIT' | undefined,
      search: q.search,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page: q.page ? parseInt(q.page, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });

    R.ok(res, result);
  },

  async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parse = createSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    const tx = await transactionService.create(userId, {
      ...parse.data,
      timestamp: parseTimestamp(parse.data.timestamp),
    });
    R.created(res, tx);
  },

  async getOne(req: Request, res: Response) {
    const userId = req.user!.userId;
    const tx = await transactionService.findById(userId, String(req.params.id));
    if (!tx) R.notFound(res, 'Transaction');
    else R.ok(res, tx);
  },

  async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    const tx = await transactionService.update(userId, String(req.params.id), {
      ...parse.data,
      timestamp: parseTimestamp(parse.data.timestamp),
    });
    if (!tx) R.notFound(res, 'Transaction');
    else R.ok(res, tx);
  },

  async remove(req: Request, res: Response) {
    const userId = req.user!.userId;
    const deleted = await transactionService.delete(userId, String(req.params.id));
    if (!deleted) R.notFound(res, 'Transaction');
    else R.noContent(res);
  },

  async bulk(req: Request, res: Response) {
    const userId = req.user!.userId;
    const parse = bulkSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    const result = await transactionService.bulkCreate(
      userId,
      parse.data.transactions.map(t => ({ ...t, timestamp: parseTimestamp(t.timestamp) })),
    );
    R.created(res, result);
  },
};
