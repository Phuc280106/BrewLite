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
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { InitiatePaymentDto, PaymentMethodEnum } from '../dto/orders/initiate-payment.dto.js';
import { PaymentWebhookDto } from '../dto/orders/payment-webhook.dto.js';
import { OrdersService } from '../services/orders.service.js';
import { MockGatewayService } from '../services/mock-gateway.service.js';
import { VnpayService } from '../services/vnpay.service.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly mockGatewayService: MockGatewayService,
    private readonly vnpayService: VnpayService
  ) {}

  /**
   * 1. Khách hàng bấm thanh toán -> Sinh phiên thanh toán (VietQR hoặc VNPay Sandbox URL)
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Khởi tạo phiên thanh toán (VietQR Napas hoặc VNPay Sandbox)' })
  async initiatePayment(@Body() body: InitiatePaymentDto, @Req() req: Request) {
    const order = await this.ordersService.getOrderStatus(body.orderId);

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Đơn hàng #${body.orderId} đang ở trạng thái "${order.status}", không thể khởi tạo thanh toán`
      );
    }

    // Nếu chọn cổng thanh toán VNPay Sandbox chính thức:
    if (body.method === PaymentMethodEnum.VNPAY) {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const vnpayUrl = this.vnpayService.createPaymentUrl({
        orderId: order.orderId,
        orderCode: order.orderCode,
        amount: order.total,
        ipAddr: clientIp,
      });

      return {
        orderId: order.orderId,
        orderCode: order.orderCode,
        total: order.total,
        method: PaymentMethodEnum.VNPAY,
        paymentUrl: vnpayUrl,
      };
    }

    // Mặc định: Sinh mã VietQR Napas 24/7 động
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
   * 2. Xử lý phản hồi từ Cổng VNPay Sandbox sau khi khách thanh toán
   */
  @Get('vnpay/return')
  @ApiOperation({ summary: 'Xác minh chữ ký số và kết quả giao dịch VNPay Sandbox Return' })
  async handleVnpayReturn(@Query() query: Record<string, string>) {
    this.logger.log(`[VNPay Callback] Nhận phản hồi thanh toán cho TxnRef: ${query.vnp_TxnRef}`);

    const verifyResult = this.vnpayService.verifyReturn(query);

    if (!verifyResult.isValid) {
      this.logger.error('[VNPay Callback] Chữ ký số HMAC-SHA512 không hợp lệ!');
      throw new BadRequestException('Chữ ký số phản hồi từ VNPay không hợp lệ!');
    }

    if (!verifyResult.isSuccess) {
      this.logger.warn(`[VNPay Callback] Giao dịch thất bại với mã lỗi: ${verifyResult.responseCode}`);
      return {
        success: false,
        orderId: verifyResult.orderId,
        responseCode: verifyResult.responseCode,
        message: verifyResult.message,
      };
    }

    // Chữ ký hợp lệ và giao dịch thành công (00) -> Chuyển trạng thái đơn sang PAID
    await this.ordersService.processPaymentWebhook({
      transactionRef: `VNPAY_${verifyResult.transactionNo || query.vnp_TxnRef}`,
      orderId: verifyResult.orderId,
      amount: verifyResult.amount,
      status: 'SUCCESS',
      message: `Thanh toán qua Cổng VNPay Sandbox (Mã GD: ${verifyResult.transactionNo})`,
    });

    const updatedOrder = await this.ordersService.getOrderStatus(verifyResult.orderId);

    return {
      success: true,
      orderId: verifyResult.orderId,
      orderCode: updatedOrder.orderCode,
      amount: verifyResult.amount,
      message: 'Thanh toán qua VNPay Sandbox thành công!',
    };
  }

  /**
   * 3. Máy chủ Ngân hàng bắn Webhook (Server-to-Server IPN) kèm chữ ký số HMAC-SHA256
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
   * 4. Giả lập Ngân hàng chuyển khoản thành công (Dành riêng cho Demo / Trình bày trên lớp)
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
   * 5. Kiểm tra trạng thái đơn hàng (Dành cho Frontend Polling)
   */
  @Get('status/:orderId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái đơn hàng (Polling realtime)' })
  async checkStatus(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.ordersService.getOrderStatus(orderId);
  }
}
