import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsController } from './payments.controller.js';
import { OrdersService } from '../services/orders.service.js';
import { MockGatewayService } from '../services/mock-gateway.service.js';

describe('PaymentsController (Fintech Webhook Architecture)', () => {
  let controller: PaymentsController;
  let ordersService: Partial<OrdersService>;
  let mockGatewayService: MockGatewayService;

  beforeEach(() => {
    mockGatewayService = new MockGatewayService();
    ordersService = {
      getOrderStatus: vi.fn().mockResolvedValue({
        orderId: 10,
        orderCode: 'BL-000010',
        total: 65000,
        status: 'PENDING',
      }),
      processPaymentWebhook: vi.fn().mockResolvedValue({
        idempotent: false,
        success: true,
        orderId: 10,
        status: 'PAID',
      }),
    };

    const vnpayService = {
      createPaymentUrl: vi.fn().mockReturnValue('https://sandbox.vnpayment.vn/test'),
      verifyReturn: vi.fn().mockReturnValue({
        isValid: true,
        isSuccess: false,
        orderId: 10,
        responseCode: '24',
        message: 'Khách hàng hủy giao dịch',
      }),
    };

    (ordersService as any).cancelOrder = vi.fn().mockResolvedValue({
      id: 10,
      orderCode: 'BL-000010',
      status: 'CANCELLED',
    });

    controller = new PaymentsController(
      ordersService as OrdersService,
      mockGatewayService,
      vnpayService as any
    );
  });

  it('khởi tạo phiên thanh toán (initiatePayment) trả về mã VietQR Napas 24/7 hợp lệ', async () => {
    const result = await controller.initiatePayment({
      orderId: 10,
      method: 'VIETQR' as any,
    });

    expect(result.orderId).toBe(10);
    expect(result.total).toBe(65000);
    expect(result.paymentIntent.qrCodeUrl).toContain('img.vietqr.io');
    expect(result.paymentIntent.transactionRef).toBeDefined();
    expect(ordersService.getOrderStatus).toHaveBeenCalledWith(10);
  });

  it('từ chối initiatePayment nếu đơn hàng không ở trạng thái PENDING', async () => {
    vi.mocked(ordersService.getOrderStatus!).mockResolvedValueOnce({
      orderId: 10,
      orderCode: 'BL-000010',
      total: 65000,
      status: 'PAID',
    } as any);

    await expect(
      controller.initiatePayment({
        orderId: 10,
        method: 'VIETQR' as any,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('xác thực thành công và xử lý đơn khi Webhook có chữ ký HMAC hợp lệ', async () => {
    const payload = {
      transactionRef: 'TXN_TEST_123',
      orderId: 10,
      amount: 65000,
      status: 'SUCCESS',
      message: 'Napas transfer',
    };

    const validSignature = mockGatewayService.generateSignature(payload);

    const result = await controller.handleWebhook(validSignature, payload);

    expect(ordersService.processPaymentWebhook).toHaveBeenCalledWith(payload);
    expect(result).toMatchObject({ success: true, status: 'PAID' });
  });

  it('từ chối ngay lập tức (403 Forbidden) nếu chữ ký số HMAC bị giả mạo', async () => {
    const payload = {
      transactionRef: 'TXN_TEST_123',
      orderId: 10,
      amount: 65000,
      status: 'SUCCESS',
      message: 'Fake payment',
    };

    const forgedSignature = 'fake_signature_abc123';

    await expect(
      controller.handleWebhook(forgedSignature, payload)
    ).rejects.toThrow(ForbiddenException);
    expect(ordersService.processPaymentWebhook).not.toHaveBeenCalled();
  });

  it('mô phỏng ngân hàng chuyển tiền (mockBankConfirm) tự tạo chữ ký hợp lệ và gọi webhook', async () => {
    const result = await controller.mockBankConfirm(10);

    expect(ordersService.getOrderStatus).toHaveBeenCalledWith(10);
    expect(ordersService.processPaymentWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 10,
        amount: 65000,
        status: 'SUCCESS',
      })
    );
    expect(result).toMatchObject({ success: true, status: 'PAID' });
  });

  it('kiểm tra trạng thái đơn hàng (checkStatus) phục vụ Polling realtime', async () => {
    const result = await controller.checkStatus(10);
    expect(ordersService.getOrderStatus).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({ orderId: 10, status: 'PENDING' });
  });
  it('VNPay return hủy giao dịch (code 24) -> tự động gọi cancelOrder và hoàn kho', async () => {
    const result = await controller.handleVnpayReturn({
      vnp_ResponseCode: '24',
      vnp_TxnRef: '10_123456789',
    });

    expect(ordersService.getOrderStatus).toHaveBeenCalledWith(10);
    expect((ordersService as any).cancelOrder).toHaveBeenCalledWith(
      10,
      expect.stringContaining('hủy')
    );
    expect(result).toMatchObject({
      success: false,
      orderId: 10,
      responseCode: '24',
    });
  });
});