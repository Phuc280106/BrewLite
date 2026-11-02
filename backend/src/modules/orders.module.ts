import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from './auth.module.js';
import { OrdersController } from '../controllers/orders.controller.js';
import { PaymentsController } from '../controllers/payments.controller.js';
import { OrdersService } from '../services/orders.service.js';
import { MockGatewayService } from '../services/mock-gateway.service.js';
import { OrderExpiryService } from '../services/order-expiry.service.js';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, AuthModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, MockGatewayService, OrderExpiryService],
})
export class OrdersModule {}
