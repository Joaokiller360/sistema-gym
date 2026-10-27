import { CrmStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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

export class StartConversationDto {
  @IsUUID()
  gymId: string;
}
