import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('marketing')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('templates')
  findAllTemplates(@Req() req: any) {
    return this.marketingService.findAllTemplates(req.gymId);
  }

  @Post('templates')
  createTemplate(@Req() req: any, @Body() body: any) {
    return this.marketingService.createTemplate(req.gymId, body);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.marketingService.updateTemplate(id, req.gymId, body);
  }

  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string, @Req() req: any) {
    return this.marketingService.removeTemplate(id, req.gymId);
  }

  @Get('campaigns')
  findAllCampaigns(@Req() req: any, @Query() query: any) {
    return this.marketingService.findAllCampaigns(req.gymId, query);
  }

  @Post('campaigns')
  createCampaign(@Req() req: any, @Body() body: any) {
    return this.marketingService.createCampaign(req.gymId, body);
  }

  @Post('campaigns/schedule')
  scheduleCampaign(@Req() req: any, @Body() body: any) {
    return this.marketingService.scheduleCampaign(req.gymId, body);
  }

  @Get('campaigns/:id/metrics')
  getCampaignMetrics(@Param('id') id: string, @Req() req: any) {
    return this.marketingService.getCampaignMetrics(id, req.gymId);
  }
}
