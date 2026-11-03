import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { MessagePacksService } from '../notifications/message-packs.service';

class MessagePackDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  messages?: number;

  /** Currency units (e.g. 15.5), stored as cents */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn(['ONCE', 'MONTHLY'])
  billing?: 'ONCE' | 'MONTHLY';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  planKeys?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

class CostDto {
  @IsNumber()
  @Min(0)
  @Max(10)
  costPerMessage: number;
}

class ApproveDto {
  @IsOptional()
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  method?: string;
}

/** WhatsApp message packs: catalog, cost per message and the gyms' purchase requests */
@Controller('admin/messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class MessagePacksAdminController {
  constructor(private readonly packs: MessagePacksService) {}

  @Get('summary')
  summary() {
    return this.packs.summary();
  }

  @Patch('cost')
  setCost(@Body() body: CostDto) {
    return this.packs.setCost(body.costPerMessage);
  }

  @Get('packs')
  listPacks() {
    return this.packs.listPacks();
  }

  @Post('packs')
  createPack(@Body() body: MessagePackDto) {
    return this.packs.createPack(body);
  }

  @Patch('packs/:id')
  updatePack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MessagePackDto,
  ) {
    return this.packs.updatePack(id, body);
  }

  @Delete('packs/:id')
  deletePack(@Param('id', ParseUUIDPipe) id: string) {
    return this.packs.deletePack(id);
  }

  @Get('purchases')
  listPurchases(@Query('status') status?: string) {
    return this.packs.listPurchases(status);
  }

  @Patch('purchases/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() body: ApproveDto) {
    return this.packs.approve(id, body.method);
  }

  @Patch('purchases/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.packs.reject(id);
  }

  @Patch('purchases/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.packs.cancelMonthly(id);
  }
}
