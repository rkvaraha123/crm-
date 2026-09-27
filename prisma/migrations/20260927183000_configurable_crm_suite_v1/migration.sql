-- Configurable CRM modules and HubSpot-style sales workspace.

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

CREATE TYPE "CrmModuleKey" AS ENUM (
  'COMPANIES',
  'CONTACTS',
  'LEADS',
  'DEALS',
  'TASKS',
  'REPORTS',
  'TEAM'
);

CREATE TYPE "CustomFieldEntity" AS ENUM (
  'COMPANY',
  'CONTACT',
  'LEAD',
  'DEAL',
  'TASK'
);

CREATE TYPE "CustomFieldType" AS ENUM (
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT'
);

CREATE TYPE "LeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED'
);

CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

CREATE TYPE "TaskStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "TaskSubjectType" AS ENUM ('COMPANY', 'CONTACT', 'LEAD', 'DEAL');

ALTER TABLE "Company" ADD COLUMN "customFields" JSONB;
ALTER TABLE "Contact" ADD COLUMN "customFields" JSONB;

CREATE TABLE "OrganizationModule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "key" "CrmModuleKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "label" VARCHAR(80) NOT NULL,
  "description" VARCHAR(255),
  "navOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationModule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "OrganizationModule_organizationId_key_key"
  ON "OrganizationModule"("organizationId", "key");
CREATE INDEX "OrganizationModule_organizationId_enabled_navOrder_idx"
  ON "OrganizationModule"("organizationId", "enabled", "navOrder");

CREATE TABLE "CustomFieldDefinition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "entity" "CustomFieldEntity" NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "fieldType" "CustomFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "options" JSONB,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomFieldDefinition_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT "CustomFieldDefinition_key_format_check"
    CHECK ("key" ~ '^[a-z][a-z0-9_]{0,79}$')
);

CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_entity_key_key"
  ON "CustomFieldDefinition"("organizationId", "entity", "key");
CREATE INDEX "CustomFieldDefinition_organizationId_entity_active_displayOrder_idx"
  ON "CustomFieldDefinition"("organizationId", "entity", "active", "displayOrder");

CREATE TABLE "Lead" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "firstName" VARCHAR(80),
  "lastName" VARCHAR(80),
  "companyName" VARCHAR(180),
  "email" VARCHAR(254),
  "phone" VARCHAR(40),
  "source" VARCHAR(120),
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "customFields" JSONB,
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lead_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Lead_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "Lead_organizationId_archivedAt_status_createdAt_idx"
  ON "Lead"("organizationId", "archivedAt", "status", "createdAt");
CREATE INDEX "Lead_organizationId_ownerId_idx"
  ON "Lead"("organizationId", "ownerId");
CREATE INDEX "Lead_organizationId_email_idx"
  ON "Lead"("organizationId", "email");

CREATE TABLE "Pipeline" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Pipeline_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "Pipeline_organizationId_name_key"
  ON "Pipeline"("organizationId", "name");
CREATE UNIQUE INDEX "Pipeline_id_organizationId_key"
  ON "Pipeline"("id", "organizationId");
CREATE UNIQUE INDEX "Pipeline_one_default_per_org"
  ON "Pipeline"("organizationId") WHERE "isDefault" = true;
CREATE INDEX "Pipeline_organizationId_active_idx"
  ON "Pipeline"("organizationId", "active");

CREATE TABLE "PipelineStage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL,
  "probability" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PipelineStage_probability_check"
    CHECK ("probability" >= 0 AND "probability" <= 100),
  CONSTRAINT "PipelineStage_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "PipelineStage_pipelineId_organizationId_fkey"
    FOREIGN KEY ("pipelineId", "organizationId")
    REFERENCES "Pipeline"("id", "organizationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "PipelineStage_pipelineId_position_key"
  ON "PipelineStage"("pipelineId", "position");
CREATE UNIQUE INDEX "PipelineStage_id_pipelineId_organizationId_key"
  ON "PipelineStage"("id", "pipelineId", "organizationId");
CREATE INDEX "PipelineStage_organizationId_pipelineId_active_idx"
  ON "PipelineStage"("organizationId", "pipelineId", "active");

CREATE TABLE "Deal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "stageId" UUID NOT NULL,
  "companyId" UUID,
  "contactId" UUID,
  "name" VARCHAR(180) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
  "closeDate" DATE,
  "customFields" JSONB,
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Deal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Deal_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Deal_pipelineId_organizationId_fkey"
    FOREIGN KEY ("pipelineId", "organizationId")
    REFERENCES "Pipeline"("id", "organizationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Deal_stageId_pipelineId_organizationId_fkey"
    FOREIGN KEY ("stageId", "pipelineId", "organizationId")
    REFERENCES "PipelineStage"("id", "pipelineId", "organizationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Deal_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Deal_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "Deal_organizationId_archivedAt_status_createdAt_idx"
  ON "Deal"("organizationId", "archivedAt", "status", "createdAt");
CREATE INDEX "Deal_organizationId_ownerId_idx"
  ON "Deal"("organizationId", "ownerId");
CREATE INDEX "Deal_organizationId_pipelineId_stageId_idx"
  ON "Deal"("organizationId", "pipelineId", "stageId");
CREATE INDEX "Deal_organizationId_companyId_idx"
  ON "Deal"("organizationId", "companyId");
CREATE INDEX "Deal_organizationId_contactId_idx"
  ON "Deal"("organizationId", "contactId");

CREATE TABLE "Task" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "assigneeId" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "description" VARCHAR(5000),
  "dueAt" TIMESTAMPTZ(3),
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "subjectType" "TaskSubjectType",
  "subjectId" UUID,
  "customFields" JSONB,
  "completedAt" TIMESTAMPTZ(3),
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Task_subject_pair_check"
    CHECK (("subjectType" IS NULL AND "subjectId" IS NULL) OR ("subjectType" IS NOT NULL AND "subjectId" IS NOT NULL)),
  CONSTRAINT "Task_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Task_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "Task_organizationId_archivedAt_status_dueAt_idx"
  ON "Task"("organizationId", "archivedAt", "status", "dueAt");
CREATE INDEX "Task_organizationId_assigneeId_idx"
  ON "Task"("organizationId", "assigneeId");
CREATE INDEX "Task_organizationId_subjectType_subjectId_idx"
  ON "Task"("organizationId", "subjectType", "subjectId");

INSERT INTO "OrganizationModule"
  ("organizationId", "key", "enabled", "label", "description", "navOrder")
SELECT o."id", seed."key"::"CrmModuleKey", true, seed."label", seed."description", seed."navOrder"
FROM "Organization" o
CROSS JOIN (
  VALUES
    ('COMPANIES', 'Companies', 'Business accounts and organizations', 10),
    ('CONTACTS', 'Contacts', 'People and customer relationships', 20),
    ('LEADS', 'Leads', 'Prospects before qualification', 30),
    ('DEALS', 'Deals', 'Sales pipelines and opportunities', 40),
    ('TASKS', 'Tasks', 'Follow-ups and work management', 50),
    ('REPORTS', 'Reports', 'CRM performance and pipeline insights', 60),
    ('TEAM', 'Team', 'Teams and members', 70)
) AS seed("key", "label", "description", "navOrder");

INSERT INTO "Pipeline" ("organizationId", "name", "isDefault", "active")
SELECT "id", 'Sales Pipeline', true, true
FROM "Organization";

INSERT INTO "PipelineStage"
  ("organizationId", "pipelineId", "name", "position", "probability", "active")
SELECT p."organizationId", p."id", stage."name", stage."position", stage."probability", true
FROM "Pipeline" p
CROSS JOIN (
  VALUES
    ('New', 10, 10),
    ('Qualified', 20, 30),
    ('Proposal', 30, 60),
    ('Negotiation', 40, 80),
    ('Won', 50, 100),
    ('Lost', 60, 0)
) AS stage("name", "position", "probability")
WHERE p."name" = 'Sales Pipeline' AND p."isDefault" = true;
