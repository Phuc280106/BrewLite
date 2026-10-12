import { Controller, Get } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Products') 
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả đồ uống' })
  findAll() {
    return this.productService.findAll();
  }
}