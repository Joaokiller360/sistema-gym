import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrainersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { branchId, search } = query;
    const where: any = { gymId };
    const searchStr = typeof search === 'string' ? search : undefined;
    if (typeof branchId === 'string') where.branchId = branchId;
    if (searchStr) {
      where.OR = [
        { firstName: { contains: searchStr, mode: 'insensitive' } },
        { lastName: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    return this.prisma.trainer.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id, gymId } });
    if (!trainer) throw new NotFoundException('Trainer not found');
    return trainer;
  }

  async create(gymId: string, data: any) {
    return this.prisma.trainer.create({ data: { ...data, gymId } });
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.trainer.update({ where: { id }, data });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.trainer.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId: string) {
    const t = await this.prisma.trainer.findFirst({ where: { id, gymId } });
    if (!t) throw new NotFoundException('Trainer not found');
    return t;
  }
}
