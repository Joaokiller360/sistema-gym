import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdvancedReportsGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (user?.role === 'SUPER_ADMIN') return true;

    const gymSlug =
      (req.headers['x-gym-slug'] as string | undefined) ?? user?.gymSlug;

    if (!gymSlug) throw new ForbiddenException('Gym no identificado');

    const gym = await this.prisma.gym.findUnique({
      where: { slug: gymSlug },
      select: { advancedReportsEnabled: true, subscriptionPlan: true },
    });

    if (!gym) throw new ForbiddenException('Gym no identificado');

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { key: gym.subscriptionPlan },
      select: { advancedReportsEnabled: true },
    });

    const hasAccess = gym.advancedReportsEnabled || (plan?.advancedReportsEnabled ?? false);
    if (!hasAccess) {
      throw new ForbiddenException('Reportes avanzados no disponibles en tu plan actual');
    }

    return true;
  }
}
