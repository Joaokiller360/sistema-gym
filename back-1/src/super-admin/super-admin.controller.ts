import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
import { IsEnum, IsString, IsNotEmpty, IsOptional, IsArray, IsUUID, MaxLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

class SendComunicacionesDto {
  @IsEnum(['ALL', 'ACTIVE', 'INACTIVE', 'CUSTOM'])
  filter: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CUSTOM';

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  gymIds?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('gyms')
  findAllGyms() {
    return this.superAdminService.findAllGyms();
  }

  @Get('gyms/:id')
  findGymById(@Param('id') id: string) {
    return this.superAdminService.findGymById(id);
  }

  @Post('gyms')
  createGym(@Body() body: any) {
    return this.superAdminService.createGym(body);
  }

  @Patch('gyms/:id')
  updateGym(@Param('id') id: string, @Body() body: any) {
    return this.superAdminService.updateGym(id, body);
  }

  @Patch('gyms/:id/enable')
  enableGym(@Param('id') id: string) {
    return this.superAdminService.setGymActive(id, true);
  }

  @Patch('gyms/:id/disable')
  disableGym(@Param('id') id: string) {
    return this.superAdminService.setGymActive(id, false);
  }

  @Post('gyms/:id/owner')
  assignOwner(@Param('id') id: string, @Body() body: { ownerId: string }) {
    return this.superAdminService.assignOwner(id, body.ownerId);
  }

  @Post('gyms/:id/resend-welcome')
  resendWelcomeEmail(@Param('id') id: string) {
    return this.superAdminService.resendWelcomeEmail(id);
  }

  @Patch('gyms/:id/owner-profile')
  updateOwnerProfile(@Param('id') id: string, @Body() body: { name?: string; email?: string; password?: string }) {
    return this.superAdminService.updateOwnerProfile(id, body);
  }

  @Delete('gyms/:id')
  deleteGym(@Param('id') id: string) {
    return this.superAdminService.deleteGym(id);
  }

  @Get('subscription-plans')
  getSubscriptionPlans() {
    return this.superAdminService.getSubscriptionPlans();
  }

  @Post('subscription-plans')
  createSubscriptionPlan(@Body() body: any) {
    return this.superAdminService.createSubscriptionPlan(body);
  }

  @Patch('subscription-plans/:id')
  updateSubscriptionPlan(@Param('id') id: string, @Body() body: any) {
    return this.superAdminService.updateSubscriptionPlan(id, body);
  }

  @Delete('subscription-plans/:id')
  deleteSubscriptionPlan(@Param('id') id: string) {
    return this.superAdminService.deleteSubscriptionPlan(id);
  }

  @Patch('subscription-plans/:id/discount')
  setSubscriptionDiscount(
    @Param('id') id: string,
    @Body() body: { discountPercent: number; yearlyPrice?: number },
  ) {
    return this.superAdminService.setSubscriptionDiscount(id, body.discountPercent, body.yearlyPrice);
  }

  @Patch('subscription-plans/:id/discount/toggle')
  toggleSubscriptionDiscount(@Param('id') id: string) {
    return this.superAdminService.toggleSubscriptionDiscount(id);
  }

  @Post('gyms/:id/change-plan')
  changeGymPlan(
    @Param('id') id: string,
    @Body() body: { planKey: string; amount?: number; method?: string; notes?: string },
  ) {
    return this.superAdminService.changeGymPlan(id, body);
  }

  @Get('gyms/:id/subscription')
  getGymSubscription(@Param('id') id: string) {
    return this.superAdminService.getGymSubscription(id);
  }

  @Post('gyms/:id/subscription-payment')
  registerGymPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; currency?: string; method?: string; notes?: string },
  ) {
    return this.superAdminService.registerGymPayment(id, body);
  }

  @Get('gyms/:id/billing-history')
  getGymBillingHistory(@Param('id') id: string) {
    return this.superAdminService.getGymBillingHistory(id);
  }

  @Delete('gyms/:gymId/billing-history/:paymentId')
  deleteGymBillingPayment(
    @Param('gymId') gymId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.superAdminService.deleteGymBillingPayment(gymId, paymentId);
  }

  @Get('demo-requests')
  getDemoRequests(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.superAdminService.getDemoRequests({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      status,
    });
  }

  @Patch('demo-requests/:id/status')
  updateDemoRequestStatus(
    @Param('id') id: string,
    @Body() body: { status: 'PENDING' | 'CONTACTED' | 'DISMISSED' },
    @Req() req: any,
  ) {
    return this.superAdminService.updateDemoRequestStatus(id, body.status, req.user.userId);
  }

  @Get('dashboard')
  getDashboard() {
    return this.superAdminService.getDashboard();
  }

  @Post('platform-settings/logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/logos',
        filename: (_req, _file, cb) => {
          cb(null, `platform-${Date.now()}.jpg`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIMES.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
          return cb(new BadRequestException('Only image files allowed (jpg/png/webp/gif)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  uploadPlatformLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Logo es requerido');
    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.superAdminService.updatePlatformLogo(logoUrl);
  }

  @Patch('platform-settings')
  updatePlatformSettings(@Body() body: any) {
    return this.superAdminService.updatePlatformSettings(body);
  }

  @Post('comunicaciones/send')
  sendComunicaciones(@Body() dto: SendComunicacionesDto) {
    return this.superAdminService.sendComunicaciones(dto.filter, dto.gymIds, dto.subject, dto.body);
  }
}
