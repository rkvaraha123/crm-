import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request } from 'express';
import { AppModule } from '../src/app.module';
import {
  IdentityProvider,
  VerifiedIdentity,
} from '../src/auth/identity.provider';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/common/database/prisma.service';

describe('CRM core companies, contacts, and teams', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgA: string;
  let orgB: string;
  let adminA: string;
  let adminB: string;
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

    async function user(label: string) {
      return prisma.user.create({
        data: {
          email: `${label}@example.invalid`,
          firstName: label,
          lastName: 'CRM',
          status: 'ACTIVE',
        },
      });
    }

    const system = await user('crm-system');
    const firstAdmin = await user('crm-admin-a');
    const secondAdmin = await user('crm-admin-b');
    const viewer = await user('crm-viewer-a');
    adminA = firstAdmin.id;
    adminB = secondAdmin.id;
    viewerA = viewer.id;

    identities.set('crm-system', {
      userId: system.id,
      systemAdmin: true,
    });
    identities.set('crm-admin-a', {
      userId: adminA,
      systemAdmin: false,
    });
    identities.set('crm-admin-b', {
      userId: adminB,
      systemAdmin: false,
    });
    identities.set('crm-viewer-a', {
      userId: viewerA,
      systemAdmin: false,
    });

    orgA = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('crm-system'))
        .send({ name: 'CRM A', slug: 'crm-core-a' })
        .expect(201)
    ).body.id;

    orgB = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('crm-system'))
        .send({ name: 'CRM B', slug: 'crm-core-b' })
        .expect(201)
    ).body.id;

    for (const [organizationId, userId, roleName] of [
      [orgA, adminA, 'ORG_ADMIN'],
      [orgB, adminB, 'ORG_ADMIN'],
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

  it('creates, searches, updates, and archives a company', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/companies`)
      .set(auth('crm-admin-a', orgA))
      .send({
        name: 'Acme Services',
        domain: 'ACME.EXAMPLE.COM',
        industry: 'Services',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      organizationId: orgA,
      ownerId: adminA,
      name: 'Acme Services',
      domain: 'acme.example.com',
      lifecycleStatus: 'PROSPECT',
    });

    const search = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/companies?search=acme`)
      .set(auth('crm-admin-a', orgA))
      .expect(200);
    expect(search.body.map((company: { id: string }) => company.id)).toContain(
      created.body.id,
    );

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${orgA}/companies/${created.body.id}`,
      )
      .set(auth('crm-admin-a', orgA))
      .send({ lifecycleStatus: 'CUSTOMER' })
      .expect(200)
      .expect((response) => {
        expect(response.body.lifecycleStatus).toBe('CUSTOMER');
      });

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${orgA}/companies/${created.body.id}`,
      )
      .set(auth('crm-admin-a', orgA))
      .expect(200);

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${orgA}/companies/${created.body.id}`,
      )
      .set(auth('crm-admin-a', orgA))
      .expect(404);
  });

  it('prevents cross-tenant company access', async () => {
    const company = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/companies`)
      .set(auth('crm-admin-a', orgA))
      .send({ name: 'Tenant A Only' })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${orgB}/companies/${company.body.id}`,
      )
      .set(auth('crm-admin-b', orgB))
      .expect(404);
  });

  it('creates a contact linked only to a same-tenant company', async () => {
    const companyA = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/companies`)
      .set(auth('crm-admin-a', orgA))
      .send({ name: 'Contact Company A' })
      .expect(201);

    const companyB = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgB}/companies`)
      .set(auth('crm-admin-b', orgB))
      .send({ name: 'Contact Company B' })
      .expect(201);

    const contact = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/contacts`)
      .set(auth('crm-admin-a', orgA))
      .send({
        firstName: 'Rahul',
        lastName: 'Customer',
        email: 'CUSTOMER@EXAMPLE.COM',
        companyId: companyA.body.id,
      })
      .expect(201);

    expect(contact.body).toMatchObject({
      organizationId: orgA,
      ownerId: adminA,
      email: 'customer@example.com',
      companyId: companyA.body.id,
    });

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${orgA}/contacts/${contact.body.id}`,
      )
      .set(auth('crm-admin-a', orgA))
      .send({ companyId: companyB.body.id })
      .expect(400);
  });

  it('enforces CRM permissions for read-only users', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/companies`)
      .set(auth('crm-viewer-a', orgA))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/companies`)
      .set(auth('crm-viewer-a', orgA))
      .send({ name: 'Denied write' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA}/contacts`)
      .set(auth('crm-viewer-a', orgA))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/contacts`)
      .set(auth('crm-viewer-a', orgA))
      .send({ firstName: 'Denied', lastName: 'Write' })
      .expect(403);
  });

  it('manages team membership only inside the verified organization', async () => {
    const team = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgA}/teams`)
      .set(auth('crm-admin-a', orgA))
      .send({ name: 'Sales Team' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${orgA}/teams/${team.body.id}/members`,
      )
      .set(auth('crm-admin-a', orgA))
      .send({ userId: viewerA })
      .expect(201);

    const members = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${orgA}/teams/${team.body.id}/members`,
      )
      .set(auth('crm-admin-a', orgA))
      .expect(200);
    expect(
      members.body.map((member: { userId: string }) => member.userId),
    ).toContain(viewerA);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${orgA}/teams/${team.body.id}/members`,
      )
      .set(auth('crm-admin-a', orgA))
      .send({ userId: adminB })
      .expect(400);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${orgA}/teams/${team.body.id}/members/${viewerA}`,
      )
      .set(auth('crm-admin-a', orgA))
      .expect(200);
  });
});
