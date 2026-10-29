import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrmService } from './crm.service';
import {
  LANGUAGE,
  TEMPLATE_NAME,
  cleanText,
} from '../common/validators/text.validator';
import {
  CreateAccountDto,
  CreateTemplateDto,
  QuickReplyDto,
  SendAnyTemplateDto,
  SendMediaDto,
  SendMessageDto,
  SendTemplateDto,
  SetAlertsDto,
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

  @Patch('alerts')
  setAlerts(@Body() dto: SetAlertsDto) {
    return this.crm.setAlertsPaused(dto.paused);
  }

  @Get('profile')
  profile() {
    return this.crm.profile();
  }

  /** Kept in memory only: the bytes go straight on to Zernio/Meta */
  @Post('profile/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          return cb(new BadRequestException('Solo JPG o PNG'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  setProfilePhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta la foto');
    return this.crm.setProfilePhoto(file);
  }

  /** ?conversation=<id> prefills each template's values for that contact */
  @Get('templates')
  templates(@Query('conversation') conversation?: string) {
    return this.crm.templates(conversation);
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.crm.createTemplate(dto);
  }

  @Delete('templates/:name')
  deleteTemplate(
    @Param('name') name: string,
    @Query('language') language = 'es',
  ) {
    if (!TEMPLATE_NAME.test(name) || !LANGUAGE.test(language)) {
      throw new BadRequestException('Plantilla inválida');
    }
    return this.crm.deleteTemplate(name, language);
  }

  @Get('quick-replies')
  quickReplies() {
    return this.crm.quickReplies();
  }

  @Post('quick-replies')
  createQuickReply(@Body() dto: QuickReplyDto) {
    return this.crm.createQuickReply(dto);
  }

  @Patch('quick-replies/:qid')
  updateQuickReply(@Param('qid') qid: string, @Body() dto: QuickReplyDto) {
    return this.crm.updateQuickReply(qid, dto);
  }

  @Delete('quick-replies/:qid')
  deleteQuickReply(@Param('qid') qid: string) {
    return this.crm.deleteQuickReply(qid);
  }

  @Get('summary')
  summary() {
    return this.crm.summary();
  }

  @Get('conversations')
  list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('tag') tag?: string,
  ) {
    // Prisma binds it as a parameter; capped and cleaned so a huge or invisible query can't slow the search
    const search =
      typeof q === 'string'
        ? (cleanText(q) as string).slice(0, 100)
        : undefined;
    return this.crm.list(status, search, tag?.slice(0, 30));
  }

  @Post('conversations')
  start(@Body() dto: StartConversationDto) {
    return this.crm.start(dto);
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

  @Patch('conversations/:id/messages/:messageId')
  editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.crm.editQueued(id, messageId, dto.body);
  }

  @Delete('conversations/:id/messages/:messageId')
  deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.crm.deleteQueued(id, messageId);
  }

  @Post('conversations/:id/messages/:messageId/send-now')
  sendNow(@Param('id') id: string, @Param('messageId') messageId: string) {
    return this.crm.sendNow(id, messageId);
  }

  /** Photo/video; the service checks the real type from the bytes */
  @Post('conversations/:id/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 16 * 1024 * 1024, files: 1 },
    }),
  )
  sendMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendMediaDto,
    @CurrentUser('userId') adminId: string,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
    return this.crm.sendMedia(id, file, dto.caption, adminId);
  }

  /** Gym + owner login for this contact; returns the password once */
  @Post('conversations/:id/account')
  createAccount(
    @Param('id') id: string,
    @Body() dto: CreateAccountDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.crm.createAccount(id, dto, adminId);
  }

  @Post('conversations/:id/templates')
  sendAnyTemplate(
    @Param('id') id: string,
    @Body() dto: SendAnyTemplateDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.crm.sendTemplate(id, dto, adminId);
  }

  @Post('conversations/:id/template')
  sendTemplate(
    @Param('id') id: string,
    @Body() dto: SendTemplateDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.crm.sendContactTemplate(id, adminId, dto.kind);
  }
}
