import { BadRequestException } from '@nestjs/common';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Ma trận chuyển đổi trạng thái đơn hàng (PDF Section 9.1)
 *
 * PENDING        -> PAID | PAYMENT_FAILED | CANCELLED
 * PAYMENT_FAILED -> PAID (thử lại) | CANCELLED
 * PAID           -> PREPARING | CANCELLED (hủy/hoàn tiền)
 * PREPARING      -> READY | CANCELLED
 * READY          -> COMPLETED
 * COMPLETED      -> (Terminal State - không thể chuyển tiếp)
 * CANCELLED      -> (Terminal State - không thể chuyển tiếp)
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PREPARING]: [
    OrderStatus.READY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY]: [
    OrderStatus.COMPLETED,
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái đơn hàng.
 * Ném ngoại lệ BadRequestException nếu chuyển đổi trái quy tắc.
 */
export function assertTransition(
  currentStatus: OrderStatus | string,
  newStatus: OrderStatus | string
): void {
  const current = currentStatus as OrderStatus;
  const target = newStatus as OrderStatus;

  if (current === target) {
    return; // Không đổi trạng thái -> hợp lệ
  }

  const allowedTargets = ALLOWED_TRANSITIONS[current];
  if (!allowedTargets) {
    throw new BadRequestException(
      `Trạng thái hiện tại không hợp lệ: "${currentStatus}"`
    );
  }

  if (!allowedTargets.includes(target)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái từ "${currentStatus}" sang "${newStatus}". Các trạng thái hợp lệ tiếp theo: [${allowedTargets.join(', ')}]`
    );
  }
}
