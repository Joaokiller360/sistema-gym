import { CrmStatus } from '@prisma/client';
import {
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

  /** null unlinks the gym */
  @IsOptional()
  @IsUUID()
  gymId?: string | null;
}

export class StartConversationDto {
  @IsUUID()
  gymId: string;
}
