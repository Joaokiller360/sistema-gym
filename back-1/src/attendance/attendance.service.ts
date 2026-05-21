import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { memberId, branchId, startDate, endDate } = query;
    const where: any = { gymId };
    if (memberId) where.memberId = memberId;
    if (branchId) where.branchId = branchId;
    if (startDate || endDate) {
      where.checkIn = {};
      if (startDate) where.checkIn.gte = new Date(startDate);
      if (endDate) where.checkIn.lte = new Date(endDate);
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: { checkIn: 'desc' },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async checkIn(gymId: string, memberId: string, branchId?: string) {
    const open = await this.prisma.attendance.findFirst({
      where: { gymId, memberId, checkOut: null },
    });
    if (open) throw new ConflictException('Member already checked in');

    return this.prisma.attendance.create({
      data: { gymId, memberId, branchId: branchId ?? null, checkIn: new Date() },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async checkOut(gymId: string, memberId: string) {
    const open = await this.prisma.attendance.findFirst({
      where: { gymId, memberId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) throw new NotFoundException('No active check-in for this member');

    return this.prisma.attendance.update({
      where: { id: open.id },
      data: { checkOut: new Date() },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
