import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.plansService.findAll(req.gymId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.plansService.findOne(id, req.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN)
  create(@Req() req: any, @Body() body: CreatePlanDto) {
    return this.plansService.create(req.gymId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdatePlanDto) {
    return this.plansService.update(id, req.gymId, body);
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN)
  toggle(@Param('id') id: string, @Req() req: any) {
    return this.plansService.toggle(id, req.gymId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.plansService.remove(id, req.gymId);
  }
}
