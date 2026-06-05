import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ConvertAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  gymName: string;
}
