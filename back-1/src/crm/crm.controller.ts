import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrmService } from './crm.service';
import {
  SendMessageDto,
  StartConversationDto,
  UpdateConversationDto,
} from './dto/crm.dto';

@Controller('admin/crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('config')
  config() {
    return this.crm.config();
  }

  @Get('summary')
  summary() {
    return this.crm.summary();
  }

  @Get('conversations')
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.crm.list(status, q);
  }

  @Post('conversations')
  start(@Body() dto: StartConversationDto) {
    return this.crm.start(dto.gymId);
  }

  @Get('conversations/:id')
  get(@Param('id') id: string) {
    return this.crm.get(id);
  }

  @Patch('conversations/:id')
  update(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.crm.update(id, dto);
  }

  @Delete('conversations/:id')
  remove(@Param('id') id: string) {
    return this.crm.remove(id);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string) {
    return this.crm.markRead(id);
  }

  @Post('conversations/:id/messages')
  reply(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.crm.reply(id, dto.body, adminId);
  }

  @Post('conversations/:id/template')
  sendTemplate(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.crm.sendContactTemplate(id, adminId);
  }
}
