import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsSafeUrl } from '../../common/validators/safe-url.validator';

function sanitize(val: unknown): string {
  if (typeof val !== 'string') return val as string;
  return val.trim()
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=\s*["']?[^"'\s;>]*/gi, '');
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

  @IsSafeUrl({ message: 'videoUrl debe ser una URL https válida y no puede apuntar a direcciones internas' })
  @MaxLength(500)
  videoUrl: string;
}
