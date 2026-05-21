import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private resolveGymId(req: any, query: any): string {
    const gymId = req.gymId ?? query.gymId;
    if (!gymId) throw new BadRequestException('gymId es requerido');
    return gymId;
  }

  @Get('financial')
  financial(@Req() req: any, @Query() query: any) {
    return this.reportsService.financial(this.resolveGymId(req, query), query);
  }

  @Get('retention')
  retention(@Req() req: any, @Query() query: any) {
    return this.reportsService.retention(this.resolveGymId(req, query), query);
  }

  @Get('attendance')
  attendance(@Req() req: any, @Query() query: any) {
    return this.reportsService.attendance(this.resolveGymId(req, query), query);
  }

  @Get('classes')
  classes(@Req() req: any, @Query() query: any) {
    return this.reportsService.classes(this.resolveGymId(req, query), query);
  }
}
