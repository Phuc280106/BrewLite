import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Products') 
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả đồ uống' })
  findAll() {
    return this.productService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một đồ uống theo id' })
  @ApiParam({ name: 'id', example: 1, description: 'ID của sản phẩm' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id);
  }
}