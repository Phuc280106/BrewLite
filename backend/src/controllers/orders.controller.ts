import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { OrdersService } from '../services/orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('promotions')
  @ApiOperation({
    summary: 'Lấy danh sách mã khuyến mãi đang áp dụng',
  })
  getPromotions() {
    return this.ordersService.getPromotions();
  }

  @Get('promotions/validate')
  @ApiOperation({
    summary: 'Kiểm tra tính hợp lệ và số tiền giảm giá của mã khuyến mãi',
  })
  @ApiQuery({ name: 'code', example: 'BREW10' })
  @ApiQuery({ name: 'subtotal', example: 60000 })
  validatePromotion(
    @Query('code') code: string,
    @Query('subtotal') subtotal: string
  ) {
    return this.ordersService.validatePromotion(code, Number(subtotal) || 0);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  @ApiOperation({
    summary: 'Tạo đơn hàng ở trạng thái PENDING kèm mã khuyến mãi (Yêu cầu đăng nhập JWT)',
  })
  create(
    @Body() body: CreateOrderDto,
    @Request() req: { user: { id: number } }
  ) {
    return this.ordersService.create(body, req.user?.id);
  }
}
