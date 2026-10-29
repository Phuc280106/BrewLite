'use client';

import { create } from 'zustand';

/**
 * Đơn hàng đã tạo (PENDING) nhưng chưa thanh toán xong. Giữ lại ở đây để khi
 * thanh toán lỗi hoặc khách đóng modal rồi mở lại thì dùng lại đúng đơn +
 * Idempotency-Key, không tạo thêm đơn mới (tránh giữ chỗ kho nhiều lần).
 */
export interface PendingOrder {
  orderId: number;
  orderCode: string;
  total: number;
  discount: number;
  couponCode: string | null;
  idempotencyKey: string;
  /** Dấu vết của giỏ hàng + mã giảm giá lúc tạo đơn. */
  signature: string;
}

interface PaymentState {
  pendingOrder: PendingOrder | null;
  setPendingOrder: (order: PendingOrder) => void;
  clearPendingOrder: () => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  pendingOrder: null,
  setPendingOrder: (order) => set({ pendingOrder: order }),
  clearPendingOrder: () => set({ pendingOrder: null }),
}));