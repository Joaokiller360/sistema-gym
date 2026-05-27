import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean,
  IsIn, IsDateString, IsUUID, MaxLength, MinLength, Min,
} from 'class-validator';

const INVENTORY_STATUSES = ['ACTIVE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'RETIRED'] as const;
const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'] as const;

export class CreateInventoryItemDto {
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
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsIn(INVENTORY_STATUSES, { message: 'status inválido' })
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serialNumber?: string;

  @IsDateString({}, { message: 'purchaseDate debe ser fecha ISO' })
  @IsOptional()
  purchaseDate?: string;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;
}

export class UpdateInventoryItemDto {
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
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsIn(INVENTORY_STATUSES, { message: 'status inválido' })
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serialNumber?: string;

  @IsDateString({}, { message: 'purchaseDate debe ser fecha ISO' })
  @IsOptional()
  purchaseDate?: string;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;
}

export class CreateMaintenanceDto {
  @IsIn(MAINTENANCE_TYPES, { message: 'type inválido' })
  type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  responsibleName?: string;

  @IsDateString({}, { message: 'scheduledAt debe ser fecha ISO' })
  @IsOptional()
  scheduledAt?: string;

  @IsDateString({}, { message: 'completedAt debe ser fecha ISO' })
  @IsOptional()
  completedAt?: string;
}
