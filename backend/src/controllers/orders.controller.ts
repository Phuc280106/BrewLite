import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { UpdateOrderStatusDto } from '../dto/orders/update-order-status.dto.js';
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy lịch sử đơn hàng kèm món của user đang đăng nhập (GET /orders/me)',
  })
  findMyOrders(@Request() req: { user: { id: number } }) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy toàn bộ đơn hàng kèm món (Dành cho Barista / Nhân viên)',
  })
  findAll() {
    return this.ordersService.findAll();
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
