import { BadRequestException } from '@nestjs/common';

export interface PromotionLike {
  code: string;
  isActive: boolean;
  minOrder: number;
  discountPercent: number | null;
  discountAmount: number | null;
}

/**
 * Kiểm tra mã khuyến mãi và tính số tiền được giảm (dùng chung cho
 * `POST /orders` và `GET /promotions/validate` để hai nơi luôn cho cùng kết quả).
 */
export function calculateDiscount(
  promotion: PromotionLike | null,
  subtotal: number
): number {
  if (!promotion || !promotion.isActive) {
    throw new BadRequestException('Mã khuyến mãi không hợp lệ hoặc đã hết hạn');
  }

  if (subtotal < promotion.minOrder) {
    throw new BadRequestException(
      `Đơn hàng chưa đạt giá trị tối thiểu ${promotion.minOrder.toLocaleString('vi-VN')}đ để áp dụng mã khuyến mãi này`
    );
  }

  let discount = 0;
  if (promotion.discountPercent != null) {
    discount = (subtotal * promotion.discountPercent) / 100;
  } else if (promotion.discountAmount != null) {
    discount = promotion.discountAmount;
  }

  return Math.min(discount, subtotal);
}
