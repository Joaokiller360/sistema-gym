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
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async deleteAttendance(gymId: string, id: string) {
    const record = await this.prisma.attendance.findFirst({ where: { id, gymId } });
    if (!record) throw new NotFoundException('Attendance record not found');
    return this.prisma.attendance.delete({ where: { id } });
  }

  async findAllGroups(gymId: string) {
    return this.prisma.attendanceGroup.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGroup(gymId: string, name: string) {
    return this.prisma.attendanceGroup.create({ data: { gymId, name } });
  }

  async deleteGroup(gymId: string, id: string) {
    const group = await this.prisma.attendanceGroup.findFirst({ where: { id, gymId } });
    if (!group) throw new NotFoundException('Group not found');
    return this.prisma.attendanceGroup.delete({ where: { id } });
  }

  async checkIn(gymId: string, memberId: string, branchId?: string, groupId?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const open = await this.prisma.attendance.findFirst({
      where: {
        gymId,
        memberId,
        checkOut: null,
        checkIn: { gte: todayStart, lte: todayEnd },
      },
    });
    if (open) throw new ConflictException('Member already checked in today');

    return this.prisma.attendance.create({
      data: {
        gymId,
        memberId,
        branchId: branchId ?? null,
        groupId: groupId ?? null,
        checkIn: new Date(),
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
      },
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
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }
}
