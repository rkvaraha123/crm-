import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { bootstrapAdmin } from '../apps/api/src/auth/bootstrap-admin';
import { KeycloakAdminService } from '../apps/api/src/auth/keycloak-admin.service';
import { validateEnvironment } from '../apps/api/src/common/environment';
const prisma = new PrismaClient();
async function main() {
  const config = new ConfigService(validateEnvironment(process.env));
  await bootstrapAdmin(prisma, new KeycloakAdminService(config), process.env);
  console.info(
    'Explicit administrator bootstrap completed. Existing identity and tenant safeguards preserved.',
  );
}
void main()
  .catch(() => {
    console.error(
      'Bootstrap refused or failed. Check explicit identity, verified email, existing account status, seed, and service-account configuration.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
