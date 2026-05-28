import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { status, branchId, search } = query;
    const where: any = { gymId };
    const searchStr = typeof search === 'string' ? search : undefined;
    if (typeof status === 'string') where.status = status;
    if (typeof branchId === 'string') where.branchId = branchId;
    if (searchStr) where.name = { contains: searchStr, mode: 'insensitive' };

    return this.prisma.inventoryItem.findMany({
      where,
      include: { maintenances: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, gymId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, gymId },
      include: { maintenances: { orderBy: { createdAt: 'desc' } } },
    });
    if (!item) throw new NotFoundException('Item no encontrado en el inventario');
    return item;
  }

  async create(gymId: string, data: any) {
    return this.prisma.inventoryItem.create({ data: { ...data, gymId } });
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.inventoryItem.update({ where: { id }, data });
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.inventoryItem.delete({ where: { id } });
  }

  async registerMaintenance(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    return this.prisma.maintenance.create({
      data: { ...data, gymId, inventoryItemId: id },
    });
  }

  private async assertExists(id: string, gymId: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, gymId } });
    if (!item) throw new NotFoundException('Item no encontrado en el inventario');
    return item;
  }
}
