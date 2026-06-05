import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, IsIn, MinLength, MaxLength, Matches } from 'class-validator';

const ALLOWED_COUNTRIES = [
  'AR','MX','CO','CL','PE','VE','EC','BO','PY','UY','BR',
  'CR','PA','DO','GT','HN','SV','NI','CU','PR',
  'ES','US','CA','PT','FR','DE','IT','GB','AU','OTHER',
];

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(20)
  @Matches(/^[0-9+\-\s()]+$/, { message: 'phone must contain only digits, +, -, spaces, or parentheses' })
  phone?: string;

  @IsIn(ALLOWED_COUNTRIES)
  country: string;

  @IsString()
  @IsOptional()
  @MaxLength(8)
  @Matches(/^\+\d{1,4}$/, { message: 'callingCode must match +1 to +9999 format' })
  callingCode?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\s\-]{2,12}$/, { message: 'postalCode contains invalid characters' })
  @MaxLength(20)
  postalCode?: string;

  @IsDateString()
  preferredDate: string;
}
