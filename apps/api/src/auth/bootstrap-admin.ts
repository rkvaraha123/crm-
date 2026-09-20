import { Prisma, PrismaClient } from '@prisma/client';
import { isEmail, isUUID } from 'class-validator';
import { KeycloakAdminService } from './keycloak-admin.service';
export async function bootstrapAdmin(
  prisma: PrismaClient,
  admin: KeycloakAdminService,
  env: Record<string, string | undefined>,
) {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const subject = env.BOOTSTRAP_ADMIN_IDENTITY_ID;
  const roleName = env.BOOTSTRAP_ADMIN_ROLE || 'ORG_ADMIN';
  if (
    !email ||
    !isEmail(email) ||
    !subject ||
    !isUUID(subject) ||
    !['ORG_ADMIN', 'SUPER_ADMIN'].includes(roleName)
  )
    throw new Error(
      'Explicit bootstrap email, identity UUID, and supported role required',
    );
  const matches = await admin.findUsers(email);
  if (matches.length !== 1 || matches[0].id !== subject)
    throw new Error('Ambiguous or mismatched bootstrap identity');
  const identity = await admin.getUser(subject);
  if (
    !identity.enabled ||
    !identity.emailVerified ||
    identity.email?.toLowerCase() !== email ||
    !identity.firstName ||
    !identity.lastName
  )
    throw new Error(
      'Bootstrap identity must be enabled, verified, and have names',
    );
  return prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { slug: env.BOOTSTRAP_ORGANIZATION_SLUG || 'rk-varaha-dev' },
      });
      if (organization.status !== 'ACTIVE')
        throw new Error('Bootstrap organization must be active');
      const bySubject = await tx.user.findUnique({
        where: { identityProviderId: subject },
      });
      const byEmail = await tx.user.findUnique({ where: { email } });
      if (
        (bySubject && bySubject.email !== email) ||
        (byEmail?.identityProviderId &&
          byEmail.identityProviderId !== subject) ||
        (byEmail && !['ACTIVE', 'INVITED'].includes(byEmail.status))
      )
        throw new Error('Conflicting or blocked CRM identity');
      const user = byEmail
        ? await tx.user.update({
            where: { id: byEmail.id },
            data: { identityProviderId: subject, status: 'ACTIVE' },
          })
        : await tx.user.create({
            data: {
              email,
              firstName: identity.firstName!,
              lastName: identity.lastName!,
              identityProviderId: subject,
              status: 'ACTIVE',
            },
          });
      const current = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
      });
      if (current && !['ACTIVE', 'INVITED'].includes(current.status))
        throw new Error('Existing membership is blocked');
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        update: { status: 'ACTIVE', joinedAt: current?.joinedAt ?? new Date() },
      });
      const role = await tx.role.findFirstOrThrow({
        where: {
          organizationId: roleName === 'SUPER_ADMIN' ? null : organization.id,
          name: roleName,
          isSystem: true,
        },
      });
      await tx.userRole.upsert({
        where: {
          organizationId_userId_roleId: {
            organizationId: organization.id,
            userId: user.id,
            roleId: role.id,
          },
        },
        create: {
          organizationId: organization.id,
          userId: user.id,
          roleId: role.id,
        },
        update: {},
      });
      return user.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
