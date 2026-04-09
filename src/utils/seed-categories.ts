import { prisma } from './prisma';

const SYSTEM_CATEGORIES = [
  { name: 'food',          color: '#FF6135', icon: 'food' },
  { name: 'transport',     color: '#00C2CB', icon: 'transport' },
  { name: 'shopping',      color: '#A855F7', icon: 'shopping' },
  { name: 'utilities',     color: '#3B82F6', icon: 'utilities' },
  { name: 'entertainment', color: '#EC4899', icon: 'entertainment' },
  { name: 'health',        color: '#10B981', icon: 'health' },
  { name: 'salary',        color: '#00D97E', icon: 'salary' },
  { name: 'other',         color: '#6B7280', icon: 'other' },
] as const;

export async function seedSystemCategories() {
  const existing = await prisma.category.count({ where: { isSystem: true } });
  if (existing >= SYSTEM_CATEGORIES.length) return;

  await prisma.category.createMany({
    data: SYSTEM_CATEGORIES.map(c => ({ ...c, isSystem: true })),
    skipDuplicates: true,
  });
}
