import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.paymentsService.findAll(req.gymId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
  create(@Req() req: any, @Body() body: any) {
    const gymId = req.gymId ?? body.gymId;
    return this.paymentsService.create(gymId, body);
  }

  @Get(':id/receipt')
  getReceipt(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.getReceipt(id, req.gymId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.paymentsService.remove(id, req.gymId);
  }
}
