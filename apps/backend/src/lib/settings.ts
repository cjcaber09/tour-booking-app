import { prisma } from './prisma';

export async function getOrCreateSettings() {
  return prisma.appSettings.upsert({
    where: { key: 'singleton' },
    update: {},
    create: { key: 'singleton' },
  });
}
