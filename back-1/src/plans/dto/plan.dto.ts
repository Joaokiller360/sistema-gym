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
  @IsPositive()
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

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercent?: number;

  @IsBoolean()
  @IsOptional()
  discountActive?: boolean;

  @IsInt()
  @IsPositive()
  @IsOptional()
  yearlyPrice?: number;
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

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercent?: number;

  @IsBoolean()
  @IsOptional()
  discountActive?: boolean;

  @IsInt()
  @IsPositive()
  @IsOptional()
  yearlyPrice?: number;
}

export class SetDiscountDto {
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  yearlyPrice?: number;
}
