import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜñÑçÇ'\-\s]+$/;
const PHONE_REGEX = /^[+\d\s\-().]{6,20}$/;

function sanitize(val: unknown): string {
  if (typeof val !== 'string') return val as string;
  return val.trim().replace(/[<>]/g, '');
}

export class CreateMemberDto {
  @Transform(({ value }) => sanitize(value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'firstName solo puede contener letras y espacios' })
  firstName: string;

  @Transform(({ value }) => sanitize(value))
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'lastName solo puede contener letras y espacios' })
  lastName: string;

  @Transform(({ value }) => sanitize(value))
  @IsEmail({}, { message: 'email inválido' })
  @MaxLength(100)
  email: string;

  @Transform(({ value }) => sanitize(value))
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone inválido' })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'birthDate debe ser fecha ISO' })
  birthDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUrl({}, { message: 'photoUrl debe ser URL válida' })
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;
}
