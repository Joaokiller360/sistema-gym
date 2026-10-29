import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CrmCatalogService } from './crm-catalog.service';
import { ProductDto, SendProductDto, UpdateProductDto } from './dto/crm.dto';

@Controller('admin/crm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CrmCatalogController {
  constructor(private readonly catalog: CrmCatalogService) {}

  @Get('products')
  list() {
    return this.catalog.list();
  }

  @Post('products')
  create(@Body() dto: ProductDto) {
    return this.catalog.create(dto);
  }

  @Patch('products/:pid')
  update(
    @Param('pid', ParseUUIDPipe) pid: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.update(pid, dto);
  }

  @Delete('products/:pid')
  remove(@Param('pid', ParseUUIDPipe) pid: string) {
    return this.catalog.remove(pid);
  }

  /** Kept as sent; the service checks it's really a JPG/PNG */
  @Post('products/:pid/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  setPhoto(
    @Param('pid', ParseUUIDPipe) pid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Falta la foto');
    return this.catalog.setPhoto(pid, file);
  }

  @Delete('products/:pid/photo')
  removePhoto(@Param('pid', ParseUUIDPipe) pid: string) {
    return this.catalog.removePhoto(pid);
  }

  @Post('conversations/:id/products/:pid')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @Body() dto: SendProductDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.catalog.send(id, pid, adminId, dto.replyToId);
  }
}
