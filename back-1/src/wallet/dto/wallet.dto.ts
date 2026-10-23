import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleItemDto } from '../../store/dto/store.dto';

export class IssuePassDto {
  @IsBoolean({ message: 'sendEmail debe ser verdadero o falso' })
  @IsOptional()
  sendEmail?: boolean;
}

export class ScanSaleDto {
  @IsArray({ message: 'Los items deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsString({ message: 'El método de pago debe ser texto' })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'], {
    message: 'Método de pago inválido',
  })
  method: string;

  @IsString({ message: 'Las notas deben ser texto' })
  @IsOptional()
  @MaxLength(300, { message: 'Las notas no pueden superar los 300 caracteres' })
  notes?: string;
}

export class ScanCreditDto {
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
