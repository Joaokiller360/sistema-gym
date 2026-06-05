import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, MinLength, MaxLength, Matches } from 'class-validator';

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

  @IsDateString()
  preferredDate: string;
}
