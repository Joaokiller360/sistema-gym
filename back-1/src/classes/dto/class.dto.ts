import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsPositive,
  IsBoolean, IsObject, IsUUID, MaxLength, MinLength,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @IsPositive()
  maxCapacity: number;

  @IsObject({ message: 'schedule debe ser un objeto JSON' })
  schedule: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;

  @IsUUID('4')
  @IsOptional()
  trainerId?: string;
}

export class UpdateClassDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  maxCapacity?: number;

  @IsObject()
  @IsOptional()
  schedule?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;

  @IsUUID('4')
  @IsOptional()
  trainerId?: string;
}
