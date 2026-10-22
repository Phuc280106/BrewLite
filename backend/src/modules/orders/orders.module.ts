import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersController } from './orders.controller.js';
import { PaymentsController } from './payments.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService],
})
export class OrdersModule {}
