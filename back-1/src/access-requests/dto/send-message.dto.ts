import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(2000)
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Matches(/^https:\/\//, { message: 'meetingLink must start with https://' })
  meetingLink?: string;
}
