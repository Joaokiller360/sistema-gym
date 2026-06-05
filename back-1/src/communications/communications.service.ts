import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, _query: any) {
    const records = await this.prisma.adminCommunication.findMany({
      where: { recipientIds: { has: gymId } },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        subject: true,
        body: true,
        sentAt: true,
        sentBy: { select: { name: true, email: true } },
      },
    });

    return records.map(r => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      sentAt: r.sentAt,
      sentBy: r.sentBy
        ? { name: r.sentBy.name || r.sentBy.email, email: r.sentBy.email }
        : null,
    }));
  }

  async send(gymId: string, data: any) {
    return this.prisma.communication.create({
      data: { ...data, gymId, sentAt: new Date() },
    });
  }
}
