import { IsString, IsOptional, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

function sanitize(val: unknown): string {
  if (typeof val !== 'string') return val as string;
  return val.trim().replace(/[<>]/g, '');
}

export class CreateNewsDto {
  @Transform(({ value }) => sanitize(value))
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @Transform(({ value }) => sanitize(value))
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsUrl({}, { message: 'imageUrl debe ser URL válida' })
  @MaxLength(500)
  imageUrl?: string;
}
