-- Configurable CRM product surface plus sales CRM modules.

ALTER TYPE "RecordResource" ADD VALUE IF NOT EXISTS 'LEADS';
ALTER TYPE "RecordResource" ADD VALUE IF NOT EXISTS 'DEALS';
ALTER TYPE "RecordResource" ADD VALUE IF NOT EXISTS 'TASKS';

ALTER TYPE "ActivitySubjectType" ADD VALUE IF NOT EXISTS 'LEAD';
ALTER TYPE "ActivitySubjectType" ADD VALUE IF NOT EXISTS 'DEAL';
ALTER TYPE "ActivitySubjectType" ADD VALUE IF NOT EXISTS 'TASK';

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LEAD_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LEAD_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'LEAD_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DEAL_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DEAL_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DEAL_STAGE_CHANGED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DEAL_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TASK_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TASK_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TASK_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TASK_ARCHIVED';

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "OrganizationProductConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "companiesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contactsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leadsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dealsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tasksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activitiesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dashboardLabel" VARCHAR(40) NOT NULL DEFAULT 'Dashboard',
    "companiesLabel" VARCHAR(40) NOT NULL DEFAULT 'Companies',
    "contactsLabel" VARCHAR(40) NOT NULL DEFAULT 'Contacts',
    "leadsLabel" VARCHAR(40) NOT NULL DEFAULT 'Leads',
    "dealsLabel" VARCHAR(40) NOT NULL DEFAULT 'Deals',
    "tasksLabel" VARCHAR(40) NOT NULL DEFAULT 'Tasks',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationProductConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationProductConfig_organizationId_key"
ON "OrganizationProductConfig"("organizationId");

ALTER TABLE "OrganizationProductConfig"
ADD CONSTRAINT "OrganizationProductConfig_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "Lead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "companyName" VARCHAR(180),
    "source" VARCHAR(120),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" VARCHAR(5000),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_organizationId_archivedAt_status_idx"
ON "Lead"("organizationId", "archivedAt", "status");
CREATE INDEX "Lead_organizationId_ownerId_idx"
ON "Lead"("organizationId", "ownerId");
CREATE INDEX "Lead_organizationId_email_idx"
ON "Lead"("organizationId", "email");

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "Pipeline" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pipeline_organizationId_name_key"
ON "Pipeline"("organizationId", "name");
CREATE INDEX "Pipeline_organizationId_isActive_idx"
ON "Pipeline"("organizationId", "isActive");

ALTER TABLE "Pipeline"
ADD CONSTRAINT "Pipeline_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "PipelineStage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pipelineId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PipelineStage_probability_check" CHECK ("probability" >= 0 AND "probability" <= 100)
);

CREATE UNIQUE INDEX "PipelineStage_pipelineId_position_key"
ON "PipelineStage"("pipelineId", "position");
CREATE UNIQUE INDEX "PipelineStage_pipelineId_name_key"
ON "PipelineStage"("pipelineId", "name");

ALTER TABLE "PipelineStage"
ADD CONSTRAINT "PipelineStage_pipelineId_fkey"
FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id")
ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "Deal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "companyId" UUID,
    "contactId" UUID,
    "name" VARCHAR(180) NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "closeDate" DATE,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Deal_currency_uppercase_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE INDEX "Deal_organizationId_archivedAt_status_idx"
ON "Deal"("organizationId", "archivedAt", "status");
CREATE INDEX "Deal_organizationId_ownerId_idx"
ON "Deal"("organizationId", "ownerId");
CREATE INDEX "Deal_organizationId_pipelineId_stageId_idx"
ON "Deal"("organizationId", "pipelineId", "stageId");

ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_pipelineId_fkey"
FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_stageId_fkey"
FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Deal"
ADD CONSTRAINT "Deal_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "Task" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,
    "companyId" UUID,
    "contactId" UUID,
    "leadId" UUID,
    "dealId" UUID,
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(5000),
    "dueAt" TIMESTAMPTZ(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_organizationId_archivedAt_status_dueAt_idx"
ON "Task"("organizationId", "archivedAt", "status", "dueAt");
CREATE INDEX "Task_organizationId_assigneeId_status_idx"
ON "Task"("organizationId", "assigneeId", "status");

ALTER TABLE "Task"
ADD CONSTRAINT "Task_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Task"
ADD CONSTRAINT "Task_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Existing organizations receive a safe default product configuration.
INSERT INTO "OrganizationProductConfig" ("organizationId")
SELECT "id" FROM "Organization"
ON CONFLICT ("organizationId") DO NOTHING;

-- Every existing organization receives one default sales pipeline.
INSERT INTO "Pipeline" ("organizationId", "name", "isDefault")
SELECT "id", 'Sales Pipeline', true FROM "Organization"
ON CONFLICT ("organizationId", "name") DO NOTHING;

INSERT INTO "PipelineStage" ("pipelineId", "name", "position", "probability")
SELECT p."id", s."name", s."position", s."probability"
FROM "Pipeline" p
CROSS JOIN (
  VALUES
    ('New', 1, 10),
    ('Qualified', 2, 30),
    ('Proposal', 3, 60),
    ('Negotiation', 4, 80),
    ('Closed Won', 5, 100),
    ('Closed Lost', 6, 0)
) AS s("name", "position", "probability")
WHERE p."isDefault" = true
ON CONFLICT ("pipelineId", "position") DO NOTHING;
