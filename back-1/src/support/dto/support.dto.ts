import {
  IsString, IsNotEmpty, IsOptional, IsIn, MaxLength,
} from 'class-validator';

const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW', 'NOTIFICATION'] as const;
const CATEGORIES = ['BUG', 'BILLING', 'ACCESS', 'FEATURE', 'OTHER'] as const;
const STATUSES   = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es requerido' })
  @MaxLength(200, { message: 'El título no puede superar los 200 caracteres' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es requerida' })
  @MaxLength(2000, { message: 'La descripción no puede superar los 2000 caracteres' })
  description: string;

  @IsIn(PRIORITIES, { message: 'Prioridad inválida' })
  @IsOptional()
  priority?: string;

  @IsIn(CATEGORIES, { message: 'Categoría inválida' })
  @IsOptional()
  category?: string;
}

export class UpdateTicketDto {
  @IsIn(STATUSES, { message: 'Estado inválido' })
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Las notas no pueden superar los 2000 caracteres' })
  adminNotes?: string;
}
