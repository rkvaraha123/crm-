import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtVerifierService } from '../src/auth/jwt-verifier.service';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/common/database/prisma.service';
import { PERMISSION_KEYS } from '../src/permissions/default-permissions';
import {
  createDefaultRoles,
  ROLE_PERMISSIONS,
  seedFoundation,
} from '../src/roles/default-roles';
import { jwtFixture } from './jwt-fixture';

describe('enterprise RBAC integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: Awaited<ReturnType<typeof jwtFixture>>;
  let authorization: AuthorizationService;
  let orgA: string;
  let orgB: string;
  let adminId: string;
  let managerId: string;
  let targetId: string;
  let foreignId: string;
  const subjects = {
    admin: 'rbac-admin-subject',
    manager: 'rbac-manager-subject',
    target: 'rbac-target-subject',
    foreign: 'rbac-foreign-subject',
  };

  const bearer = async (subject: string) => ({
    Authorization: `Bearer ${await fixture.token({ sub: subject })}`,
    'X-Organization-Id': orgA,
  });

  async function role(organizationId: string, name: string) {
    return prisma.role.findUniqueOrThrow({
      where: { organizationId_name: { organizationId, name } },
    });
  }

  async function assign(
    organizationId: string,
    userId: string,
    roleName: string,
  ) {
    const selected = await role(organizationId, roleName);
    await prisma.userRole.create({
      data: { organizationId, userId, roleId: selected.id },
    });
    return selected;
  }

  beforeAll(async () => {
    fixture = await jwtFixture();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JwtVerifierService)
      .useValue(new JwtVerifierService(new ConfigService(fixture.config)))
      .compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);
    authorization = app.get(AuthorizationService);
    await prisma.$transaction((tx) => seedFoundation(tx));

    for (const slug of ['rbac-a', 'rbac-b']) {
      const organization = await prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: { name: slug, slug },
        });
        await createDefaultRoles(tx, created.id);
        return created;
      });
      if (slug === 'rbac-a') orgA = organization.id;
      else orgB = organization.id;
    }

    const users = await Promise.all(
      Object.entries(subjects).map(([name, identityProviderId]) =>
        prisma.user.create({
          data: {
            email: `rbac-${name}@example.invalid`,
            firstName: name,
            lastName: 'RBAC',
            status: 'ACTIVE',
            identityProviderId,
          },
        }),
      ),
    );
    [adminId, managerId, targetId, foreignId] = users.map(({ id }) => id);
    await prisma.organizationMember.createMany({
      data: [
        [orgA, adminId],
        [orgA, managerId],
        [orgA, targetId],
        [orgB, foreignId],
      ].map(([organizationId, userId]) => ({
        organizationId,
        userId,
        status: 'ACTIVE' as const,
        joinedAt: new Date(),
      })),
    });
    await assign(orgA, adminId, 'ORG_ADMIN');
    await assign(orgA, managerId, 'MANAGER');
  });

  afterAll(async () => {
    if (app) await app.close();
    if (fixture) await fixture.close();
  });

  it('keeps self access available without users.read', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set(await bearer(subjects.target))
      .expect(200);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/me/permissions`)
      .set(await bearer(subjects.target))
      .expect(200);
    expect(response.body).toEqual({ permissions: [] });
  });

  it('returns 403 when authenticated but missing the required permission', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.target))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.manager))
      .expect(200);
  });

  it('unions permissions from multiple roles without duplicates', async () => {
    await assign(orgA, targetId, 'VIEWER');
    await assign(orgA, targetId, 'SUPPORT');
    const permissions = await authorization.getEffectivePermissions(
      targetId,
      orgA,
    );
    expect(permissions).toContain('organizations.read');
    expect(permissions).toContain('tasks.create');
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  it.each([
    ['SUPER_ADMIN', 'settings.update', true],
    ['ORG_ADMIN', 'settings.update', true],
    ['MANAGER', 'deals.update', true],
    ['MANAGER', 'settings.update', false],
    ['TEAM_LEAD', 'reports.read', true],
    ['SALES', 'tasks.delete', true],
    ['MARKETING', 'leads.create', true],
    ['MARKETING', 'deals.create', false],
    ['SUPPORT', 'tasks.update', true],
    ['SUPPORT', 'leads.read', false],
    ['VIEWER', 'organizations.read', true],
    ['VIEWER', 'organizations.update', false],
  ] as const)(
    'resolves %s permission %s as %s',
    async (roleName, permission, expected) => {
      const user = await prisma.user.create({
        data: {
          email: `matrix-${roleName.toLowerCase()}-${permission.replace('.', '-')}@example.invalid`,
          firstName: 'Matrix',
          lastName: roleName,
          status: 'ACTIVE',
        },
      });
      await prisma.organizationMember.create({
        data: {
          organizationId: orgA,
          userId: user.id,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      const selected =
        roleName === 'SUPER_ADMIN'
          ? await prisma.role.findFirstOrThrow({
              where: { organizationId: null, name: roleName },
            })
          : await role(orgA, roleName);
      await prisma.userRole.create({
        data: { organizationId: orgA, userId: user.id, roleId: selected.id },
      });
      expect(
        (await authorization.getEffectivePermissions(user.id, orgA)).includes(
          permission,
        ),
      ).toBe(expected);
    },
  );

  it('blocks manager role administration and ordinary SUPER_ADMIN assignment', async () => {
    const viewerRole = await role(orgA, 'VIEWER');
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.manager))
      .send({ roleIds: [viewerRole.id] })
      .expect(403);
    const superAdmin = await prisma.role.findFirstOrThrow({
      where: { organizationId: null, name: 'SUPER_ADMIN' },
    });
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [superAdmin.id] })
      .expect(400);
  });

  it('derives platform administration only from the PostgreSQL SUPER_ADMIN role', async () => {
    const identityProviderId = 'rbac-platform-subject';
    const platform = await prisma.user.create({
      data: {
        email: 'rbac-platform@example.invalid',
        firstName: 'Platform',
        lastName: 'Admin',
        status: 'ACTIVE',
        identityProviderId,
      },
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: orgA,
        userId: platform.id,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    const superAdmin = await prisma.role.findFirstOrThrow({
      where: { organizationId: null, name: 'SUPER_ADMIN' },
    });
    await prisma.userRole.create({
      data: {
        organizationId: orgA,
        userId: platform.id,
        roleId: superAdmin.id,
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set({
        Authorization: `Bearer ${await fixture.token({ sub: identityProviderId })}`,
      })
      .send({ name: 'RBAC Platform Created', slug: 'rbac-platform-created' })
      .expect(201);
  });

  it('blocks self-elevation, foreign roles, and foreign users', async () => {
    const adminRole = await role(orgA, 'ORG_ADMIN');
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${adminId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [adminRole.id] })
      .expect(403);
    const foreignRole = await role(orgB, 'VIEWER');
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [foreignRole.id] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${foreignId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [adminRole.id] })
      .expect(404);
  });

  it('supports custom roles and applies permission removal immediately', async () => {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: ['teams.read', 'teams.create'] } },
    });
    const created = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/roles`)
      .set(await bearer(subjects.admin))
      .send({
        name: 'Team Creator',
        description: 'Custom team role',
        permissionIds: permissions.map(({ id }) => id),
      })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'Team Creator',
      organizationId: orgA,
      isSystem: false,
    });
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [created.body.id] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.target))
      .send({ name: 'Created before revocation' })
      .expect(201);
    const read = permissions.find(({ key }) => key === 'teams.read')!;
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/roles/${created.body.id}/permissions`)
      .set(await bearer(subjects.admin))
      .send({ permissionIds: [read.id] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.target))
      .send({ name: 'Denied after revocation' })
      .expect(403);
  });

  it('applies role removal immediately', async () => {
    const viewerRole = await role(orgA, 'VIEWER');
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [viewerRole.id] })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.target))
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [] })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(await bearer(subjects.target))
      .expect(403);
  });

  it('protects system roles from edits and deletion', async () => {
    const systemRole = await role(orgA, 'VIEWER');
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgA}/roles/${systemRole.id}`)
      .set(await bearer(subjects.admin))
      .send({ name: 'Compromised' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgA}/roles/${systemRole.id}`)
      .set(await bearer(subjects.admin))
      .expect(403);
  });

  it('reserves built-in role names for system roles', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/roles`)
      .set(await bearer(subjects.admin))
      .send({ name: 'SUPER_ADMIN', permissionIds: [] })
      .expect(409);
  });

  it('rejects duplicate, malformed, and nonexistent authorization IDs', async () => {
    const viewerRole = await role(orgA, 'VIEWER');
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: [viewerRole.id, viewerRole.id] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/users/${targetId}/roles`)
      .set(await bearer(subjects.admin))
      .send({ roleIds: ['not-a-uuid'] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/roles`)
      .set(await bearer(subjects.admin))
      .send({
        name: 'Invalid permissions',
        permissionIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400);
  });

  it('preserves the complete default mapping catalog', () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(8);
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(PERMISSION_KEYS).toEqual(
      expect.arrayContaining([
        'activities.read',
        'notes.create',
        'notes.update',
        'notes.delete',
      ]),
    );
  });
});
