import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsPositive,
  IsBoolean, IsArray, MaxLength, Min, Max, MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsInt({ message: 'price debe ser entero (centavos)' })
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsInt()
  @Min(1)
  @Max(7)
  @IsOptional()
  daysPerWeek?: number;

  // Number of gym days included; null/omitted = unlimited for durationDays
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  visitLimit?: number | null;

  // People covered by one purchase (1 = individual, 2+ = shared plan)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  maxMembers?: number;

  @IsArray()
  @IsOptional()
  benefits?: unknown[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  storeEnabled?: boolean;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationDays?: number;

  @IsInt()
  @Min(1)
  @Max(7)
  @IsOptional()
  daysPerWeek?: number;

  // Number of gym days included; null/omitted = unlimited for durationDays
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  visitLimit?: number | null;

  // People covered by one purchase (1 = individual, 2+ = shared plan)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  maxMembers?: number;

  @IsArray()
  @IsOptional()
  benefits?: unknown[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  storeEnabled?: boolean;
}
