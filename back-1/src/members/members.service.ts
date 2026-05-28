import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { search, status, branchId } = query;
    const where: any = { gymId };
    const searchStr = typeof search === 'string' ? search : undefined;

    if (searchStr) {
      where.OR = [
        { firstName: { contains: searchStr, mode: 'insensitive' } },
        { lastName: { contains: searchStr, mode: 'insensitive' } },
        { email: { contains: searchStr, mode: 'insensitive' } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (typeof branchId === 'string') where.branchId = branchId;

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
    await this.assertNameUnique(gymId, data.firstName, data.lastName);
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
    try {
      return await this.prisma.member.create({ data: { ...data, gymId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un miembro con el nombre "${data.firstName} ${data.lastName}" en este gimnasio.`);
      }
      throw e;
    }
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
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = await this.prisma.member.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
      const firstName = data.firstName ?? current!.firstName;
      const lastName = data.lastName ?? current!.lastName;
      await this.assertNameUnique(gymId, firstName, lastName, id);
    }
    try {
      return await this.prisma.member.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe un miembro con ese nombre en este gimnasio.`);
      }
      throw e;
    }
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.member.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { id, gymId } });
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  private async assertNameUnique(gymId: string, firstName: string, lastName: string, excludeId?: string) {
    const existing = await this.prisma.member.findFirst({
      where: {
        gymId,
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un miembro con el nombre "${firstName} ${lastName}" en este gimnasio.`);
    }
  }
}
