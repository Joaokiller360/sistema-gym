import {
  IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean,
  IsPositive, IsInt, Min, MaxLength, IsIn, IsArray,
  ValidateNested, ArrayMinSize, IsUUID, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

const SAFE_TEXT = /^[\p{L}\p{N}\s.,\-_'()/]+$/u;

export class CreateProductDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  @Matches(SAFE_TEXT, { message: 'El nombre solo puede contener letras, números y puntuación básica' })
  name: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres' })
  description?: string;

  @IsInt({ message: 'El precio debe ser un número entero (en centavos)' })
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  price: number;

  @IsInt({ message: 'El costo debe ser un número entero (en centavos)' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  @IsOptional()
  cost?: number;

  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock: number;

  @IsString({ message: 'La URL de imagen debe ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'La URL de imagen no puede superar los 300 caracteres' })
  imageUrl?: string;

  @IsUUID('4', { message: 'La categoría seleccionada no es válida' })
  @IsOptional()
  categoryId?: string;

  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsOptional()
  @MaxLength(100, { message: 'El nombre no puede superar los 100 caracteres' })
  @Matches(SAFE_TEXT, { message: 'El nombre solo puede contener letras, números y puntuación básica' })
  name?: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @IsOptional()
  @MaxLength(500, { message: 'La descripción no puede superar los 500 caracteres' })
  description?: string;

  @IsInt({ message: 'El precio debe ser un número entero (en centavos)' })
  @IsPositive({ message: 'El precio debe ser mayor a 0' })
  @IsOptional()
  price?: number;

  @IsInt({ message: 'El costo debe ser un número entero (en centavos)' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  @IsOptional()
  cost?: number;

  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  @IsOptional()
  stock?: number;

  @IsString({ message: 'La URL de imagen debe ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'La URL de imagen no puede superar los 300 caracteres' })
  imageUrl?: string;

  @IsUUID('4', { message: 'La categoría seleccionada no es válida' })
  @IsOptional()
  categoryId?: string;

  @IsBoolean({ message: 'El estado debe ser verdadero o falso' })
  @IsOptional()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(80, { message: 'El nombre no puede superar los 80 caracteres' })
  @Matches(SAFE_TEXT, { message: 'El nombre solo puede contener letras, números y puntuación básica' })
  name: string;

  @IsString({ message: 'La URL de imagen debe ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'La URL de imagen no puede superar los 300 caracteres' })
  imageUrl?: string;
}

export class UpdateCategoryDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @IsOptional()
  @MaxLength(80, { message: 'El nombre no puede superar los 80 caracteres' })
  @Matches(SAFE_TEXT, { message: 'El nombre solo puede contener letras, números y puntuación básica' })
  name?: string;

  @IsString({ message: 'La URL de imagen debe ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'La URL de imagen no puede superar los 300 caracteres' })
  imageUrl?: string;
}

export class SaleItemDto {
  @IsUUID('4', { message: 'El ID del producto no es válido' })
  productId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  quantity: number;
}

export class CreateSaleDto {
  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsString({ message: 'El método de pago debe ser texto' })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'], { message: 'Método de pago inválido' })
  method: string;

  @IsString({ message: 'Las notas deben ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'Las notas no pueden superar los 300 caracteres' })
  notes?: string;
}

export class AssignCreditsDto {
  @IsUUID('4', { message: 'El ID del miembro no es válido' })
  memberId: string;

  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsString({ message: 'Las notas deben ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'Las notas no pueden superar los 300 caracteres' })
  notes?: string;
}

export class PayCreditsDto {
  @IsArray({ message: 'Los IDs deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un crédito' })
  @IsUUID('4', { each: true, message: 'Uno o más IDs de crédito no son válidos' })
  creditIds: string[];

  @IsString({ message: 'El método de pago debe ser texto' })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'], { message: 'Método de pago inválido' })
  method: string;
}
