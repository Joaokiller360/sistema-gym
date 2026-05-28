import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html') as (input: string, opts: object) => string;
import { PrismaService } from '../prisma/prisma.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

function sanitizeText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDemoRequestDto, ip?: string) {
    const record = await this.prisma.demoRequest.create({
      data: {
        ...dto,
        name: sanitizeText(dto.name),
        gymName: sanitizeText(dto.gymName),
        planLabel: sanitizeText(dto.planLabel),
        ip: ip ?? null,
      },
      select: { id: true, name: true, email: true, gymName: true, planLabel: true, status: true, createdAt: true },
    });
    return record;
  }
}
