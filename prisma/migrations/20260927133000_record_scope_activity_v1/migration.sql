-- Record-level access scopes and CRM activity timeline.

CREATE TYPE "RecordResource" AS ENUM ('COMPANIES', 'CONTACTS');
CREATE TYPE "RecordScope" AS ENUM ('OWN', 'TEAM', 'ORGANIZATION');
CREATE TYPE "ActivitySubjectType" AS ENUM ('COMPANY', 'CONTACT');
CREATE TYPE "ActivityType" AS ENUM (
  'NOTE',
  'COMPANY_CREATED',
  'COMPANY_UPDATED',
  'COMPANY_ARCHIVED',
  'CONTACT_CREATED',
  'CONTACT_UPDATED',
  'CONTACT_ARCHIVED'
);

CREATE TABLE "RoleRecordScope" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roleId" UUID NOT NULL,
  "resource" "RecordResource" NOT NULL,
  "scope" "RecordScope" NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RoleRecordScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleRecordScope_roleId_resource_key"
  ON "RoleRecordScope"("roleId", "resource");
CREATE INDEX "RoleRecordScope_resource_scope_idx"
  ON "RoleRecordScope"("resource", "scope");

ALTER TABLE "RoleRecordScope"
  ADD CONSTRAINT "RoleRecordScope_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id")
  ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "Activity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "subjectType" "ActivitySubjectType" NOT NULL,
  "subjectId" UUID NOT NULL,
  "type" "ActivityType" NOT NULL,
  "body" VARCHAR(10000),
  "metadata" JSONB,
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Activity_org_subject_archived_created_idx"
  ON "Activity"("organizationId", "subjectType", "subjectId", "archivedAt", "createdAt");
CREATE INDEX "Activity_org_actor_created_idx"
  ON "Activity"("organizationId", "actorUserId", "createdAt");

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_note_body_check"
  CHECK (
    "type" <> 'NOTE'
    OR ("body" IS NOT NULL AND length(btrim("body")) > 0)
  );

CREATE FUNCTION enforce_activity_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = NEW."organizationId"
      AND "userId" = NEW."actorUserId"
      AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Activity actor must be an active organization member'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."subjectType" = 'COMPANY' AND NOT EXISTS (
    SELECT 1 FROM "Company"
    WHERE "id" = NEW."subjectId"
      AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Activity company must belong to the organization'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."subjectType" = 'CONTACT' AND NOT EXISTS (
    SELECT 1 FROM "Contact"
    WHERE "id" = NEW."subjectId"
      AND "organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Activity contact must belong to the organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Activity_tenant_check"
  BEFORE INSERT OR UPDATE ON "Activity"
  FOR EACH ROW EXECUTE FUNCTION enforce_activity_tenant();

CREATE FUNCTION protect_activity_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Activity history cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."type" <> 'NOTE' THEN
    RAISE EXCEPTION 'System activity history is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."organizationId" <> OLD."organizationId"
    OR NEW."actorUserId" <> OLD."actorUserId"
    OR NEW."subjectType" <> OLD."subjectType"
    OR NEW."subjectId" <> OLD."subjectId"
    OR NEW."type" <> OLD."type"
    OR NEW."createdAt" <> OLD."createdAt"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
  THEN
    RAISE EXCEPTION 'Note identity and history fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Activity_history_protection"
  BEFORE UPDATE OR DELETE ON "Activity"
  FOR EACH ROW EXECUTE FUNCTION protect_activity_history();

-- New permissions are inserted at migration time so existing tenants receive them.
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES
  (gen_random_uuid(), 'activities.read', 'activities: read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notes.create', 'notes: create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notes.update', 'notes: update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notes.delete', 'notes: delete', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Apply note/activity permissions to existing system roles.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."key" IN (
  'activities.read', 'notes.create', 'notes.update', 'notes.delete'
)
WHERE r."isSystem" = true
  AND r."name" IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEAM_LEAD', 'SALES')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."key" IN (
  'activities.read', 'notes.create', 'notes.update'
)
WHERE r."isSystem" = true
  AND r."name" IN ('MARKETING', 'SUPPORT')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."key" = 'activities.read'
WHERE r."isSystem" = true
  AND r."name" = 'VIEWER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Existing custom roles fail closed at organization boundaries but retain
-- usable CRM access by defaulting to OWN until an administrator widens them.
INSERT INTO "RoleRecordScope" (
  "id", "roleId", "resource", "scope", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  r."id",
  resource.value::"RecordResource",
  'OWN'::"RecordScope",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN (VALUES ('COMPANIES'), ('CONTACTS')) AS resource(value)
WHERE r."isSystem" = false
ON CONFLICT ("roleId", "resource") DO NOTHING;

-- Default record scopes for current system roles.
INSERT INTO "RoleRecordScope" (
  "id", "roleId", "resource", "scope", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  r."id",
  resource.value::"RecordResource",
  CASE
    WHEN r."name" IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'MARKETING', 'SUPPORT', 'VIEWER')
      THEN 'ORGANIZATION'::"RecordScope"
    WHEN r."name" = 'TEAM_LEAD'
      THEN 'TEAM'::"RecordScope"
    ELSE 'OWN'::"RecordScope"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN (VALUES ('COMPANIES'), ('CONTACTS')) AS resource(value)
WHERE r."isSystem" = true
  AND r."name" IN (
    'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEAM_LEAD',
    'SALES', 'MARKETING', 'SUPPORT', 'VIEWER'
  )
ON CONFLICT ("roleId", "resource") DO NOTHING;
