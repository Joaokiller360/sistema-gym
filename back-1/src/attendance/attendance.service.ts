import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDayUTC, endOfDayUTC, buildDateRangeFilter, getTimezone } from '../common/utils/timezone.util';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { memberId, branchId, startDate, endDate } = query;
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true, country: true } });
    const tz = gym?.timezone ?? getTimezone(gym?.country);
    const where: any = { gymId };
    if (memberId) where.memberId = memberId;
    if (branchId) where.branchId = branchId;
    const checkInFilter = buildDateRangeFilter(startDate, endDate, tz);
    if (checkInFilter) where.checkIn = checkInFilter;

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
    const now = new Date();

    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
    const tz = gym?.timezone ?? 'UTC';

    const activeMembership = await this.prisma.membership.findFirst({
      where: {
        gymId,
        memberId,
        status: 'ACTIVE',
        endDate: { gte: now },
      },
    });
    if (!activeMembership) throw new ForbiddenException('Member has no active membership');

    const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
    const todayStart = startOfDayUTC(todayStr, tz);
    const todayEnd = endOfDayUTC(todayStr, tz);

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
