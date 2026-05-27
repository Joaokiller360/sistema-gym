import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.branchesService.findAll(req.gymId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.branchesService.findOne(id, req.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  create(@Req() req: any, @Body() body: CreateBranchDto) {
    return this.branchesService.create(req.gymId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateBranchDto) {
    return this.branchesService.update(id, req.gymId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.branchesService.remove(id, req.gymId);
  }
}
