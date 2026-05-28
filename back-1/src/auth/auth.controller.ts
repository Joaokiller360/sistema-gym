import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  register(@Body() body: { ownerName: string; email: string; phone?: string; gymName: string; planId?: string; isTrial?: boolean }) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  refresh(@Body() body: { refresh_token: string }) {
    if (!body.refresh_token) throw new BadRequestException('refresh_token requerido');
    return this.authService.refresh(body.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: { refresh_token: string }) {
    if (!body.refresh_token) return { message: 'Sesión cerrada' };
    return this.authService.logout(body.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: any, @Body() body: { name?: string; email?: string }) {
    return this.authService.updateMe(req.user.userId, body);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }
}
