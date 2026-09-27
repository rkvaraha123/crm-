-- CRM Core V1: team membership, companies, contacts.

CREATE TYPE "CompanyLifecycleStatus" AS ENUM ('PROSPECT', 'CUSTOMER', 'PARTNER', 'OTHER');
CREATE TYPE "ContactLifecycleStatus" AS ENUM ('LEAD', 'PROSPECT', 'CUSTOMER', 'OTHER');

CREATE TABLE "TeamMember" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Company" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "domain" VARCHAR(255),
  "phone" VARCHAR(40),
  "website" VARCHAR(2048),
  "industry" VARCHAR(120),
  "lifecycleStatus" "CompanyLifecycleStatus" NOT NULL DEFAULT 'PROSPECT',
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "companyId" UUID,
  "firstName" VARCHAR(80) NOT NULL,
  "lastName" VARCHAR(80) NOT NULL,
  "email" VARCHAR(254),
  "phone" VARCHAR(40),
  "jobTitle" VARCHAR(120),
  "lifecycleStatus" "ContactLifecycleStatus" NOT NULL DEFAULT 'LEAD',
  "archivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamMember_organizationId_teamId_userId_key"
  ON "TeamMember"("organizationId", "teamId", "userId");
CREATE INDEX "TeamMember_organizationId_userId_idx"
  ON "TeamMember"("organizationId", "userId");
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

CREATE INDEX "Company_organizationId_archivedAt_name_idx"
  ON "Company"("organizationId", "archivedAt", "name");
CREATE INDEX "Company_organizationId_ownerId_idx"
  ON "Company"("organizationId", "ownerId");
CREATE INDEX "Company_organizationId_lifecycleStatus_idx"
  ON "Company"("organizationId", "lifecycleStatus");

CREATE INDEX "Contact_organizationId_archivedAt_lastName_firstName_idx"
  ON "Contact"("organizationId", "archivedAt", "lastName", "firstName");
CREATE INDEX "Contact_organizationId_ownerId_idx"
  ON "Contact"("organizationId", "ownerId");
CREATE INDEX "Contact_organizationId_companyId_idx"
  ON "Contact"("organizationId", "companyId");
CREATE INDEX "Contact_organizationId_lifecycleStatus_idx"
  ON "Contact"("organizationId", "lifecycleStatus");
CREATE INDEX "Contact_organizationId_email_idx"
  ON "Contact"("organizationId", "email");

ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_name_nonempty_check"
  CHECK (length(btrim("name")) > 0);
ALTER TABLE "Company"
  ADD CONSTRAINT "Company_domain_normalized_check"
  CHECK ("domain" IS NULL OR ("domain" = lower(btrim("domain")) AND length("domain") > 0));
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_first_name_nonempty_check"
  CHECK (length(btrim("firstName")) > 0);
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_last_name_nonempty_check"
  CHECK (length(btrim("lastName")) > 0);
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_email_normalized_check"
  CHECK ("email" IS NULL OR ("email" = lower(btrim("email")) AND length("email") > 0));

CREATE FUNCTION enforce_team_member_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Team"
    WHERE "id" = NEW."teamId"
      AND "organizationId" = NEW."organizationId"
      AND "status" <> 'ARCHIVED'
  ) THEN
    RAISE EXCEPTION 'Team must belong to the membership organization'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = NEW."organizationId"
      AND "userId" = NEW."userId"
      AND "status" <> 'REMOVED'
  ) THEN
    RAISE EXCEPTION 'User must belong to the organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "TeamMember_tenant_check"
  BEFORE INSERT OR UPDATE ON "TeamMember"
  FOR EACH ROW EXECUTE FUNCTION enforce_team_member_tenant();

CREATE FUNCTION enforce_company_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = NEW."organizationId"
      AND "userId" = NEW."ownerId"
      AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Company owner must be an active organization member'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Company_tenant_check"
  BEFORE INSERT OR UPDATE ON "Company"
  FOR EACH ROW EXECUTE FUNCTION enforce_company_tenant();

CREATE FUNCTION enforce_contact_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = NEW."organizationId"
      AND "userId" = NEW."ownerId"
      AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Contact owner must be an active organization member'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."companyId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Company"
    WHERE "id" = NEW."companyId"
      AND "organizationId" = NEW."organizationId"
      AND "archivedAt" IS NULL
  ) THEN
    RAISE EXCEPTION 'Contact company must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Contact_tenant_check"
  BEFORE INSERT OR UPDATE ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_tenant();
