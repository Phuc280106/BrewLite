import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PaymentIntentResult {
  orderId: number;
  orderCode: string;
  amount: number;
  transactionRef: string;
  qrCodeUrl: string;
  bankInfo: {
    bankName: string;
    accountNo: string;
    accountName: string;
  };
  expiresAt: string;
}

@Injectable()
export class MockGatewayService {
  private readonly logger = new Logger(MockGatewayService.name);

  // Khóa bí mật dùng chung giữa Cổng thanh toán và Hệ thống BrewLite
  private readonly secretKey = process.env.PAYMENT_SECRET_KEY || 'brewlite_secret_gateway_key_2026';

  // Thông tin tài khoản ngân hàng nhận tiền của quán cà phê
  private readonly merchantBank = {
  bankId: 'STB',                     
  bankName: 'Sacombank',
  accountNo: '060304048134',           
  accountName: 'LE PHAM HOANG PHUC',     
};

  /**
   * 1. Sinh phiên thanh toán và tạo mã VietQR Napas 24/7 động
   */
  createPaymentIntent(orderId: number, orderCode: string, amount: number): PaymentIntentResult {
    const transactionRef = `TXN_${Date.now()}_BL${orderId}`;
    const transferContent = orderCode.replace('-', ''); // Ví dụ: BL000001
    
    // Chuẩn URL VietQR động theo chuẩn Napas 24/7 của Ngân hàng Nhà nước
    const qrCodeUrl = `https://img.vietqr.io/image/${this.merchantBank.bankId}-${this.merchantBank.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      transferContent
    )}&accountName=${encodeURIComponent(this.merchantBank.accountName)}`;

    // Đơn thanh toán có thời hạn 15 phút
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    this.logger.log(
      `[Gateway] Tạo phiên thanh toán cho đơn ${orderCode} - Số tiền: ${amount.toLocaleString('vi-VN')}đ - Mã GD: ${transactionRef}`
    );

    return {
      orderId,
      orderCode,
      amount,
      transactionRef,
      qrCodeUrl,
      bankInfo: {
        bankName: this.merchantBank.bankName,
        accountNo: this.merchantBank.accountNo,
        accountName: this.merchantBank.accountName,
      },
      expiresAt,
    };
  }

  /**
   * 2. Ký chữ ký số HMAC-SHA256 trên dữ liệu Webhook
   */
  generateSignature(payload: {
    transactionRef: string;
    orderId: number;
    amount: number;
    status: string;
  }): string {
    const rawData = `${payload.transactionRef}|${payload.orderId}|${payload.amount}|${payload.status}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawData)
      .digest('hex');
  }

  /**
   * 3. Xác minh tính toàn vẹn của chữ ký số Webhook gửi về
   */
  verifySignature(
    payload: {
      transactionRef: string;
      orderId: number;
      amount: number;
      status: string;
    },
    incomingSignature: string
  ): boolean {
    if (!incomingSignature) return false;
    const expectedSignature = this.generateSignature(payload);
    
    // Dùng timingSafeEqual để chống tấn công Timing Attack
    try {
      const bufferA = Buffer.from(expectedSignature, 'hex');
      const bufferB = Buffer.from(incomingSignature, 'hex');
      return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
    } catch {
      return false;
    }
  }
}