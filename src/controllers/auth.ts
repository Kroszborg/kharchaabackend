import type { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth-service';
import * as R from '../utils/response';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authController = {
  async register(req: Request, res: Response) {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    try {
      const result = await authService.register(parse.data);
      R.created(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
        R.conflict(res, 'Email already registered');
      } else {
        R.serverError(res);
      }
    }
  },

  async login(req: Request, res: Response) {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      R.badRequest(res, 'Validation failed', parse.error.flatten());
      return;
    }

    try {
      const result = await authService.login(parse.data);
      R.ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
        R.unauthorized(res, 'Invalid email or password');
      } else {
        R.serverError(res);
      }
    }
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      R.badRequest(res, 'refreshToken required');
      return;
    }

    try {
      const tokens = await authService.refresh(refreshToken);
      R.ok(res, tokens);
    } catch {
      R.unauthorized(res, 'Invalid or expired refresh token');
    }
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = req.body;
    if (refreshToken && typeof refreshToken === 'string') {
      await authService.logout(refreshToken);
    }
    R.noContent(res);
  },
};
