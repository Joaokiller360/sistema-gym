import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateTrainerDto, UpdateTrainerDto } from './dto/trainer.dto';

@Controller('trainers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TrainersController {
  constructor(private readonly trainersService: TrainersService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.trainersService.findAll(req.gymId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.trainersService.findOne(id, req.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  create(@Req() req: any, @Body() body: CreateTrainerDto) {
    return this.trainersService.create(req.gymId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateTrainerDto) {
    return this.trainersService.update(id, req.gymId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.trainersService.remove(id, req.gymId);
  }
}
