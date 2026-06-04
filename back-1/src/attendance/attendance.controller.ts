import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
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

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  deleteAttendance(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.deleteAttendance(req.gymId, id);
  }

  @Get('groups')
  findAllGroups(@Req() req: any) {
    return this.attendanceService.findAllGroups(req.gymId);
  }

  @Post('groups')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  createGroup(@Req() req: any, @Body() body: { name: string }) {
    return this.attendanceService.createGroup(req.gymId, body.name);
  }

  @Delete('groups/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  deleteGroup(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.deleteGroup(req.gymId, id);
  }

  @Post('checkin')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  checkIn(@Req() req: any, @Body() body: { memberId: string; branchId?: string; groupId?: string }) {
    return this.attendanceService.checkIn(req.gymId, body.memberId, body.branchId, body.groupId);
  }

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  checkOut(@Req() req: any, @Body() body: { memberId: string }) {
    return this.attendanceService.checkOut(req.gymId, body.memberId);
  }
}
