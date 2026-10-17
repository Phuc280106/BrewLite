import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

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
    summary: 'Tạo đơn hàng ở trạng thái PENDING (Yêu cầu đăng nhập JWT)',
  })
  create(
    @Body() body: CreateOrderDto,
    @Request() req: { user: { id: number } }
  ) {
    return this.ordersService.create(body, req.user?.id);
  }

  @Post(':id/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Thanh toán đơn hàng (idempotent qua Idempotency-Key header)',
  })
  async pay(
    @Param('id', ParseIntPipe) orderId: number,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: PayOrderDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Header Idempotency-Key là bắt buộc');
    }
    return this.ordersService.pay(orderId, idempotencyKey, body);
  }
}

