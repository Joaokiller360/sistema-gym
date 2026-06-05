import {
  Controller, Post, Get, Patch, Body, Param, Query, Req, HttpCode,
  ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum } from 'class-validator';
import { AccessRequestStatus } from '@prisma/client';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ConvertAccessRequestDto } from './dto/convert-access-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

class UpdateStatusDto {
  @IsEnum(['PENDING', 'CONTACTED', 'DISMISSED'])
  status: AccessRequestStatus;
}

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  create(@Body() dto: CreateAccessRequestDto) {
    return this.accessRequestsService.create(dto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findAll(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status') status?: AccessRequestStatus,
  ) {
    return this.accessRequestsService.findAll(limit, offset, status);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.accessRequestsService.updateStatus(id, dto.status);
  }

  @Post('admin/:id/message')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.accessRequestsService.sendMessage(id, dto.message, dto.meetingLink);
  }

  @Post('admin/:id/convert')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  convert(@Param('id') id: string, @Body() dto: ConvertAccessRequestDto, @Req() req: any) {
    return this.accessRequestsService.convert(id, dto.gymName, req.user?.userId);
  }
}
