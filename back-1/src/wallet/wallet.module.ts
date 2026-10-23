import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { StoreModule } from '../store/store.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletPassModule } from './wallet-pass.module';

@Module({
  imports: [AttendanceModule, StoreModule, WalletPassModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
