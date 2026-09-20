import { PrismaClient } from '@prisma/client';
import { seedFoundation } from '../apps/api/src/roles/default-roles';
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed is disabled in production');
  await prisma.$transaction((tx) => seedFoundation(tx), { timeout: 30000 });
  console.info(
    'Development organization, 8 default roles, and 37 permissions seeded.',
  );
}
void main()
  .catch(() => {
    console.error('Seed failed; check configuration and migration status.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
