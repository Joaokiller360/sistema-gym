import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string) {
    return this.prisma.branch.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, gymId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, gymId } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(gymId: string, data: any) {
    return this.prisma.branch.create({ data: { ...data, gymId } });
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.branch.update({ where: { id }, data });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.branch.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, gymId } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
