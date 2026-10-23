import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDayUTC, endOfDayUTC, buildDateRangeFilter, getTimezone } from '../common/utils/timezone.util';
import { WalletPassService, pickMembership, visitsRemaining } from '../wallet/wallet-pass.service';

const RECORD_INCLUDE = {
  member: { select: { id: true, firstName: true, lastName: true } },
  group: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passes: WalletPassService,
  ) {}

  private async gymDayBounds(gymId: string, at: Date) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
    const tz = gym?.timezone ?? 'UTC';
    const dayStr = at.toLocaleDateString('en-CA', { timeZone: tz });
    return { start: startOfDayUTC(dayStr, tz), end: endOfDayUTC(dayStr, tz) };
  }

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

  /** Deleting the check-in that consumed a visit gives the day back (or hands it to another entry that day). */
  async deleteAttendance(gymId: string, id: string) {
    const record = await this.prisma.attendance.findFirst({
      where: { id, gymId },
      include: { membership: { select: { id: true, endDate: true, status: true, visitsUsed: true } } },
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    const membership = record.membership;
    if (!membership) return this.prisma.attendance.delete({ where: { id } });

    const { start, end } = await this.gymDayBounds(gymId, record.checkIn);
    const sameDay = await this.prisma.attendance.findFirst({
      where: { gymId, memberId: record.memberId, id: { not: id }, checkIn: { gte: start, lte: end } },
      orderBy: { checkIn: 'asc' },
      select: { id: true },
    });

    const deleted = await this.prisma.$transaction(async (tx) => {
      if (sameDay) {
        // The member still attended that day: the visit stays consumed, carried by the other entry
        await tx.attendance.update({ where: { id: sameDay.id }, data: { membershipId: membership.id } });
      } else if (membership.visitsUsed > 0) {
        const reopen = membership.status === 'EXPIRED' && membership.endDate >= new Date();
        await tx.membership.update({
          where: { id: membership.id },
          data: { visitsUsed: { decrement: 1 }, ...(reopen ? { status: 'ACTIVE' } : {}) },
        });
      }
      return tx.attendance.delete({ where: { id } });
    });

    if (!sameDay) void this.passes.sync(gymId, record.memberId);
    return deleted;
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

  /**
   * Visit-limited plans consume one visit per gym day: the first check-in of the day
   * consumes it; re-entries the same day (after a check-out) are free. Using the last
   * visit expires the membership.
   */
  async checkIn(gymId: string, memberId: string, branchId?: string, groupId?: string) {
    const { start, end } = await this.gymDayBounds(gymId, new Date());

    const today = await this.prisma.attendance.findMany({
      where: { gymId, memberId, checkIn: { gte: start, lte: end } },
      select: { checkOut: true },
    });
    if (today.some((a) => a.checkOut === null)) throw new ConflictException('Member already checked in today');
    const dayAlreadyCounted = today.length > 0;

    const memberships = await this.passes.activeMemberships(gymId, memberId);
    const membership = pickMembership(memberships);
    if (!membership && !dayAlreadyCounted) {
      throw new ForbiddenException(
        memberships.length > 0
          ? 'El plan del miembro no tiene días disponibles'
          : 'Member has no active membership',
      );
    }

    const consume = !dayAlreadyCounted && membership?.visitsTotal != null;
    let remaining = membership ? visitsRemaining(membership) : null;

    const record = await this.prisma.$transaction(async (tx) => {
      if (consume) {
        const used = membership!.visitsUsed + 1;
        // Optimistic lock: two scans at once must not both spend the same visit
        const { count } = await tx.membership.updateMany({
          where: { id: membership!.id, status: 'ACTIVE', visitsUsed: membership!.visitsUsed },
          data: { visitsUsed: used, ...(used >= membership!.visitsTotal! ? { status: 'EXPIRED' } : {}) },
        });
        if (count === 0) throw new ConflictException('El plan cambió mientras se registraba la entrada, intentá de nuevo');
        remaining = membership!.visitsTotal! - used;
      }
      return tx.attendance.create({
        data: {
          gymId,
          memberId,
          branchId: branchId ?? null,
          groupId: groupId ?? null,
          membershipId: consume ? membership!.id : null,
          checkIn: new Date(),
        },
        include: RECORD_INCLUDE,
      });
    });

    if (consume) void this.passes.sync(gymId, memberId);
    return { ...record, visitsRemaining: remaining, visitConsumed: consume };
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
      include: RECORD_INCLUDE,
    });
  }
}
