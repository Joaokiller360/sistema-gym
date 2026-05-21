import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, _query: any) {
    return this.prisma.communication.findMany({
      where: { gymId },
      orderBy: { sentAt: 'desc' },
    });
  }

  async send(gymId: string, data: any) {
    return this.prisma.communication.create({
      data: { ...data, gymId, sentAt: new Date() },
    });
  }
}
