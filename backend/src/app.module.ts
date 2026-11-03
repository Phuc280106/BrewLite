import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller.js';
import { AppService } from './services/app.service.js';
import { ProductModule } from './modules/product.module.js';
import { OrdersModule } from './modules/orders.module.js';
import { OptionsModule } from './modules/options.module.js';
import { AuthModule } from './modules/auth.module.js';

@Module({
  // Import các module của từng nghiệp vụ vào
  imports: [
    ProductModule,
    OrdersModule,
    OptionsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
