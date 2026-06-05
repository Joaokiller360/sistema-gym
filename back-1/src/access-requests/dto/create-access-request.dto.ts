import { IsString, IsNotEmpty, IsEmail, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsDateString()
  preferredDate: string;
}
