import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('attendance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.attendanceService.findAll(req.gymId, query);
  }

  @Post('checkin')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  checkIn(@Req() req: any, @Body() body: { memberId: string; branchId?: string }) {
    return this.attendanceService.checkIn(req.gymId, body.memberId, body.branchId);
  }

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  checkOut(@Req() req: any, @Body() body: { memberId: string }) {
    return this.attendanceService.checkOut(req.gymId, body.memberId);
  }
}
