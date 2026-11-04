import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessagePurchaseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MessagePackInput {
  name?: string;
  messages?: number;
  /** In currency units; stored as cents */
  price?: number;
  currency?: string;
  billing?: 'ONCE' | 'MONTHLY';
  planKeys?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

const PURCHASE_SELECT = {
  id: true,
  name: true,
  messages: true,
  price: true,
  currency: true,
  billing: true,
  status: true,
  method: true,
  paidAt: true,
  cancelledAt: true,
  createdAt: true,
} satisfies Prisma.MessagePackPurchaseSelect;

/** Message packs (catalog, gym requests, admin approval). Billing is manual, like subscriptions. */
@Injectable()
export class MessagePacksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Catalog (super-admin) ─────────────────────────────────
  listPacks() {
    return this.prisma.messagePack.findMany({
      orderBy: [{ sortOrder: 'asc' }, { messages: 'asc' }],
    });
  }

  private async packData(data: MessagePackInput, partial: boolean) {
    const out: Prisma.MessagePackUncheckedUpdateInput = {};
    if (data.name !== undefined || !partial) {
      const name = String(data.name ?? '').trim();
      if (!name || name.length > 60)
        throw new BadRequestException('Nombre requerido (máx. 60 caracteres)');
      out.name = name;
    }
    if (data.messages !== undefined || !partial) {
      const n = Math.floor(Number(data.messages));
      if (!Number.isFinite(n) || n < 1 || n > 1_000_000)
        throw new BadRequestException('Cantidad de mensajes inválida');
      out.messages = n;
    }
    if (data.price !== undefined || !partial) {
      const p = Number(data.price);
      if (!Number.isFinite(p) || p <= 0 || p > 1_000_000)
        throw new BadRequestException('Precio inválido');
      out.price = Math.round(p * 100);
    }
    if (data.currency !== undefined) {
      if (!/^[A-Z]{3}$/.test(data.currency))
        throw new BadRequestException('Moneda inválida');
      out.currency = data.currency;
    }
    if (data.billing !== undefined) {
      if (data.billing !== 'ONCE' && data.billing !== 'MONTHLY')
        throw new BadRequestException('Tipo de cobro inválido');
      out.billing = data.billing;
    }
    if (data.planKeys !== undefined) {
      if (!Array.isArray(data.planKeys))
        throw new BadRequestException('Planes inválidos');
      const keys = [...new Set(data.planKeys.map(String))];
      const found = await this.prisma.subscriptionPlan.count({
        where: { key: { in: keys } },
      });
      if (found !== keys.length)
        throw new BadRequestException('Uno o más planes no existen');
      out.planKeys = keys;
    }
    if (data.isActive !== undefined) out.isActive = !!data.isActive;
    if (data.sortOrder !== undefined)
      out.sortOrder = Math.floor(Number(data.sortOrder)) || 0;
    return out;
  }

  async createPack(data: MessagePackInput) {
    const d = (await this.packData(
      data,
      false,
    )) as Prisma.MessagePackUncheckedCreateInput;
    return this.prisma.messagePack.create({ data: d });
  }

  async updatePack(id: string, data: MessagePackInput) {
    await this.findPack(id);
    return this.prisma.messagePack.update({
      where: { id },
      data: await this.packData(data, true),
    });
  }

  async deletePack(id: string) {
    await this.findPack(id);
    // Purchases keep their own copy of name/messages/price; packId goes null
    return this.prisma.messagePack.delete({ where: { id } });
  }

  private async findPack(id: string) {
    const pack = await this.prisma.messagePack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Pack no encontrado');
    return pack;
  }

  // ── Gym side ──────────────────────────────────────────────
  async forGym(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { subscriptionPlan: true },
    });
    if (!gym) throw new NotFoundException('Gym no encontrado');
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { key: gym.subscriptionPlan },
      select: { messagePacksEnabled: true },
    });
    const enabled = plan?.messagePacksEnabled ?? false;
    const [packs, purchases] = await Promise.all([
      enabled
        ? this.prisma.messagePack.findMany({
            where: { isActive: true, planKeys: { has: gym.subscriptionPlan } },
            orderBy: [{ sortOrder: 'asc' }, { messages: 'asc' }],
            select: {
              id: true,
              name: true,
              messages: true,
              price: true,
              currency: true,
              billing: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.messagePackPurchase.findMany({
        where: {
          gymId,
          OR: [{ status: 'PENDING' }, { status: 'ACTIVE', billing: 'MONTHLY' }],
        },
        orderBy: { createdAt: 'desc' },
        select: { ...PURCHASE_SELECT, packId: true },
      }),
    ]);
    return { enabled, packs, purchases };
  }

  async request(gymId: string, packId: string, userId?: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { subscriptionPlan: true },
    });
    if (!gym) throw new NotFoundException('Gym no encontrado');
    const [plan, pack] = await Promise.all([
      this.prisma.subscriptionPlan.findUnique({
        where: { key: gym.subscriptionPlan },
        select: { messagePacksEnabled: true },
      }),
      this.prisma.messagePack.findUnique({ where: { id: packId } }),
    ]);
    if (!plan?.messagePacksEnabled)
      throw new ForbiddenException(
        'Tu plan no permite comprar packs de mensajes',
      );
    if (
      !pack ||
      !pack.isActive ||
      !pack.planKeys.includes(gym.subscriptionPlan)
    ) {
      throw new NotFoundException('Pack no disponible para tu plan');
    }
    const open = await this.prisma.messagePackPurchase.findFirst({
      where: {
        gymId,
        packId,
        OR: [
          { status: 'PENDING' },
          ...(pack.billing === 'MONTHLY'
            ? [{ status: 'ACTIVE' as const }]
            : []),
        ],
      },
      select: { status: true },
    });
    if (open) {
      throw new ConflictException(
        open.status === 'PENDING'
          ? 'Ya pediste este pack: está esperando el pago'
          : 'Ya tienes este extra mensual activo',
      );
    }
    return this.prisma.messagePackPurchase.create({
      data: {
        gymId,
        packId,
        name: pack.name,
        messages: pack.messages,
        price: pack.price,
        currency: pack.currency,
        billing: pack.billing,
        requestedById: userId ?? null,
      },
      select: PURCHASE_SELECT,
    });
  }

  /** The gym withdraws a pending request or stops a monthly pack */
  async cancelOwn(gymId: string, purchaseId: string) {
    const p = await this.prisma.messagePackPurchase.findFirst({
      where: { id: purchaseId, gymId },
    });
    if (!p) throw new NotFoundException('Compra no encontrada');
    if (p.status === 'PENDING') {
      return this.prisma.messagePackPurchase.update({
        where: { id: p.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        select: PURCHASE_SELECT,
      });
    }
    if (p.status === 'ACTIVE' && p.billing === 'MONTHLY')
      return this.cancelMonthly(p.id);
    throw new BadRequestException('Esta compra ya no se puede cancelar');
  }

  // ── Requests (super-admin) ────────────────────────────────
  /** status=PAID lists the sales that count as income (same rule as summary), for the income page */
  listPurchases(status?: string) {
    if (status === 'PAID') {
      return this.prisma.messagePackPurchase.findMany({
        where: {
          paidAt: { not: null },
          // A voided one-time pack was refunded; a cancelled monthly one was still paid
          OR: [
            { status: 'ACTIVE' },
            { status: 'CANCELLED', billing: 'MONTHLY' },
          ],
        },
        orderBy: { paidAt: 'desc' },
        take: 2000,
        select: {
          ...PURCHASE_SELECT,
          gym: { select: { id: true, name: true, slug: true } },
        },
      });
    }
    const valid = ['PENDING', 'ACTIVE', 'CANCELLED', 'REJECTED'];
    return this.prisma.messagePackPurchase.findMany({
      where:
        status && valid.includes(status)
          ? { status: status as MessagePurchaseStatus }
          : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        ...PURCHASE_SELECT,
        gym: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /** Payment received: activates the purchase; one-time packs add their messages as credits */
  async approve(id: string, method?: string) {
    if (
      method !== undefined &&
      !Object.values(PaymentMethod).includes(method as PaymentMethod)
    ) {
      throw new BadRequestException('Método de pago inválido');
    }
    return this.prisma.$transaction(async (tx) => {
      // Conditional update: approving twice can't add the credits twice
      const res = await tx.messagePackPurchase.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          paidAt: new Date(),
          method: (method as PaymentMethod) ?? 'CASH',
        },
      });
      if (res.count === 0)
        throw new BadRequestException('La compra no está pendiente');
      const p = await tx.messagePackPurchase.findUniqueOrThrow({
        where: { id },
      });
      if (p.billing === 'ONCE') {
        await tx.gym.update({
          where: { id: p.gymId },
          data: { messageCredits: { increment: p.messages } },
        });
      }
      return tx.messagePackPurchase.findUniqueOrThrow({
        where: { id },
        select: PURCHASE_SELECT,
      });
    });
  }

  async reject(id: string) {
    const res = await this.prisma.messagePackPurchase.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', cancelledAt: new Date() },
    });
    if (res.count === 0)
      throw new BadRequestException('La compra no está pendiente');
    return { ok: true };
  }

  async cancelMonthly(id: string) {
    const res = await this.prisma.messagePackPurchase.updateMany({
      where: { id, status: 'ACTIVE', billing: 'MONTHLY' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (res.count === 0)
      throw new BadRequestException('No es un extra mensual activo');
    return this.prisma.messagePackPurchase.findUniqueOrThrow({
      where: { id },
      select: PURCHASE_SELECT,
    });
  }

  /**
   * Voids a sale. Pending → rejected; monthly → stops adding messages;
   * one-time → takes back the credits the gym hasn't used yet.
   */
  async cancel(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const p = await this.lockPurchase(tx, id);
      if (p.status !== 'PENDING' && p.status !== 'ACTIVE')
        throw new BadRequestException('Esta venta ya está anulada');
      const removedCredits =
        p.status === 'ACTIVE' ? await this.takeBackCredits(tx, p) : 0;
      await tx.messagePackPurchase.update({
        where: { id },
        data: {
          status: p.status === 'PENDING' ? 'REJECTED' : 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
      return { ok: true, removedCredits };
    });
  }

  /** Erases a sale (e.g. entered by mistake). An active one is voided first. */
  async deletePurchase(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const p = await this.lockPurchase(tx, id);
      const removedCredits =
        p.status === 'ACTIVE' ? await this.takeBackCredits(tx, p) : 0;
      await tx.messagePackPurchase.delete({ where: { id } });
      return { ok: true, removedCredits };
    });
  }

  /** Same lock as quota consumption, so credits can't be spent while we take them back */
  private async lockPurchase(tx: Prisma.TransactionClient, id: string) {
    const found = await tx.messagePackPurchase.findUnique({
      where: { id },
      select: { gymId: true },
    });
    if (!found) throw new NotFoundException('Venta no encontrada');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quota:' + found.gymId}))`;
    return tx.messagePackPurchase.findUniqueOrThrow({ where: { id } });
  }

  /** One-time packs gave credits: remove them, but only what is left (never below 0) */
  private async takeBackCredits(
    tx: Prisma.TransactionClient,
    p: { billing: string; messages: number; gymId: string },
  ) {
    if (p.billing !== 'ONCE') return 0;
    const gym = await tx.gym.findUniqueOrThrow({
      where: { id: p.gymId },
      select: { messageCredits: true },
    });
    const take = Math.min(p.messages, Math.max(gym.messageCredits, 0));
    if (take > 0) {
      await tx.gym.update({
        where: { id: p.gymId },
        data: { messageCredits: { decrement: take } },
      });
    }
    return take;
  }

  // ── Cost & usage (super-admin) ────────────────────────────
  async getConfig() {
    return this.prisma.messagingConfig.upsert({
      where: { id: '1' },
      create: { id: '1' },
      update: {},
    });
  }

  async setCost(costPerMessage: unknown) {
    const c = Number(costPerMessage);
    if (!Number.isFinite(c) || c < 0 || c > 10)
      throw new BadRequestException('Costo por mensaje inválido');
    return this.prisma.messagingConfig.upsert({
      where: { id: '1' },
      create: { id: '1', costPerMessage: c },
      update: { costPerMessage: c },
    });
  }

  /** This calendar month (UTC): messages sent by all gyms, what they cost, what packs brought in */
  async summary() {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [config, usage, sold, monthly, pending] = await Promise.all([
      this.getConfig(),
      this.prisma.messageUsage.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { count: true },
      }),
      this.prisma.messagePackPurchase.aggregate({
        where: {
          paidAt: { gte: start },
          // A voided one-time pack was refunded; a cancelled monthly one was still paid
          OR: [
            { status: 'ACTIVE' },
            { status: 'CANCELLED', billing: 'MONTHLY' },
          ],
        },
        _sum: { price: true },
      }),
      this.prisma.messagePackPurchase.aggregate({
        where: { status: 'ACTIVE', billing: 'MONTHLY' },
        _sum: { price: true },
        _count: true,
      }),
      this.prisma.messagePackPurchase.count({ where: { status: 'PENDING' } }),
    ]);
    const messages = usage._sum.count ?? 0;
    return {
      costPerMessage: config.costPerMessage,
      messagesThisMonth: messages,
      // Plain number, not a cents field: the money interceptor must leave it alone
      spentThisMonth: Math.round(messages * config.costPerMessage * 100) / 100,
      packRevenueCents: sold._sum.price ?? 0,
      monthlyRecurringCents: monthly._sum.price ?? 0,
      activeMonthly: monthly._count,
      pendingRequests: pending,
    };
  }
}
