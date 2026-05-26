import {
  Controller, Get, Post, Patch, Param, Body, Query, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateTicketDto, UpdateTicketDto } from './dto/support.dto';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.supportService.create(req.gymId, req.user.email, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  findAll(@Req() req: any, @Query('all') all: string) {
    const returnAll = req.user.role === Role.SUPER_ADMIN && all === 'true';
    const gymId = returnAll ? undefined : req.gymId;
    return this.supportService.findAll(gymId, returnAll);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.supportService.update(id, dto);
  }
}
