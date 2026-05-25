import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Products ────────────────────────────────────────────

  async findAllProducts(gymId: string, query: any) {
    const { search, categoryId, isActive } = query;
    const where: any = { gymId };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.prisma.product.findMany({
      where,
      include: {
        category: true,
        _count: { select: { saleItems: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(gymId: string, data: any) {
    return this.prisma.product.create({
      data: { ...data, gymId },
    });
  }

  async updateProduct(id: string, gymId: string, data: any) {
    await this.assertProductExists(id, gymId);
    return this.prisma.product.update({ where: { id }, data });
  }

  async deleteProduct(id: string, gymId: string) {
    await this.assertProductExists(id, gymId);
    return this.prisma.product.delete({ where: { id } });
  }

  // ── Sales ───────────────────────────────────────────────

  async createSale(gymId: string, data: { items: { productId: string; quantity: number }[]; method: string; notes?: string }) {
    const { items, method, notes } = data;
    if (!items?.length) throw new BadRequestException('Debe incluir al menos un producto');

    // Fetch products and validate stock
    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) }, gymId },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException(`Producto ${item.productId} no encontrado`);
      if (!product.isActive) throw new BadRequestException(`Producto "${product.name}" no está activo`);
      if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente para "${product.name}"`);
    }

    const total = items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + product.price * item.quantity;
    }, 0);

    // Create sale and update stock in transaction
    const sale = await this.prisma.$transaction(async tx => {
      const created = await tx.productSale.create({
        data: {
          gymId,
          total,
          method: method as any,
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return created;
    });

    return sale;
  }

  async deleteSale(id: string, gymId: string) {
    const sale = await this.prisma.productSale.findFirst({
      where: { id, gymId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');

    await this.prisma.$transaction(async tx => {
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.productSaleItem.deleteMany({ where: { saleId: id } });
      await tx.productSale.delete({ where: { id } });
    });

    return { message: 'Venta eliminada y stock restaurado' };
  }

  async findSales(gymId: string, query: any) {
    const { startDate, endDate } = query;
    const where: any = { gymId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    return this.prisma.productSale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Daily / Monthly cuts ─────────────────────────────────

  async getDailyCut(gymId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date debe ser YYYY-MM-DD');
    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestException('date inválida');
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const sales = await this.prisma.productSale.findMany({
      where: { gymId, createdAt: { gte: day, lt: nextDay } },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    return this.summarizeSales(sales);
  }

  async getMonthlyCut(gymId: string, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month debe ser YYYY-MM');
    const [year, m] = month.split('-').map(Number);
    if (m < 1 || m > 12) throw new BadRequestException('month inválido');
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 1);

    const sales = await this.prisma.productSale.findMany({
      where: { gymId, createdAt: { gte: start, lt: end } },
      include: { items: { include: { product: { select: { name: true } } } } },
    });

    return this.summarizeSales(sales);
  }

  private summarizeSales(sales: any[]) {
    const byMethod: Record<string, { count: number; total: number }> = {};
    const byProduct: Record<string, { name: string; quantity: number; total: number }> = {};
    let total = 0;

    for (const sale of sales) {
      total += sale.total;
      byMethod[sale.method] = byMethod[sale.method] ?? { count: 0, total: 0 };
      byMethod[sale.method].count++;
      byMethod[sale.method].total += sale.total;

      for (const item of sale.items) {
        const key = item.productId;
        byProduct[key] = byProduct[key] ?? { name: item.product.name, quantity: 0, total: 0 };
        byProduct[key].quantity += item.quantity;
        byProduct[key].total += item.unitPrice * item.quantity;
      }
    }

    return {
      salesCount: sales.length,
      total,
      byMethod: Object.entries(byMethod).map(([method, v]) => ({ method, ...v })),
      byProduct: Object.values(byProduct).sort((a, b) => b.quantity - a.quantity),
      sales,
    };
  }

  // ── Member credits ───────────────────────────────────────

  async assignCredits(gymId: string, data: { memberId: string; items: { productId: string; quantity: number }[]; notes?: string }) {
    const { memberId, items, notes } = data;
    if (!items?.length) throw new BadRequestException('Debe incluir al menos un producto');

    const member = await this.prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) throw new NotFoundException('Miembro no encontrado en este gimnasio');

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map(i => i.productId) }, gymId },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException(`Producto ${item.productId} no encontrado`);
      if (!product.isActive) throw new BadRequestException(`Producto "${product.name}" no está activo`);
      if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente para "${product.name}"`);
    }

    const created = await this.prisma.$transaction(async tx => {
      const credits = await Promise.all(
        items.map(item =>
          tx.memberProductCredit.create({
            data: {
              gymId,
              memberId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
              notes,
            },
          }),
        ),
      );

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return credits;
    });

    return created;
  }

  async getMemberCredits(gymId: string, memberId: string) {
    return this.prisma.memberProductCredit.findMany({
      where: { gymId, memberId },
      include: { product: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async payCredits(gymId: string, data: { creditIds: string[]; method: string }) {
    const { creditIds, method } = data;

    const credits = await this.prisma.memberProductCredit.findMany({
      where: { id: { in: creditIds }, gymId, isPaid: false },
      include: { product: true },
    });

    if (!credits.length) throw new BadRequestException('No hay créditos pendientes para saldar');

    const total = credits.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

    return this.prisma.$transaction(async tx => {
      const sale = await tx.productSale.create({
        data: {
          gymId,
          total,
          method: method as any,
          notes: 'Pago de créditos de miembro',
          items: {
            create: credits.map(c => ({
              productId: c.productId,
              quantity: c.quantity,
              unitPrice: c.unitPrice,
            })),
          },
        },
      });

      await tx.memberProductCredit.updateMany({
        where: { id: { in: creditIds } },
        data: { isPaid: true, paidAt: new Date(), paidSaleId: sale.id },
      });

      return { sale, settledCount: credits.length, total };
    });
  }

  private async assertProductExists(id: string, gymId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, gymId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  // ── Categories ───────────────────────────────────────────

  async findAllCategories(gymId: string) {
    return this.prisma.productCategory.findMany({
      where: { gymId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(gymId: string, data: { name: string; imageUrl?: string }) {
    return this.prisma.productCategory.create({
      data: { ...data, gymId },
    });
  }

  async updateCategory(id: string, gymId: string, data: { name?: string; imageUrl?: string }) {
    const cat = await this.prisma.productCategory.findFirst({ where: { id, gymId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return this.prisma.productCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string, gymId: string) {
    const cat = await this.prisma.productCategory.findFirst({ where: { id, gymId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return this.prisma.productCategory.delete({ where: { id } });
  }
}
