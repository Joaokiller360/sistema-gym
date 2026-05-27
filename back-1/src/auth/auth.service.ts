import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_TOKEN_DAYS = 30;

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
    const refresh_token = await this.createRefreshToken(user.id);

    return {
      access_token,
      refresh_token,
      user: {
        userId: user.id,
        role: user.role,
        gymId: user.gymId,
        gymSlug,
      },
    };
  }

  async refresh(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Usuario inactivo');
    }

    await this.prisma.refreshToken.delete({ where: { tokenHash } });

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
    const refresh_token = await this.createRefreshToken(user.id);

    return { access_token, refresh_token };
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { message: 'Sesión cerrada' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateMe(userId: string, data: { name?: string; email?: string }) {
    if (data.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) throw new ConflictException('Email ya en uso');
    }
    const safeData: { name?: string; email?: string } = {};
    if (data.name !== undefined) safeData.name = data.name;
    if (data.email !== undefined) safeData.email = data.email;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: safeData,
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    if (newPassword.length < 8) throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } });

    return raw;
  }
}
