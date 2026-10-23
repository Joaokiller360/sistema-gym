import { Module } from '@nestjs/common';
import { WalletPassService } from './wallet-pass.service';
import { WalletWalletClient } from './walletwallet.client';

/**
 * Pass building + syncing, split from WalletModule so Attendance and Memberships
 * can refresh passes without a circular import (WalletModule depends on Attendance).
 */
@Module({
  providers: [WalletWalletClient, WalletPassService],
  exports: [WalletWalletClient, WalletPassService],
})
export class WalletPassModule {}
