import {
  Controller, Get, Patch, Delete, Post,
  Param, Body, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { readFileSync, unlinkSync } from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fileType = require('file-type') as { fromBuffer: (buf: Buffer) => Promise<{ mime: string } | undefined> };
import { GymsService } from './gyms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { COUNTRY_TIMEZONES } from '../common/utils/timezone.util';

@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get('countries')
  getCountries() {
    return Object.entries(COUNTRY_TIMEZONES).map(([code, data]) => ({
      code,
      label: data.label,
      timezone: data.timezone,
      utcOffset: data.utcOffset,
    }));
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.gymsService.findBySlug(slug);
  }

  @Get(':slug/status')
  getStatus(@Param('slug') slug: string) {
    return this.gymsService.getStatus(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.gymsService.update(id, body, req.user?.userId, req.user?.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.gymsService.remove(id);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GYM_OWNER, Role.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (_req, _file, cb) => {
          cb(null, `${Date.now()}.jpg`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIMES.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
          return cb(new BadRequestException('Only image files allowed (jpg/png/webp/gif)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Logo es requerido');

    const ALLOWED_MAGIC_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const buf = readFileSync(file.path).slice(0, 20);
    const detected = await fileType.fromBuffer(buf);
    if (!detected || !ALLOWED_MAGIC_MIMES.includes(detected.mime)) {
      unlinkSync(file.path);
      throw new BadRequestException('Archivo de imagen inválido');
    }

    return this.gymsService.updateLogo(id, `/uploads/logos/${file.filename}`, req.user?.userId, req.user?.role);
  }

  @Get('staff/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GYM_OWNER)
  getStaff(@Req() req: any) {
    return this.gymsService.getStaff(req.user.gymId);
  }

  @Post('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GYM_OWNER)
  createStaff(@Req() req: any, @Body() body: { name: string; email: string }) {
    return this.gymsService.createStaff(req.user.gymId, body.name, body.email);
  }

  @Delete('staff/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GYM_OWNER)
  removeStaff(@Req() req: any, @Param('userId') userId: string) {
    return this.gymsService.removeStaff(req.user.gymId, userId);
  }
}
