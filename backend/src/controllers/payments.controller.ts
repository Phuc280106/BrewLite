import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { InitiatePaymentDto } from '../dto/orders/initiate-payment.dto.js';
import { PaymentWebhookDto } from '../dto/orders/payment-webhook.dto.js';
import { OrdersService } from '../services/orders.service.js';
import { MockGatewayService } from '../services/mock-gateway.service.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly mockGatewayService: MockGatewayService
  ) {}

  /**
   * 1. Khách hàng bấm thanh toán -> Sinh mã VietQR Napas 24/7 động
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Khởi tạo phiên thanh toán và sinh mã VietQR Napas 24/7' })
  async initiatePayment(@Body() body: InitiatePaymentDto) {
    const order = await this.ordersService.getOrderStatus(body.orderId);

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Đơn hàng #${body.orderId} đang ở trạng thái "${order.status}", không thể khởi tạo thanh toán`
      );
    }

    const intent = this.mockGatewayService.createPaymentIntent(
      order.orderId,
      order.orderCode,
      order.total
    );

    return {
      orderId: order.orderId,
      orderCode: order.orderCode,
      total: order.total,
      method: body.method,
      paymentIntent: intent,
    };
  }

  /**
   * 2. Máy chủ Ngân hàng bắn Webhook (Server-to-Server IPN) kèm chữ ký số HMAC-SHA256
   */
  @Post('webhook')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Webhook nhận kết quả thanh toán từ Ngân hàng (Xác minh chữ ký số HMAC)' })
  async handleWebhook(
    @Headers('x-signature') signature: string,
    @Body() body: PaymentWebhookDto
  ) {
    this.logger.log(`[Webhook Inbound] Nhận Webhook cho đơn #${body.orderId} - Txn: ${body.transactionRef}`);

    // BẮT BUỘC: Kiểm tra chữ ký số HMAC để ngăn chặn giả mạo gói tin
    const isValidSignature = this.mockGatewayService.verifySignature(body, signature);
    if (!isValidSignature) {
      this.logger.error(`[Webhook Inbound] Chữ ký số không hợp lệ! Signature: ${signature}`);
      throw new ForbiddenException('Chữ ký số Webhook không hợp lệ! Giao dịch bị từ chối.');
    }

    // Chữ ký hợp lệ -> Chuyển vào Service xử lý cập nhật trạng thái đơn
    return this.ordersService.processPaymentWebhook(body);
  }

  /**
   * 3. Giả lập Ngân hàng chuyển khoản thành công (Dành riêng cho Demo / Trình bày trên lớp)
   */
  @Post('mock-bank/confirm')
  @ApiOperation({ summary: 'Mô phỏng app Mobile Banking quét mã và gửi Webhook thành công' })
  async mockBankConfirm(@Body('orderId', ParseIntPipe) orderId: number) {
    const order = await this.ordersService.getOrderStatus(orderId);
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Đơn hàng #${orderId} không ở trạng thái PENDING`);
    }

    // Đóng gói dữ liệu thanh toán từ phía ngân hàng
    const webhookPayload: PaymentWebhookDto = {
      transactionRef: `TXN_${Date.now()}_BL${orderId}`,
      orderId: order.orderId,
      amount: order.total,
      status: 'SUCCESS',
      message: `Chuyển khoản Napas247 cho đơn ${order.orderCode}`,
    };

    // Tạo chữ ký số hợp lệ từ Cổng thanh toán
    const validSignature = this.mockGatewayService.generateSignature(webhookPayload);

    this.logger.log(`[Mock Bank Simulator] Bắn Webhook chuyển tiền cho đơn #${orderId}...`);

    // Tự động gọi vào Webhook xử lý
    return this.handleWebhook(validSignature, webhookPayload);
  }

  /**
   * 4. Kiểm tra trạng thái đơn hàng (Dành cho Frontend Polling)
   */
  @Get('status/:orderId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái đơn hàng (Polling realtime)' })
  async checkStatus(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.ordersService.getOrderStatus(orderId);
  }
}
