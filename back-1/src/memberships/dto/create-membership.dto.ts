import {
  IsUUID, IsDateString, IsOptional, IsString, MaxLength, IsInt, Min, Max, IsArray, ArrayMaxSize,
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

  // Plan periods paid at once (e.g. 3 months): multiplies a visit plan's included days
  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  periods?: number;

  // Shared plans: other members covered by the same purchase (each gets their own membership)
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true, message: 'companionIds inválido' })
  @IsOptional()
  companionIds?: string[];
}

export class AddCompanionDto {
  @IsUUID('4', { message: 'memberId inválido' })
  memberId: string;
}
