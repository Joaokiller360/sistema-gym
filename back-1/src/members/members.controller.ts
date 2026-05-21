import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('members')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.membersService.findAll(req.gymId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  create(@Req() req: any, @Body() body: any) {
    return this.membersService.create(req.gymId, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.membersService.findOne(id, req.gymId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.membersService.update(id, req.gymId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.membersService.remove(id, req.gymId);
  }
}
