import { CrmStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CleanText,
  IsLabel,
  IsPersonName,
  IsSafeName,
  LANGUAGE,
  PHONE,
  TEMPLATE_NAME,
  cleanText,
} from '../../common/validators/text.validator';

/** Values that go inside a template: WhatsApp rejects line breaks and tabs there */
const NO_BREAKS = /^[^\n\t]*$/;

export class SetAlertsDto {
  @IsBoolean()
  paused: boolean;
}

export class SendMessageDto {
  @CleanText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  body: string;

  /** Message in this chat to quote-reply to */
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsEnum(CrmStatus)
  status?: CrmStatus;

  @IsOptional()
  @CleanText()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  /** Empty clears it */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @ValidateIf((_, v) => v !== '')
  @IsSafeName()
  alias?: string;

  // Trimmed and de-duplicated (case-insensitive) before validation
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!Array.isArray(value)) return value;
    const seen = new Set<string>();
    return value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => (cleanText(t) as string).replace(/\s+/g, ' '))
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
  @IsLabel({ each: true })
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
  @Matches(PHONE, { message: 'Número inválido: solo dígitos, espacios, + y -' })
  phone?: string;

  /** Shown as the conversation's alias and used in the greeting */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @ValidateIf((_, v) => v !== '')
  @IsSafeName()
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
  @Matches(TEMPLATE_NAME)
  name: string;

  @IsString()
  @Matches(LANGUAGE)
  language: string;

  /** {{1}}, {{2}}, … in order (header vars first) */
  @CleanText()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  @Matches(NO_BREAKS, {
    each: true,
    message: 'Los valores de la plantilla no pueden tener saltos de línea',
  })
  params: string[];
}

export class QuickReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @IsLabel()
  label: string;

  @CleanText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;
}

/** Multipart text field next to the file */
export class SendMediaDto {
  @IsOptional()
  @CleanText()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
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
  @Matches(LANGUAGE)
  language: string;

  @CleanText()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  body: string;

  @IsOptional()
  @CleanText()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @Matches(NO_BREAKS, {
    each: true,
    message: 'Los ejemplos no pueden tener saltos de línea',
  })
  examples?: string[];

  /** Meta: single line */
  @IsOptional()
  @CleanText()
  @IsString()
  @MaxLength(60)
  @Matches(NO_BREAKS, { message: 'El pie va en una sola línea' })
  footer?: string;
}

/** Gym + owner login created from a chat, once the contact sent their details */
export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsSafeName()
  gymName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsPersonName()
  ownerName: string;

  @CleanText()
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(254)
  email: string;

  /** SubscriptionPlan key; BASIC when omitted */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  plan?: string;

  /** Also send the login by WhatsApp (only while the 24 h window is open) */
  @IsBoolean()
  sendWhatsapp: boolean;
}

/** Auto-reply while nobody is online; any field left out keeps its value */
export class SetAwayDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** {nombre} becomes the contact's first name */
  @IsOptional()
  @CleanText()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsIn(['presence', 'always'])
  mode?: 'presence' | 'always';
}

/** Catalog item; price in units (49.9), stored in cents */
export class ProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsSafeName()
  name: string;

  @IsOptional()
  @CleanText()
  @IsString()
  @MaxLength(900)
  description?: string;

  /** null = "consultar" */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  price?: number | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'Moneda inválida (ej. USD, ARS)' })
  currency?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto extends PartialType(ProductDto) {}

export class SendProductDto {
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
