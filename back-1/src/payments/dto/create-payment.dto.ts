import {
  IsUUID, IsInt, IsPositive, IsOptional,
  IsString, IsIn, MaxLength, Min,
} from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const;

export class CreatePaymentDto {
  @IsUUID('4', { message: 'memberId inválido' })
  memberId: string;

  @IsUUID('4', { message: 'membershipId inválido' })
  @IsOptional()
  membershipId?: string;

  @IsUUID('4', { message: 'branchId inválido' })
  @IsOptional()
  branchId?: string;

  @IsInt({ message: 'amount debe ser entero (centavos)' })
  @Min(1, { message: 'amount debe ser mayor a 0' })
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsIn(PAYMENT_METHODS, { message: 'method inválido' })
  @IsOptional()
  method?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
