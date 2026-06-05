import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import * as express from 'express';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService],
})
export class AccessRequestsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(express.json({ limit: '2kb' }))
      .forRoutes({ path: 'access-requests', method: RequestMethod.POST });
  }
}
