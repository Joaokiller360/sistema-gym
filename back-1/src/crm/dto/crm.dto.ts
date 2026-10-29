import { CrmStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetAlertsDto {
  @IsBoolean()
  paused: boolean;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  body: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsEnum(CrmStatus)
  status?: CrmStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  /** Empty clears it */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  alias?: string;

  // Trimmed and de-duplicated (case-insensitive) before validation
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!Array.isArray(value)) return value;
    const seen = new Set<string>();
    return value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().replace(/\s+/g, ' '))
      .filter((t) => {
        const key = t.toLowerCase();
        if (!t || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  /** Replies skip the 1-minute undo queue */
  @IsOptional()
  @IsBoolean()
  instantSend?: boolean;

  /** null unlinks the gym */
  @IsOptional()
  @IsUUID()
  gymId?: string | null;
}

/** Either a gym (uses its WhatsApp) or a free number, e.g. a prospect */
export class StartConversationDto {
  @IsOptional()
  @IsUUID()
  gymId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** Shown as the conversation's alias and used in the greeting */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class SendTemplateDto {
  /** contact = existing customer, offer = sales pitch. Defaults by whether a gym is linked. */
  @IsOptional()
  @IsIn(['contact', 'offer'])
  kind?: 'contact' | 'offer';
}

export class SendAnyTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  language: string;

  /** {{1}}, {{2}}, … in order (header vars first) */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  params: string[];
}

export class QuickReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;
}

/** Multipart text field next to the file */
export class SendMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;
}

/** New WhatsApp template; Meta reviews it before it can be sent */
export class CreateTemplateDto {
  /** Meta's rule: lowercase letters, digits and underscores, starting with a letter */
  @Matches(/^[a-z][a-z0-9_]{0,99}$/, {
    message:
      'El nombre va en minúsculas, sin espacios ni tildes (ej. aviso_pago)',
  })
  name: string;

  @IsIn(['UTILITY', 'MARKETING'])
  category: 'UTILITY' | 'MARKETING';

  @IsString()
  @Matches(/^[a-z]{2}(_[A-Z]{2})?$/)
  language: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  body: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  examples?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  footer?: string;
}
