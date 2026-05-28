import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDemoRequestDto, ip?: string) {
    const record = await this.prisma.demoRequest.create({
      data: { ...dto, ip: ip ?? null },
      select: { id: true, name: true, email: true, gymName: true, planLabel: true, status: true, createdAt: true },
    });
    return record;
  }
}
