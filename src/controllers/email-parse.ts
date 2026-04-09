import type { Request, Response } from 'express';
import { z } from 'zod';
import { emailParserService } from '../services/email-parser-service';
import * as R from '../utils/response';

const singleSchema = z.object({
  body: z.string().min(1).max(10_000),
});

const bulkSchema = z.object({
  emails: z.array(z.string().min(1).max(10_000)).min(1).max(100),
});

export const emailParseController = {
  parse(req: Request, res: Response) {
    const parse = singleSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }
    const result = emailParserService.parse(parse.data.body);
    R.ok(res, result);
  },

  parseBulk(req: Request, res: Response) {
    const parse = bulkSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }
    const results = emailParserService.parseBulk(parse.data.emails);
    R.ok(res, {
      results,
      parsed: results.filter(Boolean).length,
      failed: results.filter(r => r === null).length,
    });
  },
};
