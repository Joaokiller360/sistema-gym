import {
  IsString, IsNotEmpty, IsArray, IsUUID, MaxLength,
} from 'class-validator';

export class CreateCommunicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @IsArray()
  @IsUUID('4', { each: true, message: 'Uno o más recipientIds son inválidos' })
  recipientIds: string[];
}
