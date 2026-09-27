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

describe('organization appearance settings', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgA: string;
  let orgB: string;
  let adminA: string;
  let viewerA: string;
  const identities = new Map<string, VerifiedIdentity>();

  const auth = (token: string, organizationId?: string) => ({
    Authorization: `Bearer ${token}`,
    ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
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
          lastName: 'Appearance',
          status: 'ACTIVE',
        },
      });
    }

    const system = await createUser('appearance-system');
    const admin = await createUser('appearance-admin');
    const viewer = await createUser('appearance-viewer');
    adminA = admin.id;
    viewerA = viewer.id;

    identities.set('appearance-system', {
      userId: system.id,
      systemAdmin: true,
    });
    identities.set('appearance-admin', {
      userId: adminA,
      systemAdmin: false,
    });
    identities.set('appearance-viewer', {
      userId: viewerA,
      systemAdmin: false,
    });

    orgA = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('appearance-system'))
        .send({ name: 'Appearance A', slug: 'appearance-a' })
        .expect(201)
    ).body.id;

    orgB = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('appearance-system'))
        .send({ name: 'Appearance B', slug: 'appearance-b' })
        .expect(201)
    ).body.id;

    for (const [organizationId, userId, roleName] of [
      [orgA, adminA, 'ORG_ADMIN'],
      [orgA, viewerA, 'VIEWER'],
    ] as const) {
      await prisma.organizationMember.create({
        data: {
          organizationId,
          userId,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      const role = await prisma.role.findUniqueOrThrow({
        where: {
          organizationId_name: { organizationId, name: roleName },
        },
      });
      await prisma.userRole.create({
        data: { organizationId, userId, roleId: role.id },
      });
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns safe defaults to any active organization member', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/appearance`)
      .set(auth('appearance-viewer', orgA))
      .expect(200);

    expect(response.body).toMatchObject({
      organizationId: orgA,
      workspaceName: 'RK Varaha CRM',
      primaryColor: '#0f766e',
      accentColor: '#14b8a6',
      sidebarColor: '#0f172a',
      pageBackground: '#f5f7fb',
      surfaceColor: '#ffffff',
    });
  });

  it('allows an organization admin to persist appearance settings', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/appearance`)
      .set(auth('appearance-admin', orgA))
      .send({
        workspaceName: 'RK Varaha Sales CRM',
        primaryColor: '#1d4ed8',
        accentColor: '#38bdf8',
        sidebarColor: '#172554',
        pageBackground: '#eff6ff',
        surfaceColor: '#ffffff',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      organizationId: orgA,
      workspaceName: 'RK Varaha Sales CRM',
      primaryColor: '#1d4ed8',
      accentColor: '#38bdf8',
      sidebarColor: '#172554',
      pageBackground: '#eff6ff',
      surfaceColor: '#ffffff',
    });

    const stored = await prisma.organizationAppearance.findUniqueOrThrow({
      where: { organizationId: orgA },
    });
    expect(stored.workspaceName).toBe('RK Varaha Sales CRM');
    expect(stored.primaryColor).toBe('#1d4ed8');
  });

  it('prevents read-only users from changing appearance', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/appearance`)
      .set(auth('appearance-viewer', orgA))
      .send({
        workspaceName: 'Unauthorized Theme',
        primaryColor: '#000000',
        accentColor: '#000000',
        sidebarColor: '#000000',
        pageBackground: '#000000',
        surfaceColor: '#000000',
      })
      .expect(403);
  });

  it('rejects invalid colors before they reach the database', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/organizations/${orgA}/appearance`)
      .set(auth('appearance-admin', orgA))
      .send({
        workspaceName: 'Invalid Theme',
        primaryColor: 'red',
        accentColor: '#38bdf8',
        sidebarColor: '#172554',
        pageBackground: '#eff6ff',
        surfaceColor: '#ffffff',
      })
      .expect(400);
  });

  it('keeps appearance isolated by organization', async () => {
    const other = await prisma.organizationAppearance.findUnique({
      where: { organizationId: orgB },
    });
    expect(other).toBeNull();
  });

  it('resets the organization theme to defaults', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgA}/appearance`)
      .set(auth('appearance-admin', orgA))
      .expect(200);

    expect(response.body).toMatchObject({
      organizationId: orgA,
      workspaceName: 'RK Varaha CRM',
      primaryColor: '#0f766e',
      accentColor: '#14b8a6',
      sidebarColor: '#0f172a',
      pageBackground: '#f5f7fb',
      surfaceColor: '#ffffff',
    });

    expect(
      await prisma.organizationAppearance.findUnique({
        where: { organizationId: orgA },
      }),
    ).toBeNull();
  });
});
