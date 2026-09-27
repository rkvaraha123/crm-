import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmModuleKey,
  CustomFieldEntity,
  CustomFieldType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/database/prisma.service';
import { OrganizationContextService } from '../common/tenant/organization-context.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import { UpdateCrmModuleDto } from './dto/update-crm-module.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { CRM_MODULE_CATALOG } from './crm-modules';

function catalogItem(key: CrmModuleKey) {
  const item = CRM_MODULE_CATALOG.find((candidate) => candidate.key === key);
  if (!item) throw new BadRequestException('Unsupported CRM module');
  return item;
}

@Injectable()
export class CrmConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: OrganizationContextService,
  ) {}

  async listModules(organizationId = this.context.requireOrganization()) {
    const stored = await this.prisma.organizationModule.findMany({
      where: { organizationId },
      orderBy: [{ navOrder: 'asc' }, { key: 'asc' }],
    });
    const byKey = new Map(stored.map((item) => [item.key, item]));
    return CRM_MODULE_CATALOG.map((item) => {
      const row = byKey.get(item.key);
      return (
        row ?? {
          id: null,
          organizationId,
          key: item.key,
          enabled: true,
          label: item.label,
          description: item.description,
          navOrder: item.navOrder,
          createdAt: null,
          updatedAt: null,
        }
      );
    }).sort((a, b) => a.navOrder - b.navOrder || a.label.localeCompare(b.label));
  }

  async isEnabled(key: CrmModuleKey) {
    const organizationId = this.context.requireOrganization();
    const row = await this.prisma.organizationModule.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: { enabled: true },
    });
    return row?.enabled ?? true;
  }

  async updateModule(
    organizationId: string,
    key: CrmModuleKey,
    data: UpdateCrmModuleDto,
  ) {
    const defaults = catalogItem(key);
    await this.assertOrganization(organizationId);
    return this.prisma.organizationModule.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: {
        organizationId,
        key,
        enabled: data.enabled ?? true,
        label: data.label ?? defaults.label,
        description: data.description ?? defaults.description,
        navOrder: data.navOrder ?? defaults.navOrder,
      },
      update: data,
    });
  }

  async listCustomFields(
    organizationId: string,
    entity?: CustomFieldEntity,
    activeOnly = false,
  ) {
    await this.assertOrganization(organizationId);
    return this.prisma.customFieldDefinition.findMany({
      where: {
        organizationId,
        ...(entity ? { entity } : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: [{ entity: 'asc' }, { displayOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async listTenantCustomFields(entity?: CustomFieldEntity) {
    return this.listCustomFields(
      this.context.requireOrganization(),
      entity,
      true,
    );
  }

  private normalizedOptions(
    fieldType: CustomFieldType,
    options: string[] | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (fieldType !== CustomFieldType.SELECT) return Prisma.JsonNull;
    const normalized = [
      ...new Set(
        (options ?? [])
          .map((option) => option.trim())
          .filter((option) => option.length > 0),
      ),
    ];
    if (normalized.length < 1)
      throw new BadRequestException('Select fields require at least one option');
    return normalized;
  }

  async createCustomField(
    organizationId: string,
    data: CreateCustomFieldDto,
  ) {
    await this.assertOrganization(organizationId);
    const options = this.normalizedOptions(data.fieldType, data.options);
    return this.prisma.customFieldDefinition.create({
      data: {
        organizationId,
        entity: data.entity,
        key: data.key,
        label: data.label,
        fieldType: data.fieldType,
        required: data.required ?? false,
        options,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }

  async updateCustomField(
    organizationId: string,
    fieldId: string,
    data: UpdateCustomFieldDto,
  ) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, organizationId },
    });
    if (!field) throw new NotFoundException('Custom field not found');
    const fieldType = data.fieldType ?? field.fieldType;
    const options =
      data.fieldType !== undefined || data.options !== undefined
        ? this.normalizedOptions(fieldType, data.options)
        : undefined;
    return this.prisma.customFieldDefinition.update({
      where: { id: field.id },
      data: {
        ...data,
        ...(options === undefined ? {} : { options }),
      },
    });
  }

  async disableCustomField(organizationId: string, fieldId: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, organizationId },
      select: { id: true },
    });
    if (!field) throw new NotFoundException('Custom field not found');
    return this.prisma.customFieldDefinition.update({
      where: { id: field.id },
      data: { active: false },
    });
  }

  async validateCustomValues(
    entity: CustomFieldEntity,
    values: Record<string, unknown> | undefined,
  ) {
    const definitions = await this.listTenantCustomFields(entity);
    const supplied = values ?? {};
    const allowed = new Map(definitions.map((field) => [field.key, field]));

    for (const key of Object.keys(supplied)) {
      if (!allowed.has(key))
        throw new BadRequestException(`Unknown custom field: ${key}`);
    }

    for (const field of definitions) {
      const value = supplied[field.key];
      if (
        field.required &&
        (value === undefined || value === null || value === '')
      )
        throw new BadRequestException(
          `Custom field is required: ${field.label}`,
        );
      if (value === undefined || value === null || value === '') continue;

      if (
        [CustomFieldType.TEXT, CustomFieldType.LONG_TEXT].includes(
          field.fieldType,
        ) &&
        typeof value !== 'string'
      )
        throw new BadRequestException(`Invalid value for ${field.label}`);

      if (
        field.fieldType === CustomFieldType.NUMBER &&
        (typeof value !== 'number' || !Number.isFinite(value))
      )
        throw new BadRequestException(`Invalid value for ${field.label}`);

      if (
        field.fieldType === CustomFieldType.BOOLEAN &&
        typeof value !== 'boolean'
      )
        throw new BadRequestException(`Invalid value for ${field.label}`);

      if (
        field.fieldType === CustomFieldType.DATE &&
        (typeof value !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
      )
        throw new BadRequestException(`Invalid value for ${field.label}`);

      if (field.fieldType === CustomFieldType.SELECT) {
        const options = Array.isArray(field.options)
          ? field.options.filter(
              (option): option is string => typeof option === 'string',
            )
          : [];
        if (typeof value !== 'string' || !options.includes(value))
          throw new BadRequestException(`Invalid value for ${field.label}`);
      }
    }

    return supplied as Prisma.InputJsonValue;
  }

  async listPipelines(organizationId: string) {
    await this.assertOrganization(organizationId);
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        stages: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  async createPipeline(organizationId: string, data: CreatePipelineDto) {
    await this.assertOrganization(organizationId);
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault)
        await tx.pipeline.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      return tx.pipeline.create({
        data: {
          organizationId,
          name: data.name,
          isDefault: data.isDefault ?? false,
          active: true,
        },
      });
    });
  }

  async updatePipeline(
    organizationId: string,
    pipelineId: string,
    data: UpdatePipelineDto,
  ) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    if (data.active === false && pipeline.isDefault)
      throw new BadRequestException(
        'Choose another default pipeline before disabling this pipeline',
      );

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault === true)
        await tx.pipeline.updateMany({
          where: { organizationId, isDefault: true, id: { not: pipelineId } },
          data: { isDefault: false },
        });
      return tx.pipeline.update({
        where: { id: pipelineId },
        data,
      });
    });
  }

  async createStage(
    organizationId: string,
    pipelineId: string,
    data: CreatePipelineStageDto,
  ) {
    await this.assertPipeline(organizationId, pipelineId);
    return this.prisma.pipelineStage.create({
      data: {
        organizationId,
        pipelineId,
        name: data.name,
        position: data.position,
        probability: data.probability,
      },
    });
  }

  async updateStage(
    organizationId: string,
    pipelineId: string,
    stageId: string,
    data: UpdatePipelineStageDto,
  ) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, organizationId },
      select: { id: true },
    });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data,
    });
  }

  async disableStage(
    organizationId: string,
    pipelineId: string,
    stageId: string,
  ) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId, organizationId },
      select: { id: true },
    });
    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return this.prisma.pipelineStage.update({
      where: { id: stage.id },
      data: { active: false },
    });
  }

  private async assertOrganization(organizationId: string) {
    const exists = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');
  }

  private async assertPipeline(organizationId: string, pipelineId: string) {
    const exists = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Pipeline not found');
  }
}
