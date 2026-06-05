import { Controller, Post, Get, Patch, Body, Param, Query, ParseIntPipe, DefaultValuePipe, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum } from 'class-validator';
import { AccessRequestStatus } from '@prisma/client';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

class UpdateStatusDto {
  @IsEnum(AccessRequestStatus)
  status: AccessRequestStatus;
}

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  create(@Body() dto: CreateAccessRequestDto) {
    return this.accessRequestsService.create(dto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findAll(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) {
    return this.accessRequestsService.findAll(limit);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.accessRequestsService.updateStatus(id, dto.status);
  }
}
