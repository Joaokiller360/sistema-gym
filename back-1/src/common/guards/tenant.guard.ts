import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    if (user.role === Role.SUPER_ADMIN) {
      const gymSlug = request.headers['x-gym-slug'];
      if (gymSlug) {
        const gym = await this.prisma.gym.findUnique({
          where: { slug: gymSlug },
          select: { id: true },
        });
        if (!gym) throw new ForbiddenException('Gimnasio no encontrado');
        request.gymId = gym.id;
      }
      return true;
    }

    if (!user.gymId) {
      throw new ForbiddenException('Usuario no asociado a ningún gimnasio');
    }

    const gym = await this.prisma.gym.findUnique({
      where: { id: user.gymId },
      select: { id: true, subscriptionStatus: true, isActive: true },
    });

    if (!gym) throw new ForbiddenException('Gym not found');

    if (gym.subscriptionStatus === 'SUSPENDED') {
      throw new ForbiddenException('Suscripción suspendida. Contacte al administrador para renovar el plan.');
    }

    request.gymId = user.gymId;
    return true;
  }
}
