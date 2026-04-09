import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema } from 'zod';
import { badRequest } from '../utils/response';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      badRequest(res, 'Validation failed', result.error.flatten());
      return;
    }
    req.body = result.data;
    next();
  };
}
