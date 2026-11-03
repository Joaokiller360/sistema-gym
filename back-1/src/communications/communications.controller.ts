import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
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
import {
  CreateCommunicationDto,
  TestAnnouncementDto,
} from './dto/communication.dto';
import { MessagePacksService } from '../notifications/message-packs.service';

@Controller('communications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.GYM_OWNER)
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly packs: MessagePacksService,
  ) {}

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

  /** Sends the draft to the gym's own WhatsApp; uses 1 message */
  @Post('announcements/test')
  sendTest(@Req() req: any, @Body() body: TestAnnouncementDto) {
    return this.communicationsService.sendTest(req.gymId, body);
  }

  /** Packs the gym's plan can buy, plus its pending requests and active monthly packs */
  @Get('message-packs')
  messagePacks(@Req() req: any) {
    return this.packs.forGym(req.gymId);
  }

  /** Asks for a pack; messages are added once the platform confirms the payment */
  @Post('message-packs/:id/request')
  requestPack(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.packs.request(req.gymId, id, req.user?.userId);
  }

  @Post('message-purchases/:id/cancel')
  cancelPurchase(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.packs.cancelOwn(req.gymId, id);
  }
}
