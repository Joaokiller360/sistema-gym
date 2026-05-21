import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales incorrectas');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');

    let gymSlug: string | undefined;
    if (user.gymId) {
      const gym = await this.prisma.gym.findUnique({
        where: { id: user.gymId },
        select: { slug: true },
      });
      gymSlug = gym?.slug;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId ?? undefined,
      gymSlug,
    };

    const access_token = this.jwt.sign(payload);

    return {
      access_token,
      user: {
        userId: user.id,
        role: user.role,
        gymId: user.gymId,
        gymSlug,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    if (newPassword.length < 6) throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Contraseña actualizada correctamente' };
  }
}
