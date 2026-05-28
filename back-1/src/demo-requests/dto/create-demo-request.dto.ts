import { IsString, IsNotEmpty, IsEmail, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreateDemoRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  gymName: string;

  @IsUUID()
  planId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  planLabel: string;
}
