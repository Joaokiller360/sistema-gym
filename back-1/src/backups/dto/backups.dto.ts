import { IsString, MaxLength } from 'class-validator';

export class BackupKeyDto {
  @IsString()
  @MaxLength(200)
  key: string;
}
