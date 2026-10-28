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
