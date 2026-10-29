import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrmCommerceService } from './crm-commerce.service';
import { SendCatalogDto, SetCommerceDto } from './dto/crm.dto';

/** WhatsApp Business catalog: setup and sending products into a chat */
@Controller('admin/crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CrmCommerceController {
  constructor(private readonly commerce: CrmCommerceService) {}

  @Get('commerce')
  get() {
    return this.commerce.get();
  }

  @Patch('commerce')
  set(@Body() dto: SetCommerceDto) {
    return this.commerce.set(dto);
  }

  @Post('conversations/:id/catalog')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendCatalogDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.commerce.send(id, dto, adminId);
  }
}
