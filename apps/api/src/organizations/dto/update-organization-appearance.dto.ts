import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class UpdateOrganizationAppearanceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  workspaceName!: string;

  @Matches(HEX_COLOR)
  primaryColor!: string;

  @Matches(HEX_COLOR)
  accentColor!: string;

  @Matches(HEX_COLOR)
  sidebarColor!: string;

  @Matches(HEX_COLOR)
  pageBackground!: string;

  @Matches(HEX_COLOR)
  surfaceColor!: string;
}
