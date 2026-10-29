import { Module } from '@nestjs/common';
import { ProductService } from '../services/product.service.js';
import { ProductController } from '../controllers/product.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule { }