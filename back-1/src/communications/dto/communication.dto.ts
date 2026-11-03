import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  MaxLength,
  IsIn,
  IsOptional,
  ArrayMaxSize,
} from 'class-validator';

export const ANNOUNCEMENT_TYPES = [
  'CLOSURE',
  'HOLIDAY',
  'RENOVATION',
  'SCHEDULE',
  'GENERAL',
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export class CreateCommunicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(700)
  body: string;

  @IsOptional()
  @IsIn(ANNOUNCEMENT_TYPES)
  type?: AnnouncementType;

  /** Omitted or empty = every active member of the gym. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @IsUUID('4', { each: true, message: 'Uno o más recipientIds son inválidos' })
  recipientIds?: string[];
}

export class TestAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(700)
  body: string;
}
