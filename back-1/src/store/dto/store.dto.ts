import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean,
  IsPositive, IsInt, Min, MaxLength, IsIn, IsArray,
  ValidateNested, ArrayMinSize, IsUUID, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

const SAFE_TEXT = /^[\p{L}\p{N}\s.,\-_'()/]+$/u;

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(SAFE_TEXT, { message: 'name: solo letras, números y puntuación básica' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  imageUrl?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(SAFE_TEXT, { message: 'name: solo letras, números y puntuación básica' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  imageUrl?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(SAFE_TEXT, { message: 'name: solo letras, números y puntuación básica' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  imageUrl?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  @Matches(SAFE_TEXT, { message: 'name: solo letras, números y puntuación básica' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  imageUrl?: string;
}

export class SaleItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsString()
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  method: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  notes?: string;
}

export class AssignCreditsDto {
  @IsUUID()
  memberId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(300)
  notes?: string;
}

export class PayCreditsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  creditIds: string[];

  @IsString()
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  method: string;
}
