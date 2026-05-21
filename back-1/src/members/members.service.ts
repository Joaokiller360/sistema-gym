import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { search, status, branchId } = query;
    const where: any = { gymId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (branchId) where.branchId = branchId;

    return this.prisma.member.findMany({
      where,
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(gymId: string, data: any) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { subscriptionPlan: true } });
    if (gym?.subscriptionPlan) {
      const planDef = await this.prisma.subscriptionPlan.findUnique({
        where: { key: gym.subscriptionPlan },
        select: { maxMembers: true, label: true },
      });
      if (planDef?.maxMembers != null) {
        const currentCount = await this.prisma.member.count({ where: { gymId } });
        if (currentCount >= planDef.maxMembers) {
          throw new ForbiddenException(
            `Límite de miembros alcanzado. El plan ${planDef.label} permite hasta ${planDef.maxMembers} miembros. Actualizá tu plan para agregar más.`,
          );
        }
      }
    }
    return this.prisma.member.create({ data: { ...data, gymId } });
  }

  async findOne(id: string, gymId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, gymId },
      include: {
        memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        attendances: { orderBy: { checkIn: 'desc' }, take: 50 },
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.member.update({ where: { id }, data });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.member.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { id, gymId } });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }
}
