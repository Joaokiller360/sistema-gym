import {
  IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean,
  IsObject, IsUUID, MaxLength, MinLength, Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

const PHONE_REGEX = /^[+\d\s\-().]{6,20}$/;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙäëïöüÄËÏÖÜñÑçÇ'\-\s]+$/;

function trim(val: unknown) {
  return typeof val === 'string' ? val.trim() : val;
}

export class CreateTrainerDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'firstName solo puede contener letras y espacios' })
  firstName: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'lastName solo puede contener letras y espacios' })
  lastName: string;

  @IsEmail({}, { message: 'email inválido' })
  @MaxLength(100)
  email: string;

  @IsString()
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'phone inválido' })
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  specialty?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  availability?: Record<string, unknown>;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;
}

export class UpdateTrainerDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'firstName solo puede contener letras y espacios' })
  firstName?: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NAME_REGEX, { message: 'lastName solo puede contener letras y espacios' })
  lastName?: string;

  @IsEmail({}, { message: 'email inválido' })
  @MaxLength(100)
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'phone inválido' })
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  specialty?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  availability?: Record<string, unknown>;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;
}
