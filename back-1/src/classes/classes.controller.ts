import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('classes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.classesService.findAll(req.gymId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.classesService.findOne(id, req.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  create(@Req() req: any, @Body() body: any) {
    return this.classesService.create(req.gymId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.classesService.update(id, req.gymId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.classesService.remove(id, req.gymId);
  }

  @Post(':id/enroll')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  enroll(@Param('id') classId: string, @Req() req: any, @Body() body: { memberId: string }) {
    return this.classesService.enroll(classId, req.gymId, body.memberId);
  }

  @Get(':id/attendance')
  getAttendance(@Param('id') classId: string, @Req() req: any) {
    return this.classesService.getAttendance(classId, req.gymId);
  }
}
