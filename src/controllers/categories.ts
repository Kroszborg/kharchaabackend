import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import * as R from '../utils/response';

export const categoriesController = {
  async list(_req: Request, res: Response) {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    R.ok(res, categories);
  },
};
