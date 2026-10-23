import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { WalletPassModule } from '../wallet/wallet-pass.module';

@Module({
  imports: [WalletPassModule],
  controllers: [MembershipsController],
  providers: [MembershipsService]
})
export class MembershipsModule {}
