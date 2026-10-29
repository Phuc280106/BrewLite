import axios from 'axios';
import { PaymentMethodId } from '../types';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Giá trị gửi lên backend (`POST /payments` chỉ nhận WALLET | CARD). */
  apiMethod: 'WALLET' | 'CARD';
  badge: string;
  badgeClass: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'MOMO',
    label: 'Ví MoMo',
    description: 'Thanh toán bằng ví điện tử MoMo',
    apiMethod: 'WALLET',
    badge: 'Mo',
    badgeClass: 'bg-pink-100 text-pink-700',
  },
  {
    id: 'VNPAY',
    label: 'VNPay',
    description: 'Thanh toán qua cổng VNPay',
    apiMethod: 'WALLET',
    badge: 'VN',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'CARD',
    label: 'Thẻ ngân hàng',
    description: 'Thẻ ATM nội địa / Visa / Mastercard',
    apiMethod: 'CARD',
    badge: '▭',
    badgeClass: 'bg-stone-200 text-stone-700',
  },
];

/** Idempotency-Key duy nhất cho mỗi lần thanh toán một đơn hàng. */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID chỉ có ở secure context (HTTPS/localhost); khi test
  // bằng điện thoại qua IP LAN (http) thì dùng bản dự phòng này.
  return `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Lấy thông báo lỗi dễ đọc từ lỗi axios của NestJS. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message) return message;
    if (!error.response) return 'Không thể kết nối đến máy chủ.';
  }
  return fallback;
}

export const formatMoney = (value: number) =>
  `${value.toLocaleString('vi-VN')} ₫`;
