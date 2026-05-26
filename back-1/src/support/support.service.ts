import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto, UpdateTicketDto } from './dto/support.dto';

const GYM_SELECT = { id: true, name: true, slug: true };

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(gymId: string, createdByEmail: string, dto: CreateTicketDto) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: GYM_SELECT });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');

    const ticket = await this.prisma.supportTicket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as any) ?? 'NORMAL',
        category: (dto.category as any) ?? 'OTHER',
        createdByEmail,
        gymId,
      },
    });

    return this.formatTicket(ticket, gym);
  }

  async findAll(gymId: string | undefined, all: boolean) {
    const where = gymId ? { gymId } : {};

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      include: { gym: { select: GYM_SELECT } },
      orderBy: { createdAt: 'desc' },
    });

    return tickets.map((t) => this.formatTicket(t, t.gym));
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { gym: { select: GYM_SELECT } },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');

    if (!dto.status && dto.adminNotes === undefined) {
      throw new BadRequestException('Debe enviar al menos status o adminNotes');
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
      },
      include: { gym: { select: GYM_SELECT } },
    });

    return this.formatTicket(updated, updated.gym);
  }

  private formatTicket(ticket: any, gym: { id: string; name: string; slug: string }) {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      category: ticket.category,
      status: ticket.status,
      gymId: gym.id,
      gymName: gym.name,
      gymSlug: gym.slug,
      createdByEmail: ticket.createdByEmail,
      adminNotes: ticket.adminNotes ?? null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}
