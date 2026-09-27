import { CrmModuleKey, type Prisma } from '@prisma/client';

export const CRM_MODULE_CATALOG = [
  {
    key: CrmModuleKey.COMPANIES,
    label: 'Companies',
    description: 'Business accounts and organizations',
    navOrder: 10,
  },
  {
    key: CrmModuleKey.CONTACTS,
    label: 'Contacts',
    description: 'People and customer relationships',
    navOrder: 20,
  },
  {
    key: CrmModuleKey.LEADS,
    label: 'Leads',
    description: 'Prospects before qualification',
    navOrder: 30,
  },
  {
    key: CrmModuleKey.DEALS,
    label: 'Deals',
    description: 'Sales pipelines and opportunities',
    navOrder: 40,
  },
  {
    key: CrmModuleKey.TASKS,
    label: 'Tasks',
    description: 'Follow-ups and work management',
    navOrder: 50,
  },
  {
    key: CrmModuleKey.REPORTS,
    label: 'Reports',
    description: 'CRM performance and pipeline insights',
    navOrder: 60,
  },
  {
    key: CrmModuleKey.TEAM,
    label: 'Team',
    description: 'Teams and members',
    navOrder: 70,
  },
] as const;

export async function seedOrganizationProduct(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  await tx.organizationModule.createMany({
    data: CRM_MODULE_CATALOG.map((module) => ({
      organizationId,
      key: module.key,
      enabled: true,
      label: module.label,
      description: module.description,
      navOrder: module.navOrder,
    })),
    skipDuplicates: true,
  });

  let pipeline = await tx.pipeline.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name: 'Sales Pipeline',
      },
    },
  });

  pipeline ??= await tx.pipeline.create({
    data: {
      organizationId,
      name: 'Sales Pipeline',
      isDefault: true,
      active: true,
    },
  });

  const stages = [
    ['New', 10, 10],
    ['Qualified', 20, 30],
    ['Proposal', 30, 60],
    ['Negotiation', 40, 80],
    ['Won', 50, 100],
    ['Lost', 60, 0],
  ] as const;

  await tx.pipelineStage.createMany({
    data: stages.map(([name, position, probability]) => ({
      organizationId,
      pipelineId: pipeline.id,
      name,
      position,
      probability,
      active: true,
    })),
    skipDuplicates: true,
  });
}
