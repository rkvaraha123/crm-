import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  IdentityProvider,
  VerifiedIdentity,
} from '../src/auth/identity.provider';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/common/database/prisma.service';

describe('CRM platform admin control plane', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let anchorOrganizationId: string;
  let customerOrganizationId: string;
  let platformAdminId: string;
  let normalUserId: string;

  const identities = new Map<string, VerifiedIdentity>();

  const auth = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
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

    async function createUser(label: string) {
      return prisma.user.create({
        data: {
          email: `${label}@example.invalid`,
          firstName: label,
          lastName: 'ControlPlane',
          status: 'ACTIVE',
        },
      });
    }

    const bootstrap = await createUser('control-bootstrap');
    const platformAdmin = await createUser('control-admin');
    const normalUser = await createUser('control-user');

    platformAdminId = platformAdmin.id;
    normalUserId = normalUser.id;

    identities.set('control-bootstrap', {
      userId: bootstrap.id,
      systemAdmin: true,
    });
    identities.set('control-admin', {
      userId: platformAdmin.id,
      systemAdmin: false,
    });
    identities.set('control-user', {
      userId: normalUser.id,
      systemAdmin: false,
    });

    anchorOrganizationId = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('control-bootstrap'))
        .send({ name: 'Control Anchor', slug: 'control-anchor' })
        .expect(201)
    ).body.id;

    customerOrganizationId = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('control-bootstrap'))
        .send({ name: 'Control Customer', slug: 'control-customer' })
        .expect(201)
    ).body.id;

    for (const userId of [platformAdmin.id, normalUser.id]) {
      await prisma.organizationMember.create({
        data: {
          organizationId: anchorOrganizationId,
          userId,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    }

    let globalRole = await prisma.role.findFirst({
      where: {
        organizationId: null,
        name: 'SUPER_ADMIN',
        isSystem: true,
      },
    });

    globalRole ??= await prisma.role.create({
      data: {
        organizationId: null,
        name: 'SUPER_ADMIN',
        description: 'Platform administrator',
        isSystem: true,
      },
    });

    await prisma.userRole.create({
      data: {
        organizationId: anchorOrganizationId,
        userId: platformAdmin.id,
        roleId: globalRole.id,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('allows only platform administrators into the control plane', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set(auth('control-user'))
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set(auth('control-admin'))
      .expect(200);

    expect(response.body).toMatchObject({
      id: platformAdminId,
      platformAdmin: true,
      status: 'ACTIVE',
    });
  });

  it('returns platform-wide metrics and database health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .set(auth('control-admin'))
      .expect(200);

    expect(response.body.organizations).toBeGreaterThanOrEqual(2);
    expect(response.body.users).toBeGreaterThanOrEqual(3);
    expect(response.body.database).toBe('healthy');
  });

  it('lists organizations and safely changes customer tenant status', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/organizations?limit=100&search=Control')
      .set(auth('control-admin'))
      .expect(200);

    expect(
      list.body.map((organization: { id: string }) => organization.id),
    ).toEqual(
      expect.arrayContaining([anchorOrganizationId, customerOrganizationId]),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/organizations/${customerOrganizationId}/status`)
      .set(auth('control-admin'))
      .send({ status: 'SUSPENDED' })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('SUSPENDED');
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/organizations/${anchorOrganizationId}/status`)
      .set(auth('control-admin'))
      .send({ status: 'SUSPENDED' })
      .expect(403);

    await prisma.organization.update({
      where: { id: customerOrganizationId },
      data: { status: 'ACTIVE' },
    });
  });

  it('lists users and protects platform administrators from lockout', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=100&search=control')
      .set(auth('control-admin'))
      .expect(200);

    const admin = list.body.find(
      (user: { id: string }) => user.id === platformAdminId,
    );
    expect(admin.platformAdmin).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${platformAdminId}/status`)
      .set(auth('control-admin'))
      .send({ status: 'DISABLED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${normalUserId}/status`)
      .set(auth('control-admin'))
      .send({ status: 'SUSPENDED' })
      .expect(200);

    await prisma.user.update({
      where: { id: normalUserId },
      data: { status: 'ACTIVE' },
    });
  });

  it('manages tenant appearance through the platform admin API', async () => {
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/admin/organizations/${customerOrganizationId}/appearance`)
      .set(auth('control-admin'))
      .send({
        workspaceName: 'Customer CRM',
        primaryColor: '#1d4ed8',
        accentColor: '#38bdf8',
        sidebarColor: '#172554',
        pageBackground: '#eff6ff',
        surfaceColor: '#ffffff',
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      organizationId: customerOrganizationId,
      workspaceName: 'Customer CRM',
      primaryColor: '#1d4ed8',
    });

    await request(app.getHttpServer())
      .delete(
        `/api/v1/admin/organizations/${customerOrganizationId}/appearance`,
      )
      .set(auth('control-admin'))
      .expect(200)
      .expect((response) => {
        expect(response.body.workspaceName).toBe('RK Varaha CRM');
      });
  });
});
