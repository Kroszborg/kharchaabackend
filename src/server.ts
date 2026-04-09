import 'dotenv/config';
import app from './app';
import { prisma } from './utils/prisma';
import { seedSystemCategories } from './utils/seed-categories';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function main() {
  // Verify DB connection
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  // Seed system categories if not already present
  await seedSystemCategories();
  console.log('[DB] System categories ready');

  app.listen(PORT, () => {
    console.log(`[Server] Kharchaaa backend running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

main().catch(err => {
  console.error('[Fatal] Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
