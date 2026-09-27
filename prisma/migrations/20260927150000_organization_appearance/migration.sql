-- Organization-scoped CRM appearance settings.

CREATE TABLE "OrganizationAppearance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "workspaceName" VARCHAR(80) NOT NULL DEFAULT 'RK Varaha CRM',
  "primaryColor" VARCHAR(7) NOT NULL DEFAULT '#0f766e',
  "accentColor" VARCHAR(7) NOT NULL DEFAULT '#14b8a6',
  "sidebarColor" VARCHAR(7) NOT NULL DEFAULT '#0f172a',
  "pageBackground" VARCHAR(7) NOT NULL DEFAULT '#f5f7fb',
  "surfaceColor" VARCHAR(7) NOT NULL DEFAULT '#ffffff',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OrganizationAppearance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAppearance_organizationId_key"
  ON "OrganizationAppearance"("organizationId");

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_workspace_name_check"
  CHECK (length(btrim("workspaceName")) BETWEEN 1 AND 80);

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_primary_color_check"
  CHECK ("primaryColor" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_accent_color_check"
  CHECK ("accentColor" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_sidebar_color_check"
  CHECK ("sidebarColor" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_page_background_check"
  CHECK ("pageBackground" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "OrganizationAppearance"
  ADD CONSTRAINT "OrganizationAppearance_surface_color_check"
  CHECK ("surfaceColor" ~ '^#[0-9A-Fa-f]{6}$');
