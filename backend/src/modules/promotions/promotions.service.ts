import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { calculateDiscount } from './promotion-calc.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Xem trước số tiền giảm của một mã (không tạo đơn, không trừ kho). */
  async validate(code: string, subtotal: number) {
    const normalizedCode = code.trim().toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    const discount = calculateDiscount(promotion, subtotal);

    return {
      code: promotion!.code,
      description: promotion!.description,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
    };
  }
}
