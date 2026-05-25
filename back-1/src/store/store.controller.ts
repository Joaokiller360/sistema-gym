import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { StoreService } from './store.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CreateProductDto, UpdateProductDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSaleDto, AssignCreditsDto, PayCreditsDto,
} from './dto/store.dto';

@Controller('store')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ── Products ──────────────────────────────────────────
  @Get('products')
  findAllProducts(@Req() req: any, @Query() query: any) {
    return this.storeService.findAllProducts(req.gymId, query);
  }

  @Post('products')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  createProduct(@Req() req: any, @Body() body: CreateProductDto) {
    return this.storeService.createProduct(req.gymId, body);
  }

  @Patch('products/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  updateProduct(@Param('id') id: string, @Req() req: any, @Body() body: UpdateProductDto) {
    return this.storeService.updateProduct(id, req.gymId, body);
  }

  @Delete('products/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  deleteProduct(@Param('id') id: string, @Req() req: any) {
    return this.storeService.deleteProduct(id, req.gymId);
  }

  // ── Sales ─────────────────────────────────────────────
  @Post('sales')
  createSale(@Req() req: any, @Body() body: CreateSaleDto) {
    return this.storeService.createSale(req.gymId, body);
  }

  @Get('sales')
  findSales(@Req() req: any, @Query() query: any) {
    return this.storeService.findSales(req.gymId, query);
  }

  @Delete('sales/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  deleteSale(@Param('id') id: string, @Req() req: any) {
    return this.storeService.deleteSale(id, req.gymId);
  }

  // ── Cuts ──────────────────────────────────────────────
  @Get('cuts/daily')
  getDailyCut(@Req() req: any, @Query('date') date: string) {
    return this.storeService.getDailyCut(req.gymId, date ?? new Date().toISOString().split('T')[0]);
  }

  @Get('cuts/monthly')
  getMonthlyCut(@Req() req: any, @Query('month') month: string) {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.storeService.getMonthlyCut(req.gymId, month ?? defaultMonth);
  }

  // ── Categories ────────────────────────────────────────
  @Get('categories')
  findAllCategories(@Req() req: any) {
    return this.storeService.findAllCategories(req.gymId);
  }

  @Post('categories')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  createCategory(@Req() req: any, @Body() body: CreateCategoryDto) {
    return this.storeService.createCategory(req.gymId, body);
  }

  @Patch('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  updateCategory(@Param('id') id: string, @Req() req: any, @Body() body: UpdateCategoryDto) {
    return this.storeService.updateCategory(id, req.gymId, body);
  }

  @Delete('categories/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  deleteCategory(@Param('id') id: string, @Req() req: any) {
    return this.storeService.deleteCategory(id, req.gymId);
  }

  // ── Member credits ────────────────────────────────────
  @Post('credits')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  assignCredits(@Req() req: any, @Body() body: AssignCreditsDto) {
    return this.storeService.assignCredits(req.gymId, body);
  }

  @Get('credits')
  getAllCredits(@Req() req: any) {
    return this.storeService.getAllPendingCredits(req.gymId);
  }

  @Get('credits/:memberId')
  getMemberCredits(@Param('memberId') memberId: string, @Req() req: any) {
    return this.storeService.getMemberCredits(req.gymId, memberId);
  }

  @Post('credits/pay')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  payCredits(@Req() req: any, @Body() body: PayCreditsDto) {
    return this.storeService.payCredits(req.gymId, body);
  }
}
