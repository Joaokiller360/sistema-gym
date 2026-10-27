import { Controller, Get, Post, Query, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportPdfService } from './report-pdf.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AdvancedReportsGuard } from './guards/advanced-reports.guard';

@SkipThrottle()
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.GYM_OWNER)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportPdf: ReportPdfService,
  ) {}

  private resolveGymId(req: any, query: any): string {
    const gymId = req.gymId ?? query.gymId;
    if (!gymId) throw new BadRequestException('gymId es requerido');
    return gymId;
  }

  @Get('financial')
  financial(@Req() req: any, @Query() query: any) {
    return this.reportsService.financial(this.resolveGymId(req, query), query);
  }

  @Get('retention')
  retention(@Req() req: any, @Query() query: any) {
    return this.reportsService.retention(this.resolveGymId(req, query), query);
  }

  @Get('attendance')
  attendance(@Req() req: any, @Query() query: any) {
    return this.reportsService.attendance(this.resolveGymId(req, query), query);
  }

  @Get('classes')
  classes(@Req() req: any, @Query() query: any) {
    return this.reportsService.classes(this.resolveGymId(req, query), query);
  }

  @Get('advanced')
  @UseGuards(JwtAuthGuard, AdvancedReportsGuard)
  advanced(@Req() req: any, @Query() query: any) {
    return this.reportsService.advanced(this.resolveGymId(req, query), query);
  }

  @Get('advanced/pdf')
  @UseGuards(JwtAuthGuard, AdvancedReportsGuard)
  async advancedPdf(@Req() req: any, @Query() query: any, @Res() res: Response) {
    const { buffer, filename } = await this.reportPdf.generate(this.resolveGymId(req, query), String(query.month ?? ''));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }

  @Post('advanced/pdf/email')
  @SkipThrottle({ default: false })
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @UseGuards(JwtAuthGuard, AdvancedReportsGuard)
  advancedPdfEmail(@Req() req: any, @Query() query: any) {
    return this.reportPdf.sendToOwner(this.resolveGymId(req, query), String(query.month ?? ''), req.user?.email);
  }
}
