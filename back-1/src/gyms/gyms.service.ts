import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { isGymOpen, GymSchedule } from '../common/utils/timezone.util';

@Injectable()
export class GymsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        country: true,
        timezone: true,
        currency: true,
        schedule: true,
        isActive: true,
        subscriptionPlan: true,
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    const subscriptionPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { key: gym.subscriptionPlan },
      select: { storeEnabled: true },
    });
    const storeEnabled = subscriptionPlan?.storeEnabled ?? false;
    return { ...gym, storeEnabled };
  }

  async getStatus(slug: string) {
    const gym = await this.prisma.gym.findUnique({ where: { slug }, select: { timezone: true, schedule: true } });
    if (!gym) throw new NotFoundException('Gym not found');
    const tz = gym.timezone ?? 'UTC';
    const now = new Date();
    const localTime = now.toLocaleTimeString('es', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const isOpen = gym.schedule ? isGymOpen(gym.schedule as GymSchedule, tz, now) : null;
    return { timezone: tz, localTime, isOpen };
  }

  async update(id: string, data: any) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    return this.prisma.gym.update({ where: { id }, data });
  }

  async remove(id: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    await this.prisma.gym.delete({ where: { id } });
    return { message: 'Gym deleted successfully' };
  }

  async updateLogo(id: string, logoUrl: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');

    if (gym.logoUrl?.startsWith('/uploads/logos/')) {
      const oldPath = join(process.cwd(), gym.logoUrl);
      unlink(oldPath).catch(() => null);
    }

    return this.prisma.gym.update({ where: { id }, data: { logoUrl } });
  }

  async getStaff(gymId: string) {
    return this.prisma.user.findMany({
      where: { gymId, role: 'GYM_ADMIN' },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(gymId: string, name: string, email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashed = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: { name, email, password: hashed, role: 'GYM_ADMIN', gymId, isActive: true },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });

    return { ...user, tempPassword };
  }

  async removeStaff(gymId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, gymId, role: 'GYM_ADMIN' } });
    if (!user) throw new NotFoundException('Administrador no encontrado');
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Administrador eliminado' };
  }
}
