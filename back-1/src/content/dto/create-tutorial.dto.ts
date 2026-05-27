import { IsString, IsOptional, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

function sanitize(val: unknown): string {
  if (typeof val !== 'string') return val as string;
  return val.trim().replace(/[<>]/g, '');
}

export class CreateTutorialDto {
  @Transform(({ value }) => sanitize(value))
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @Transform(({ value }) => sanitize(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUrl({}, { message: 'videoUrl debe ser URL válida' })
  @MaxLength(500)
  videoUrl: string;
}
