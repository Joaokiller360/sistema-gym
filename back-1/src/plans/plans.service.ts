import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string) {
    return this.prisma.plan.findMany({
      where: { gymId },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, gymId: string) {
    return this.assertExists(id, gymId);
  }

  async create(gymId: string, data: any) {
    if (!gymId) throw new BadRequestException('gymId is required');
    const payload = { ...data, gymId };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price));
    return this.prisma.plan.create({ data: payload });
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    const payload = { ...data };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price));
    return this.prisma.plan.update({ where: { id }, data: payload });
  }

  async toggle(id: string, gymId: string) {
    const plan = await this.assertExists(id, gymId);
    return this.prisma.plan.update({ where: { id }, data: { isActive: !plan.isActive } });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.plan.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId?: string) {
    const plan = await this.prisma.plan.findFirst({ where: gymId ? { id, gymId } : { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }
}
