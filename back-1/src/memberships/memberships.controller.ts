import { Controller, Post, Patch, Get, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('memberships')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.membershipsService.findAll(req.gymId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  create(@Req() req: any, @Body() body: any) {
    return this.membershipsService.create(req.gymId, body);
  }

  @Patch(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  suspend(@Param('id') id: string, @Req() req: any) {
    return this.membershipsService.suspend(id, req.gymId);
  }

  @Patch(':id/freeze')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  freeze(@Param('id') id: string, @Req() req: any) {
    return this.membershipsService.freeze(id, req.gymId);
  }

  @Patch(':id/unfreeze')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  unfreeze(@Param('id') id: string, @Req() req: any) {
    return this.membershipsService.unfreeze(id, req.gymId);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.membershipsService.cancel(id, req.gymId);
  }

  @Post(':id/change-plan')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  changePlan(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { planId: string; method?: string; notes?: string },
  ) {
    return this.membershipsService.changePlan(id, req.gymId, body);
  }
}
