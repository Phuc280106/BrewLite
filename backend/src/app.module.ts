import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ProductModule } from './modules/product/product.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OptionsModule } from './modules/options/options.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';


export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    ProductModule,
    OrdersModule,
    OptionsModule,
    AuthModule,
    PromotionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
