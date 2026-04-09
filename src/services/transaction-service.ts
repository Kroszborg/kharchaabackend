import { prisma } from '../utils/prisma';
import { invalidateCache } from './analytics-service';

type TxType = 'DEBIT' | 'CREDIT';
type TxSource = 'MANUAL' | 'SMS' | 'EMAIL' | 'IMPORT';

export interface TransactionFilters {
  category?: string;
  type?: TxType;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export interface CreateTransactionInput {
  amount: number;
  type: TxType;
  merchant: string;
  category?: string;
  accountId?: string;
  source?: TxSource;
  timestamp?: Date;
  note?: string;
  metadata?: Record<string, unknown>;
}

async function getOrCreateMerchant(name: string, categoryId?: string) {
  return prisma.merchant.upsert({
    where: { name },
    create: { name, categoryId },
    update: categoryId ? { categoryId } : {},
  });
}

async function resolveCategory(name?: string) {
  if (!name) return null;
  return prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
}

export const transactionService = {
  async create(userId: string, input: CreateTransactionInput) {
    const category = await resolveCategory(input.category);
    const merchant = await getOrCreateMerchant(input.merchant, category?.id);

    const tx = await prisma.transaction.create({
      data: {
        userId,
        amount: input.amount,
        type: input.type,
        merchantId: merchant.id,
        categoryId: category?.id,
        accountId: input.accountId,
        source: input.source ?? 'MANUAL',
        timestamp: input.timestamp ?? new Date(),
        note: input.note,
        metadata: (input.metadata ?? {}) as object,
      },
      include: { merchant: true, category: true },
    });

    // Invalidate cached analytics so next fetch reflects the new transaction
    await invalidateCache(userId);
    return tx;
  },

  async findAll(userId: string, filters: TransactionFilters = {}) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (filters.type) where.type = filters.type;
    if (filters.from || filters.to) {
      where.timestamp = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    if (filters.category) {
      where.category = { name: { equals: filters.category, mode: 'insensitive' } };
    }
    if (filters.search) {
      where.merchant = { name: { contains: filters.search, mode: 'insensitive' } };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { merchant: true, category: true },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total, page, limit, pages: Math.ceil(total / limit) };
  },

  async findById(userId: string, id: string) {
    return prisma.transaction.findFirst({
      where: { id, userId },
      include: { merchant: true, category: true },
    });
  },

  async update(userId: string, id: string, data: Partial<CreateTransactionInput>) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return null;

    const category = data.category ? await resolveCategory(data.category) : undefined;
    const merchant = data.merchant ? await getOrCreateMerchant(data.merchant, category?.id) : undefined;

    return prisma.transaction.update({
      where: { id },
      data: {
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(merchant ? { merchantId: merchant.id } : {}),
        ...(category !== undefined ? { categoryId: category?.id } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.timestamp ? { timestamp: data.timestamp } : {}),
      },
      include: { merchant: true, category: true },
    });
  },

  async delete(userId: string, id: string) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.transaction.delete({ where: { id } });
    return true;
  },

  async bulkCreate(userId: string, inputs: CreateTransactionInput[]) {
    const results = await Promise.allSettled(inputs.map(i => transactionService.create(userId, i)));
    const synced = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { synced, failed };
  },
};
