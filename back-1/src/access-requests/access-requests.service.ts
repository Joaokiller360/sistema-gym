import { Injectable, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html') as (input: string, opts: object) => string;
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { AccessRequestStatus } from '@prisma/client';

function sanitizeText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

@Injectable()
export class AccessRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccessRequestDto) {
    return this.prisma.accessRequest.create({
      data: {
        name: sanitizeText(dto.name),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone ? sanitizeText(dto.phone) : null,
        preferredDate: new Date(dto.preferredDate),
      },
      select: { id: true, name: true, email: true, phone: true, preferredDate: true, status: true, createdAt: true },
    });
  }

  async findAll(limit = 100) {
    return this.prisma.accessRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, email: true, phone: true, preferredDate: true, status: true, createdAt: true },
    });
  }

  async updateStatus(id: string, status: AccessRequestStatus) {
    const record = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Access request not found');
    return this.prisma.accessRequest.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, phone: true, preferredDate: true, status: true, createdAt: true },
    });
  }
}
