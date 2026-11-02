import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateCommunicationDto } from './dto/communication.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.GYM_OWNER)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  /** Inbox: messages from the platform team to the gym owner. */
  @Get()
  findAll(@Req() req: any, @Query() query: any) {
    return this.communicationsService.findAll(req.gymId, query);
  }

  /** Announcements sent by the gym to its members. */
  @Get('announcements')
  listAnnouncements(@Req() req: any) {
    return this.communicationsService.listAnnouncements(req.gymId);
  }

  @Get('announcements/quota')
  quota(@Req() req: any) {
    return this.communicationsService.getAnnouncementQuota(req.gymId);
  }

  @Post('announcements')
  send(@Req() req: any, @Body() body: CreateCommunicationDto) {
    return this.communicationsService.sendAnnouncement(
      req.gymId,
      req.user?.userId,
      body,
    );
  }
}
