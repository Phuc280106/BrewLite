import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface VnpayPaymentUrlParams {
  orderId: number;
  orderCode: string;
  amount: number;
  ipAddr?: string;
  bankCode?: string;
}

export interface VnpayReturnResult {
  isValid: boolean;
  isSuccess: boolean;
  orderId: number;
  amount: number;
  transactionNo: string;
  responseCode: string;
  message: string;
}

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);

  private readonly tmnCode = process.env.VNP_TMN_CODE || 'OCRC6EBD';
  private readonly hashSecret = process.env.VNP_HASH_SECRET || 'QLKXCLVFTWDSPLVWZHJQWSMTEXNNYTDT';
  private readonly vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  private readonly returnUrl = process.env.VNP_RETURN_URL || 'http://localhost:3000/payment/vnpay-return';

  /**
   * Tạo URL thanh toán chuyển hướng sang Cổng VNPay Sandbox
   */
  createPaymentUrl(params: VnpayPaymentUrlParams): string {
    const date = new Date();
    const pad = (n: number) => ('0' + n).slice(-2);
    const createDate =
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds());

    // Mã giao dịch duy nhất cho phiên thanh toán
    const txnRef = `${params.orderId}_${Date.now()}`;

    // VNPay yêu cầu số tiền nhân với 100 (đơn vị: xu)
    const vnpAmount = Math.round(params.amount * 100);

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${params.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: params.ipAddr || '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    if (params.bankCode && params.bankCode.trim() !== '') {
      vnpParams.vnp_BankCode = params.bankCode;
    }

    // Sắp xếp các tham số theo thứ tự alphabet
    const sortedKeys = Object.keys(vnpParams).sort();
    const signData = sortedKeys
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(vnpParams[key])).replace(/%20/g, '+')}`
      )
      .join('&');

    // Ký chữ ký số HMAC-SHA512
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

    this.logger.log(
      `[VNPay Sandbox] Sinh URL thanh toán cho đơn #${params.orderId} (${params.orderCode}): TxnRef=${txnRef}`
    );

    return paymentUrl;
  }

  /**
   * Xác minh chữ ký số và kết quả giao dịch khi VNPay redirect về ReturnUrl
   */
  verifyReturn(queryParams: Record<string, string>): VnpayReturnResult {
    const secureHash = queryParams.vnp_SecureHash;
    const vnpParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(queryParams)) {
      if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        vnpParams[key] = value;
      }
    }

    // Sắp xếp lại theo thứ tự alphabet
    const sortedKeys = Object.keys(vnpParams).sort();
    const signData = sortedKeys
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(vnpParams[key])).replace(/%20/g, '+')}`
      )
      .join('&');

    // Tính toán lại chữ ký HMAC-SHA512
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const expectedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash?.toLowerCase() === expectedHash.toLowerCase();
    const responseCode = queryParams.vnp_ResponseCode || '';
    const isSuccess = isValid && responseCode === '00';

    // Bóc tách orderId từ vnp_TxnRef (dạng "orderId_timestamp")
    const rawTxnRef = queryParams.vnp_TxnRef || '';
    const orderId = Number(rawTxnRef.split('_')[0]) || 0;
    const amount = Number(queryParams.vnp_Amount || 0) / 100;
    const transactionNo = queryParams.vnp_TransactionNo || '';

    this.logger.log(
      `[VNPay Return] Kết quả đơn #${orderId}: ResponseCode=${responseCode}, ValidSignature=${isValid}, Success=${isSuccess}`
    );

    return {
      isValid,
      isSuccess,
      orderId,
      amount,
      transactionNo,
      responseCode,
      message: isSuccess
        ? 'Giao dịch VNPay thành công'
        : `Giao dịch thất bại (Mã lỗi: ${responseCode})`,
    };
  }
}
