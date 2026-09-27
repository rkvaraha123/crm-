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

describe('CRM product platform sales flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let foreignOrganizationId: string;
  let salesUserId: string;

  const identities = new Map<string, VerifiedIdentity>();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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

    const system = await prisma.user.create({
      data: {
        email: 'product-system@example.invalid',
        firstName: 'Product',
        lastName: 'System',
        status: 'ACTIVE',
      },
    });
    const sales = await prisma.user.create({
      data: {
        email: 'product-sales@example.invalid',
        firstName: 'Product',
        lastName: 'Sales',
        status: 'ACTIVE',
      },
    });
    salesUserId = sales.id;

    identities.set('product-system', {
      userId: system.id,
      systemAdmin: true,
    });
    identities.set('product-sales', {
      userId: sales.id,
      systemAdmin: false,
    });

    organizationId = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('product-system'))
        .send({ name: 'Product CRM', slug: 'product-crm' })
        .expect(201)
    ).body.id;

    foreignOrganizationId = (
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set(auth('product-system'))
        .send({ name: 'Foreign Product CRM', slug: 'foreign-product-crm' })
        .expect(201)
    ).body.id;

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: sales.id,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    const salesRole = await prisma.role.findFirstOrThrow({
      where: { organizationId, name: 'SALES', isSystem: true },
    });
    await prisma.userRole.create({
      data: {
        organizationId,
        userId: sales.id,
        roleId: salesRole.id,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('lets platform admin configure the tenant product without code changes', async () => {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/admin/organizations/${organizationId}/product-config`)
      .set(auth('product-system'))
      .send({
        leadsEnabled: true,
        dealsEnabled: true,
        tasksEnabled: true,
        leadsLabel: 'Prospects',
        dealsLabel: 'Opportunities',
        tasksLabel: 'Follow-ups',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      organizationId,
      leadsEnabled: true,
      dealsEnabled: true,
      tasksEnabled: true,
      leadsLabel: 'Prospects',
      dealsLabel: 'Opportunities',
      tasksLabel: 'Follow-ups',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/product-config`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .expect(200)
      .expect((tenantResponse) => {
        expect(tenantResponse.body.dealsLabel).toBe('Opportunities');
      });

    await request(app.getHttpServer())
      .put(`/api/v1/admin/organizations/${organizationId}/product-config`)
      .set(auth('product-system'))
      .send({ leadsEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/leads`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .expect(403);

    await request(app.getHttpServer())
      .put(`/api/v1/admin/organizations/${organizationId}/product-config`)
      .set(auth('product-system'))
      .send({ leadsEnabled: true })
      .expect(200);
  });

  it('supports lead to deal to follow-up workflow', async () => {
    const lead = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/leads`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha@example.invalid',
        companyName: 'Example Services',
        source: 'Website',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationId}/leads/${lead.body.id}`,
      )
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({ status: 'QUALIFIED' })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('QUALIFIED');
      });

    const pipelines = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/pipelines`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .expect(200);

    expect(pipelines.body).toHaveLength(1);
    expect(pipelines.body[0].stages.length).toBeGreaterThanOrEqual(6);

    const pipeline = pipelines.body[0];
    const deal = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/deals`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({
        name: 'Example Services Retainer',
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0].id,
        amount: 25000,
        currency: 'INR',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationId}/deals/${deal.body.id}`,
      )
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({ stageId: pipeline.stages[1].id })
      .expect(200)
      .expect((response) => {
        expect(response.body.stageId).toBe(pipeline.stages[1].id);
      });

    const task = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/tasks`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({
        title: 'Send proposal',
        dealId: deal.body.id,
        priority: 'HIGH',
      })
      .expect(201);

    expect(task.body).toMatchObject({
      assigneeId: salesUserId,
      dealId: deal.body.id,
      priority: 'HIGH',
      status: 'OPEN',
    });

    await request(app.getHttpServer())
      .patch(
        `/api/v1/organizations/${organizationId}/tasks/${task.body.id}`,
      )
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({ status: 'COMPLETED' })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('COMPLETED');
        expect(response.body.completedAt).toBeTruthy();
      });
  });

  it('rejects cross-tenant associations in deals', async () => {
    const foreignCompany = await prisma.company.create({
      data: {
        organizationId: foreignOrganizationId,
        ownerId: salesUserId,
        name: 'Foreign Company',
      },
    });

    const pipelines = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/pipelines`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/deals`)
      .set(auth('product-sales'))
      .set('X-Organization-Id', organizationId)
      .send({
        name: 'Cross tenant attempt',
        pipelineId: pipelines.body[0].id,
        stageId: pipelines.body[0].stages[0].id,
        companyId: foreignCompany.id,
      })
      .expect(400);
  });
});
