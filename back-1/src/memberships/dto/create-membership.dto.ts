import {
  IsUUID, IsDateString, IsOptional, IsString, MaxLength,
} from 'class-validator';

export class CreateMembershipDto {
  @IsUUID('4', { message: 'memberId inválido' })
  memberId: string;

  @IsUUID('4', { message: 'planId inválido' })
  planId: string;

  @IsUUID('4', { message: 'branchId inválido' })
  @IsOptional()
  branchId?: string;

  @IsDateString({}, { message: 'startDate debe ser fecha ISO válida' })
  startDate: string;

  @IsDateString({}, { message: 'endDate debe ser fecha ISO válida' })
  endDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
