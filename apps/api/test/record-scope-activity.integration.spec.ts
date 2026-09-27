import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/common/database/prisma.service';
import { configureApp } from '../src/common/configure-app';
import { AppModule } from '../src/app.module';
import {
  IdentityProvider,
  VerifiedIdentity,
} from '../src/auth/identity.provider';
import type { Request } from 'express';
import request from 'supertest';

describe('CRM record scopes and activity timeline', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let adminId: string;
  let salesAId: string;
  let salesBId: string;
  let teamLeadId: string;
  let viewerId: string;
  const identities = new Map<string, VerifiedIdentity>();

  const auth = (token: string) => ({
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
          lastName: 'Scope',
          status: 'ACTIVE',
        },
      });
    }

    const system = await createUser('scope-system');
    const admin = await createUser('scope-admin');
    const salesA = await createUser('scope-sales-a');
    const salesB = await createUser('scope-sales-b');
    const teamLead = await createUser('scope-team-lead');
    const viewer = await createUser('scope-viewer');

    adminId = admin.id;
    salesAId = salesA.id;
    salesBId = salesB.id;
    teamLeadId = teamLead.id;
    viewerId = viewer.id;

    identities.set('scope-system', {
      userId: system.id,
      systemAdmin: true,
    });
    identities.set('scope-admin', {
      userId: adminId,
      systemAdmin: false,
    });
    identities.set('scope-sales-a', {
      userId: salesAId,
      systemAdmin: false,
    });
    identities.set('scope-sales-b', {
      userId: salesBId,
      systemAdmin: false,
    });
    identities.set('scope-team-lead', {
      userId: teamLeadId,
      systemAdmin: false,
    });
    identities.set('scope-viewer', {
      userId: viewerId,
      systemAdmin: false,
    });

    organizationId = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('scope-system'))
        .send({ name: 'Scope Organization', slug: 'scope-organization' })
        .expect(201)
    ).body.id;

    for (const [userId, roleName] of [
      [adminId, 'ORG_ADMIN'],
      [salesAId, 'SALES'],
      [salesBId, 'SALES'],
      [teamLeadId, 'TEAM_LEAD'],
      [viewerId, 'VIEWER'],
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

    const team = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/teams`)
      .set(auth('scope-admin'))
      .send({ name: 'Scope Sales Team' })
      .expect(201);

    for (const userId of [salesAId, teamLeadId]) {
      await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${organizationId}/teams/${team.body.id}/members`,
        )
        .set(auth('scope-admin'))
        .send({ userId })
        .expect(201);
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('reports effective OWN, TEAM, and ORGANIZATION scopes', async () => {
    const sales = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/me/record-scopes`)
      .set(auth('scope-sales-a'))
      .expect(200);
    expect(sales.body).toEqual({ companies: 'OWN', contacts: 'OWN' });

    const lead = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/me/record-scopes`)
      .set(auth('scope-team-lead'))
      .expect(200);
    expect(lead.body).toEqual({ companies: 'TEAM', contacts: 'TEAM' });

    const viewer = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/me/record-scopes`)
      .set(auth('scope-viewer'))
      .expect(200);
    expect(viewer.body).toEqual({
      companies: 'ORGANIZATION',
      contacts: 'ORGANIZATION',
    });
  });

  it('enforces OWN, TEAM, and ORGANIZATION company visibility', async () => {
    const ownA = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-sales-a'))
      .send({ name: 'Owned by Sales A' })
      .expect(201);

    const ownB = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-sales-b'))
      .send({ name: 'Owned by Sales B' })
      .expect(201);

    const salesList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-sales-a'))
      .expect(200);
    expect(
      salesList.body.map((company: { id: string }) => company.id),
    ).toContain(ownA.body.id);
    expect(
      salesList.body.map((company: { id: string }) => company.id),
    ).not.toContain(ownB.body.id);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/companies/${ownB.body.id}`)
      .set(auth('scope-sales-a'))
      .expect(404);

    const teamList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-team-lead'))
      .expect(200);
    expect(
      teamList.body.map((company: { id: string }) => company.id),
    ).toContain(ownA.body.id);
    expect(
      teamList.body.map((company: { id: string }) => company.id),
    ).not.toContain(ownB.body.id);

    const viewerList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-viewer'))
      .expect(200);
    expect(
      viewerList.body.map((company: { id: string }) => company.id),
    ).toEqual(expect.arrayContaining([ownA.body.id, ownB.body.id]));
  });

  it('records immutable system activity and supports scoped notes', async () => {
    const company = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/companies`)
      .set(auth('scope-sales-a'))
      .send({ name: 'Timeline Company' })
      .expect(201);

    const timeline = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/activities`,
      )
      .set(auth('scope-sales-a'))
      .expect(200);

    const createdActivity = timeline.body.find(
      (activity: { type: string }) => activity.type === 'COMPANY_CREATED',
    );
    expect(createdActivity).toBeDefined();

    await expect(
      prisma.activity.update({
        where: { id: createdActivity.id },
        data: { body: 'tamper attempt' },
      }),
    ).rejects.toThrow();

    const note = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/notes`,
      )
      .set(auth('scope-sales-a'))
      .send({ body: 'First customer note' })
      .expect(201);
    expect(note.body).toMatchObject({
      type: 'NOTE',
      body: 'First customer note',
      subjectId: company.body.id,
    });

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/notes/${note.body.id}`,
      )
      .set(auth('scope-sales-a'))
      .send({ body: 'Updated customer note' })
      .expect(200)
      .expect((response) => {
        expect(response.body.body).toBe('Updated customer note');
      });

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/activities`,
      )
      .set(auth('scope-sales-b'))
      .expect(404);

    await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/activities`,
      )
      .set(auth('scope-team-lead'))
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/notes`,
      )
      .set(auth('scope-viewer'))
      .send({ body: 'Viewer cannot write this' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/notes/${note.body.id}`,
      )
      .set(auth('scope-sales-a'))
      .expect(200);

    const afterArchive = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${organizationId}/companies/${company.body.id}/activities`,
      )
      .set(auth('scope-sales-a'))
      .expect(200);
    expect(
      afterArchive.body.map((activity: { id: string }) => activity.id),
    ).not.toContain(note.body.id);
  });

  it('creates custom roles with OWN scope and allows controlled scope changes', async () => {
    const companiesRead = await prisma.permission.findUniqueOrThrow({
      where: { key: 'companies.read' },
    });
    const role = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/roles`)
      .set(auth('scope-admin'))
      .send({
        name: 'Regional Reader',
        permissionIds: [companiesRead.id],
      })
      .expect(201);

    expect(role.body.recordScopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'COMPANIES', scope: 'OWN' }),
        expect.objectContaining({ resource: 'CONTACTS', scope: 'OWN' }),
      ]),
    );

    const updated = await request(app.getHttpServer())
      .put(
        `/api/v1/organizations/${organizationId}/roles/${role.body.id}/record-scopes`,
      )
      .set(auth('scope-admin'))
      .send({
        companies: 'TEAM',
        contacts: 'OWN',
      })
      .expect(200);

    expect(updated.body.recordScopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'COMPANIES', scope: 'TEAM' }),
        expect.objectContaining({ resource: 'CONTACTS', scope: 'OWN' }),
      ]),
    );
  });
});
