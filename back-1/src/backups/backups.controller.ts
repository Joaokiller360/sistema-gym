import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BackupsService } from './backups.service';
import { BackupKeyDto } from './dto/backups.dto';

@Controller('admin/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get('config')
  config() {
    return this.backups.config();
  }

  @Get()
  list() {
    return this.backups.list();
  }

  @Post()
  @HttpCode(202)
  run() {
    return this.backups.startManual();
  }

  @Post('download')
  @HttpCode(200)
  download(@Body() dto: BackupKeyDto) {
    return this.backups.downloadUrl(dto.key);
  }

  @Delete()
  delete(@Body() dto: BackupKeyDto) {
    return this.backups.delete(dto.key);
  }
}
