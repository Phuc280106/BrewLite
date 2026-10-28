import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy lịch sử đơn hàng kèm món của user đang đăng nhập (GET /orders/me)',
  })
  findMyOrders(@Request() req: { user: { id: number } }) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @Patch(':id/status')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  @ApiOperation({
    summary: 'Cập nhật trạng thái đơn hàng theo State Machine (PATCH /orders/:id/status)',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateStatus(id, body.status);
  }
}
