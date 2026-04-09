import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, refreshTokenExpiresAt } from '../utils/jwt';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function buildTokens(userId: string, email: string): AuthTokens {
  return {
    accessToken: signAccessToken({ userId, email }),
    refreshToken: signRefreshToken({ userId, email }),
  };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new Error('EMAIL_TAKEN');

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const tokens = buildTokens(user.id, user.email);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt: refreshTokenExpiresAt() },
    });

    return { user, ...tokens };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new Error('INVALID_CREDENTIALS');

    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const tokens = buildTokens(user.id, user.email);
    await prisma.refreshToken.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt: refreshTokenExpiresAt() },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      ...tokens,
    };
  },

  async refresh(token: string) {
    const payload = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.userId !== payload.userId || stored.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // Rotate: delete old, issue new pair
    await prisma.refreshToken.delete({ where: { token } });
    const tokens = buildTokens(payload.userId, payload.email);
    await prisma.refreshToken.create({
      data: { userId: payload.userId, token: tokens.refreshToken, expiresAt: refreshTokenExpiresAt() },
    });

    return tokens;
  },

  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  },
};
