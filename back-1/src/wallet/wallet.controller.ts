import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { WalletService } from './wallet.service';
import { IssuePassDto, ScanCreditDto, ScanSaleDto } from './dto/wallet.dto';

/**
 * Wallet passes (WalletWallet) and the reception QR scan.
 * For now a scan only records attendance, a store purchase or a "fiado" (credit).
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.GYM_OWNER, Role.GYM_ADMIN, Role.RECEPTIONIST)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  // ── Member pass ───────────────────────────────────────────

  @Get('members/:memberId/pass')
  getPass(@Req() req: any, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.wallet.getPass(req.gymId, memberId);
  }

  @Post('members/:memberId/pass')
  issuePass(
    @Req() req: any,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: IssuePassDto,
  ) {
    return this.wallet.issuePass(req.gymId, memberId, {
      sendEmail: body?.sendEmail,
    });
  }

  @Post('members/:memberId/pass/email')
  emailPass(
    @Req() req: any,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.wallet.emailPass(req.gymId, memberId);
  }

  @Delete('members/:memberId/pass')
  @Roles(Role.GYM_OWNER, Role.GYM_ADMIN)
  revokePass(
    @Req() req: any,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.wallet.revokePass(req.gymId, memberId);
  }

  // ── Reception scan ────────────────────────────────────────

  @Get('scan/:code')
  scan(@Req() req: any, @Param('code') code: string) {
    return this.wallet.scan(req.gymId, code);
  }

  @Post('scan/:code/checkin')
  checkIn(@Req() req: any, @Param('code') code: string) {
    return this.wallet.checkIn(req.gymId, code);
  }

  @Post('scan/:code/sale')
  sale(
    @Req() req: any,
    @Param('code') code: string,
    @Body() body: ScanSaleDto,
  ) {
    return this.wallet.sale(req.gymId, code, body);
  }

  @Post('scan/:code/credit')
  credit(
    @Req() req: any,
    @Param('code') code: string,
    @Body() body: ScanCreditDto,
  ) {
    return this.wallet.credit(req.gymId, code, body);
  }
}
