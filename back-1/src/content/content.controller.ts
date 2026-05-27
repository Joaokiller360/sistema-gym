import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateNewsDto } from './dto/create-news.dto';
import { CreateTutorialDto } from './dto/create-tutorial.dto';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ── News ────────────────────────────────────────────────────

  @Get('news')
  findAllNews() {
    return this.contentService.findAllNews();
  }

  @Post('news')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createNews(@Body() body: CreateNewsDto) {
    return this.contentService.createNews(body);
  }

  @Delete('news/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  removeNews(@Param('id') id: string) {
    return this.contentService.removeNews(id);
  }

  // ── Tutorials ───────────────────────────────────────────────

  @Get('tutorials')
  findAllTutorials() {
    return this.contentService.findAllTutorials();
  }

  @Post('tutorials')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createTutorial(@Body() body: CreateTutorialDto) {
    return this.contentService.createTutorial(body);
  }

  @Delete('tutorials/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  removeTutorial(@Param('id') id: string) {
    return this.contentService.removeTutorial(id);
  }
}
