import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Request } from 'express';
import { AppModule } from '../src/app.module';
import {
  IdentityProvider,
  VerifiedIdentity,
} from '../src/auth/identity.provider';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/common/database/prisma.service';
import { OrganizationContextService } from '../src/common/tenant/organization-context.service';
import { OrganizationsRepository } from '../src/organizations/organizations.repository';
import { TeamsRepository } from '../src/teams/teams.repository';
import { seedFoundation, ROLE_PERMISSIONS } from '../src/roles/default-roles';
import { PERMISSION_KEYS } from '../src/permissions/default-permissions';

describe('PostgreSQL tenant foundation and API', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orgA: string;
  let orgB: string;
  let userA: string;
  let userB: string;
  let viewer: string;
  let system: string;
  let roleA: string;
  let roleB: string;
  const identities = new Map<string, VerifiedIdentity>();
  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
    ...(orgA ? { 'X-Organization-Id': token === 'b-test' ? orgB : orgA } : {}),
  });
  beforeAll(async () => {
    // The only test double: an explicit test-module provider replacement. All
    // membership, permission, repository, and constraint checks use PostgreSQL.
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentityProvider)
      .useValue({
        resolve: async (req: Request) =>
          identities.get(
            req.headers.authorization?.replace('Bearer ', '') ?? '',
          ) ?? null,
      })
      .compile();
    app = module.createNestApplication();
    configureApp(app, ['http://localhost:5173']);
    await app.init();
    prisma = app.get(PrismaService);
    const actor = async (label: string) =>
      (
        await prisma.user.create({
          data: {
            email: `${label}@example.invalid`,
            firstName: label,
            lastName: 'Test',
            status: 'ACTIVE',
          },
        })
      ).id;
    system = await actor('system');
    userA = await actor('admin-a');
    userB = await actor('admin-b');
    viewer = await actor('viewer');
    identities.set('system-test', { userId: system, systemAdmin: true });
    identities.set('a-test', { userId: userA, systemAdmin: false });
    identities.set('b-test', { userId: userB, systemAdmin: false });
    identities.set('viewer-test', { userId: viewer, systemAdmin: false });
    orgA = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('system-test'))
        .send({ name: 'Organization A', slug: 'organization-a' })
        .expect(201)
    ).body.id;
    orgB = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('system-test'))
        .send({ name: 'Organization B', slug: 'organization-b' })
        .expect(201)
    ).body.id;
    for (const [organizationId, userId, name] of [
      [orgA, userA, 'ORG_ADMIN'],
      [orgB, userB, 'ORG_ADMIN'],
      [orgA, viewer, 'VIEWER'],
    ]) {
      await prisma.organizationMember.create({
        data: {
          organizationId,
          userId,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      const role = await prisma.role.findUniqueOrThrow({
        where: { organizationId_name: { organizationId, name } },
      });
      await prisma.userRole.create({
        data: { organizationId, userId, roleId: role.id },
      });
      if (userId === userA) roleA = role.id;
      if (userId === userB) roleB = role.id;
    }
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  it('keeps health public and unchanged', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
  it('creates an organization together with seven scoped default roles', async () => {
    expect(
      await prisma.organization.findUnique({ where: { id: orgA } }),
    ).toMatchObject({ slug: 'organization-a', status: 'ACTIVE' });
    expect(await prisma.role.count({ where: { organizationId: orgA } })).toBe(
      7,
    );
  });
  it('rejects duplicate organization slugs', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set(auth('system-test'))
      .send({ name: 'Duplicate', slug: 'organization-a' })
      .expect(409);
  });
  it('reads only the verified organization', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}`)
      .set(auth('a-test'))
      .expect(200);
    expect(response.body.id).toBe(orgA);
  });
  it('does not expose an all-organizations endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set(auth('system-test'))
      .expect(404);
  });
  it('creates users without passwords or writable identity links', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth('system-test'))
      .send({
        email: 'New.User@Example.invalid',
        firstName: 'New',
        lastName: 'User',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      email: 'new.user@example.invalid',
      status: 'INVITED',
    });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('identityProviderId');
  });
  it('rejects duplicate normalized emails', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth('system-test'))
      .send({
        email: 'ADMIN-A@EXAMPLE.INVALID',
        firstName: 'A',
        lastName: 'Test',
      })
      .expect(409);
  });
  it('allows a user to read their own profile', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${userA}`)
      .set(auth('a-test'))
      .expect(200);
    expect(response.body.id).toBe(userA);
  });
  it('denies reading an unrelated global user record', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/users/${userB}`)
      .set(auth('a-test'))
      .expect(403);
  });
  it('returns 404 for a missing user to a verified system administrator', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/users/${randomUUID()}`)
      .set(auth('system-test'))
      .expect(404);
  });
  it('creates an invited organization membership', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/members`)
      .set(auth('a-test'))
      .send({ userId: system })
      .expect(201);
    expect(response.body).toMatchObject({
      organizationId: orgA,
      userId: system,
      status: 'INVITED',
      joinedAt: null,
    });
  });
  it('rejects duplicate organization membership', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/members`)
      .set(auth('a-test'))
      .send({ userId: userA })
      .expect(409);
  });
  it('rejects membership referencing a nonexistent user', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/members`)
      .set(auth('a-test'))
      .send({ userId: randomUUID() })
      .expect(409);
  });
  it('creates a team in the verified organization', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('a-test'))
      .send({ name: 'Sales', description: 'Test team' })
      .expect(201);
    expect(response.body).toMatchObject({
      organizationId: orgA,
      name: 'Sales',
    });
  });
  it('rejects a duplicate team name within the same organization', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('a-test'))
      .send({ name: 'Sales' })
      .expect(409);
  });
  it('allows the same team name in another organization', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgB}/teams`)
      .set(auth('b-test'))
      .send({ name: 'Sales' })
      .expect(201);
  });
  it('does not leak organization B teams or members into organization A', async () => {
    const teams = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('a-test'))
      .expect(200);
    expect(teams.body).toHaveLength(1);
    expect(
      teams.body.every(
        (team: { organizationId: string }) => team.organizationId === orgA,
      ),
    ).toBe(true);
    const members = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/members`)
      .set(auth('a-test'))
      .expect(200);
    expect(members.body.length).toBeGreaterThan(0);
    expect(
      members.body.every(
        (member: { organizationId: string }) => member.organizationId === orgA,
      ),
    ).toBe(true);
    expect(
      members.body.map((member: { userId: string }) => member.userId),
    ).not.toContain(userB);
  });
  it('denies organization A access to every organization B route', async () => {
    for (const path of [
      `/organizations/${orgB}`,
      `/organizations/${orgB}/members`,
      `/organizations/${orgB}/teams`,
      `/organizations/${orgB}/roles`,
    ])
      await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set(auth('a-test'))
        .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgB}/teams`)
      .set(auth('a-test'))
      .send({ name: 'Intrusion' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgB}/members`)
      .set(auth('a-test'))
      .send({ userId: userA })
      .expect(403);
  });
  it('rejects spoofed organization and user headers without authentication', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set({
        'x-organization-id': orgA,
        'x-user-id': userA,
        Authorization: 'Bearer invented',
      })
      .expect(401);
  });
  it('rejects body attempts to override organization scope', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('a-test'))
      .send({ name: 'Spoofed', organizationId: orgB })
      .expect(400);
  });
  it('enforces permissions inside a valid membership', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('viewer-test'))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('viewer-test'))
      .send({ name: 'Forbidden' })
      .expect(403);
  });
  it('does not let tenant admins bootstrap global organizations or users', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set(auth('a-test'))
      .send({ name: 'Denied', slug: 'denied' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth('a-test'))
      .send({
        email: 'denied@example.invalid',
        firstName: 'Denied',
        lastName: 'Test',
      })
      .expect(403);
  });
  it('denies inactive users and memberships', async () => {
    await prisma.user.update({
      where: { id: viewer },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('viewer-test'))
      .expect(403);
    await prisma.user.update({
      where: { id: viewer },
      data: { status: 'ACTIVE' },
    });
    await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId: orgA, userId: viewer },
      },
      data: { status: 'REMOVED' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('viewer-test'))
      .expect(403);
  });
  it('denies suspended organizations', async () => {
    await prisma.organization.update({
      where: { id: orgB },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB}/teams`)
      .set(auth('b-test'))
      .expect(403);
    await prisma.organization.update({
      where: { id: orgB },
      data: { status: 'ACTIVE' },
    });
  });
  it.each([
    ['/organizations/not-a-uuid', 'a-test'],
    ['/users/not-a-uuid', 'system-test'],
    ['/organizations/not-a-uuid/teams', 'a-test'],
  ])('rejects invalid UUID in %s', async (path, token) => {
    await request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set(auth(token))
      .expect(400);
  });
  it.each([
    { name: 'Invalid', slug: 'invalid', status: 'UNKNOWN' },
    { name: 'Invalid', slug: 'Bad Slug!' },
    { name: ' ', slug: 'empty-name' },
    { name: 'Invalid', slug: 'invalid-null', status: null },
    { name: 'x'.repeat(161), slug: 'too-long' },
  ])('rejects invalid organization DTO %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set(auth('system-test'))
      .send(body)
      .expect(400);
  });
  it.each([
    { email: 'not-email', firstName: 'Test', lastName: 'Test' },
    { email: 'good@example.invalid', firstName: '', lastName: 'Test' },
    {
      email: 'good@example.invalid',
      firstName: 'Test',
      lastName: 'Test',
      password: 'forbidden',
    },
    {
      email: 'good@example.invalid',
      firstName: 'Test',
      lastName: 'Test',
      identityProviderId: 'forged',
    },
  ])('rejects invalid or unsafe user DTO %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth('system-test'))
      .send(body)
      .expect(400);
  });
  it('validates membership UUID and status', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/members`)
      .set(auth('a-test'))
      .send({ userId: 'bad', status: 'WRONG' })
      .expect(400);
  });
  it('validates team status and pagination bounds', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('a-test'))
      .send({ name: 'Bad', status: 'WRONG' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/teams?limit=101`)
      .set(auth('a-test'))
      .expect(400);
  });
  it('lists only tenant-scoped roles', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/roles`)
      .set(auth('a-test'))
      .expect(200);
    expect(response.body).toHaveLength(7);
    expect(
      response.body.every(
        (role: { organizationId: string }) => role.organizationId === orgA,
      ),
    ).toBe(true);
  });
  it('seeds exactly all 37 permission keys', async () => {
    await prisma.$transaction((tx) => seedFoundation(tx));
    const permissions = await prisma.permission.findMany();
    expect(permissions.map((p) => p.key).sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
    expect(permissions).toHaveLength(37);
  });
  it('seeds all eight default role names and sensible mappings', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug: 'rk-varaha-dev' },
    });
    const roles = await prisma.role.findMany({
      where: {
        OR: [{ organizationId: organization.id }, { organizationId: null }],
      },
      include: { permissions: { include: { permission: true } } },
    });
    expect(roles.map((r) => r.name).sort()).toEqual(
      Object.keys(ROLE_PERMISSIONS).sort(),
    );
    for (const role of roles)
      expect(role.permissions.map((p) => p.permission.key).sort()).toEqual(
        [...ROLE_PERMISSIONS[role.name]].sort(),
      );
    expect(
      roles
        .find((r) => r.name === 'VIEWER')
        ?.permissions.every((p) => p.permission.key.endsWith('.read')),
    ).toBe(true);
  });
  it('seeds idempotently without duplicate rows or personal users', async () => {
    const counts = async () =>
      Promise.all([
        prisma.organization.count(),
        prisma.role.count(),
        prisma.permission.count(),
        prisma.rolePermission.count(),
        prisma.user.count(),
      ]);
    const before = await counts();
    await prisma.$transaction((tx) => seedFoundation(tx));
    expect(await counts()).toEqual(before);
  });
  it('enforces RolePermission uniqueness in PostgreSQL', async () => {
    const mapping = await prisma.rolePermission.findFirstOrThrow();
    await expect(
      prisma.rolePermission.create({
        data: { roleId: mapping.roleId, permissionId: mapping.permissionId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('enforces UserRole uniqueness in PostgreSQL', async () => {
    await expect(
      prisma.userRole.create({
        data: { organizationId: orgA, userId: userA, roleId: roleA },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('blocks cross-tenant role assignment in PostgreSQL', async () => {
    await expect(
      prisma.userRole.create({
        data: { organizationId: orgA, userId: userA, roleId: roleB },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.userRole.count({
        where: { organizationId: orgA, roleId: roleB },
      }),
    ).toBe(0);
  });
  it('blocks cross-tenant role reassignment by UPDATE', async () => {
    const assignment = await prisma.userRole.findFirstOrThrow({
      where: { organizationId: orgA, userId: userA },
    });
    await expect(
      prisma.userRole.update({
        where: { id: assignment.id },
        data: { roleId: roleB },
      }),
    ).rejects.toThrow();
  });
  it('requires membership before assigning a role', async () => {
    await expect(
      prisma.userRole.create({
        data: { organizationId: orgA, userId: userB, roleId: roleA },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('keeps role scope immutable', async () => {
    await expect(
      prisma.role.update({
        where: { id: roleA },
        data: { organizationId: orgB },
      }),
    ).rejects.toThrow();
  });
  it('prevents duplicate global roles and non-SUPER_ADMIN global roles', async () => {
    await expect(
      prisma.role.create({ data: { name: 'SUPER_ADMIN', isSystem: true } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      prisma.role.create({ data: { name: 'ORG_ADMIN', isSystem: true } }),
    ).rejects.toThrow();
  });
  it('allows the explicit global role only through an existing tenant membership', async () => {
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: null, name: 'SUPER_ADMIN' },
    });
    await prisma.userRole.create({
      data: { organizationId: orgA, userId: userA, roleId: role.id },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB}/teams`)
      .set(auth('a-test'))
      .expect(403);
  });
  it('does not casually cascade-delete users or organizations', async () => {
    await expect(
      prisma.user.delete({ where: { id: userA } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.organization.delete({ where: { id: orgA } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('enforces direct database enum and foreign-key constraints', async () => {
    await expect(
      prisma.$executeRaw(
        Prisma.sql`INSERT INTO "Organization" ("name", "slug", "status", "updatedAt") VALUES ('Invalid', 'invalid-db', 'INVALID', NOW())`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.team.create({
        data: { organizationId: randomUUID(), name: 'Orphan' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('rolls back organization creation if a default role cannot be created', async () => {
    // Force a real PostgreSQL failure in this isolated test schema only.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION reject_test_role() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."name" = 'VIEWER' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_role_failure BEFORE INSERT ON "Role" FOR EACH ROW EXECUTE FUNCTION reject_test_role()`,
    );
    try {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('system-test'))
        .send({ name: 'Rollback', slug: 'rollback-test' })
        .expect(500);
      expect(
        await prisma.organization.count({ where: { slug: 'rollback-test' } }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER test_role_failure ON "Role"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION reject_test_role()');
    }
  });
  it('requires verified context even for direct repository calls', async () => {
    expect(() =>
      app.get(TeamsRepository).list({ limit: 50, offset: 0 }),
    ).toThrow();
    expect(() => app.get(OrganizationsRepository).findCurrent()).toThrow();
  });
  it('isolates concurrent tenant repository queries', async () => {
    const context = app.get(OrganizationContextService);
    const repository = app.get(TeamsRepository);
    const results = await Promise.all(
      [
        [orgA, userA],
        [orgB, userB],
      ].map(([organizationId, userId]) =>
        context.run(
          { organizationId, userId, systemAdmin: false },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return repository.list({ limit: 50, offset: 0 });
          },
        ),
      ),
    );
    expect(results[0].every((team) => team.organizationId === orgA)).toBe(true);
    expect(results[1].every((team) => team.organizationId === orgB)).toBe(true);
    expect(results[0]).toHaveLength(1);
    expect(results[1]).toHaveLength(1);
  });
});
