import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductModule } from './modules/product/product.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OptionsModule } from './modules/options/options.module.js';
import { AuthModule } from './modules/auth/auth.module.js';


export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  //import các module của từng module nghiệp vụ vào
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    ProductModule,
    OrdersModule,
    OptionsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
