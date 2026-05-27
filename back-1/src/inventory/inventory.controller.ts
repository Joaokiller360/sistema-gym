import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateInventoryItemDto, UpdateInventoryItemDto, CreateMaintenanceDto } from './dto/inventory.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.inventoryService.findAll(req.gymId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.inventoryService.findOne(id, req.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  create(@Req() req: any, @Body() body: CreateInventoryItemDto) {
    return this.inventoryService.create(req.gymId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, req.gymId, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.inventoryService.remove(id, req.gymId);
  }

  @Patch(':id/maintenance')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  registerMaintenance(@Param('id') id: string, @Req() req: any, @Body() body: CreateMaintenanceDto) {
    return this.inventoryService.registerMaintenance(id, req.gymId, body);
  }
}
