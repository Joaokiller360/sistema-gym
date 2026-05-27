import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsUUID, IsDateString, IsObject, MaxLength, MinLength,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50000)
  body?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsUUID('4')
  @IsOptional()
  templateId?: string;

  @IsObject()
  @IsOptional()
  segment?: Record<string, unknown>;
}

export class ScheduleCampaignDto {
  @IsUUID('4', { message: 'campaignId inválido' })
  campaignId: string;

  @IsDateString({}, { message: 'scheduledAt debe ser fecha ISO válida' })
  scheduledAt: string;
}
