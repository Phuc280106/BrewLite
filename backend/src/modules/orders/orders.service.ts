import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  SIZE_EXTRA_PRICE,
  TOPPING_PRICE,
} from '../options/options.constants.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { assertTransition, OrderStatus } from './order-state-machine.js';

/** Số lần thử lại tối đa khi có xung đột phiên bản (optimistic locking). */
export const MAX_ORDER_ATTEMPTS = 5;

/** Thời gian chờ cơ sở giữa các lần thử (ms), tăng dần + jitter. */
const RETRY_BASE_DELAY_MS = 20;

/**
 * Được ném bên trong transaction khi một sản phẩm đã bị giao dịch khác sửa
 * (version/stock thay đổi) giữa lúc đọc và lúc ghi. Ném lỗi sẽ rollback toàn
 * bộ transaction, sau đó `create()` đọc lại dữ liệu mới và thử lại.
 */
export class StockVersionConflictError extends Error {
  constructor(readonly productId: number) {
    super(`Stock version conflict for product ${productId}`);
    this.name = 'StockVersionConflictError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** P2034: Prisma báo write conflict / deadlock -> cũng an toàn để thử lại. */
function isRetryable(error: unknown): boolean {
  if (error instanceof StockVersionConflictError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2034'
  );
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo đơn hàng PENDING và giữ chỗ (trừ) tồn kho một cách nguyên tử.
   *
   * Khi nhiều khách đặt cùng lúc: mỗi lần thử là một transaction độc lập; nếu
   * có người khác vừa mua mất hàng (version đổi) thì rollback, đọc lại tồn kho
   * mới nhất và thử lại. Nếu lúc đó hết hàng thật -> 400, nếu tranh chấp quá
   * nhiều -> 409.
   */
  async create(input: CreateOrderDto, userId?: number) {
    for (let attempt = 1; attempt <= MAX_ORDER_ATTEMPTS; attempt++) {
      try {
        return await this.createOnce(input, userId);
      } catch (error) {
        if (!isRetryable(error)) throw error;
 
        if (attempt < MAX_ORDER_ATTEMPTS) {
          this.logger.debug(
            `Order attempt ${attempt}/${MAX_ORDER_ATTEMPTS} hit a write conflict, retrying`
          );
          await sleep(RETRY_BASE_DELAY_MS * attempt * (1 + Math.random()));
        } else {
          this.logger.warn(
            `Order gave up after ${MAX_ORDER_ATTEMPTS} attempts due to write conflicts`
          );
        }
      }
    }
 
    throw new ConflictException(
      'Too many concurrent orders for these products, please try again'
    );
  }
 
  private createOnce(input: CreateOrderDto, userId?: number) {
    return this.prisma.$transaction(async (transaction) => {
      const productIds = [...new Set(input.items.map((item) => item.productId))];
      const products = await transaction.product.findMany({
        where: { id: { in: productIds } },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));
 
      const requestedQuantityByProductId = new Map<number, number>();
      for (const item of input.items) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} was not found`);
        }
 
        requestedQuantityByProductId.set(
          item.productId,
          (requestedQuantityByProductId.get(item.productId) ?? 0) + item.quantity
        );
      }
 
      // Kiểm tra sớm để trả lỗi rõ ràng (hết hàng thật, không phải tranh chấp).
      for (const [productId, quantity] of requestedQuantityByProductId) {
        const product = productsById.get(productId)!;
        if (quantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for product ${productId}`
          );
        }
      }
 
      // Optimistic locking: chỉ trừ kho nếu version vẫn là giá trị vừa đọc.
      // `stock >= quantity` là lớp bảo vệ thứ hai, không bao giờ để kho âm.
      // Sắp xếp theo id để mọi transaction khoá hàng theo cùng thứ tự
      // (tránh deadlock khi 2 đơn có cùng nhiều sản phẩm).
      const sortedRequests = [...requestedQuantityByProductId].sort(
        ([a], [b]) => a - b
      );
      for (const [productId, quantity] of sortedRequests) {
        const product = productsById.get(productId)!;
        const { count } = await transaction.product.updateMany({
          where: {
            id: productId,
            version: product.version,
            stock: { gte: quantity },
          },
          data: {
            stock: { decrement: quantity },
            version: { increment: 1 },
          },
        });
 
        if (count === 0) {
          throw new StockVersionConflictError(productId);
        }
      }
 
      const orderItems = input.items.map((item) => {
        const product = productsById.get(item.productId)!;
        const toppingsPrice = item.toppings.reduce(
          (total, topping) => total + TOPPING_PRICE[topping],
          0
        );
        const price = product.price + SIZE_EXTRA_PRICE[item.size] + toppingsPrice;
 
        return {
          productId: item.productId,
          size: item.size,
          toppings: item.toppings.length > 0 ? JSON.stringify(item.toppings) : null,
          price,
          qty: item.quantity,
          lineTotal: price * item.quantity,
        };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

      let discount = 0;
      let appliedCouponCode: string | null = null;

      if (input.couponCode && input.couponCode.trim()) {
        const normalizedCode = input.couponCode.trim().toUpperCase();
        const promotion = await transaction.promotion.findUnique({
          where: { code: normalizedCode },
        });

        if (!promotion || !promotion.isActive) {
          throw new BadRequestException('Mã khuyến mãi không hợp lệ hoặc đã hết hạn');
        }

        if (subtotal < promotion.minOrder) {
          throw new BadRequestException(
            `Đơn hàng chưa đạt giá trị tối thiểu ${promotion.minOrder.toLocaleString('vi-VN')}đ để áp dụng mã khuyến mãi này`
          );
        }

        if (promotion.discountPercent != null) {
          discount = (subtotal * promotion.discountPercent) / 100;
        } else if (promotion.discountAmount != null) {
          discount = promotion.discountAmount;
        }

        discount = Math.min(discount, subtotal);
        appliedCouponCode = promotion.code;
      }

      const total = Math.max(0, subtotal - discount);

      const order = await transaction.order.create({
        data: {
          userId: userId ?? null,
          total,
          discount,
          couponCode: appliedCouponCode,
          status: 'PENDING',
          items: { create: orderItems },
        },
        select: {
          id: true,
          total: true,
          discount: true,
          couponCode: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        orderId: order.id,
        orderCode: `BL-${String(order.id).padStart(6, '0')}`,
        total: order.total,
        discount: order.discount,
        couponCode: order.couponCode,
        status: order.status,
        createdAt: order.createdAt,
      };
    });
  }
  async pay(orderId: number, idempotencyKey: string, dto: PayOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Kiểm tra idempotency: nếu key đã tồn tại → kiểm tra có đúng đơn hàng này không
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.orderId !== orderId) {
          throw new BadRequestException(
            `Idempotency-Key "${idempotencyKey}" đã được sử dụng cho đơn hàng #${existing.orderId}, không thể dùng cho đơn hàng #${orderId}`
          );
        }
        return { idempotent: true, payment: existing };
      }

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException(`Order ${orderId} not found`);
      assertTransition(order.status, OrderStatus.PAID);

      // 3. Tạo Payment (tự động lấy đúng tổng tiền order.total) và cập nhật Order → PAID
      const payment = await tx.payment.create({
        data: {
          orderId,
          idempotencyKey,
          amount: order.total,
          method: dto.method,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

      // Tự động tích lũy điểm thưởng: 10.000đ = 1 điểm
      const loyaltyPointsEarned = Math.floor(order.total / 10000);
      if (order.userId && loyaltyPointsEarned > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: {
              increment: loyaltyPointsEarned,
            },
          },
        });
      }

      return { idempotent: false, payment, loyaltyPointsEarned };
    });
  }

  /**
   * Cập nhật trạng thái đơn hàng theo Order State Machine (Task 10.1).
   * Dùng `assertTransition` để chặn mọi chuyển tiếp trạng thái không hợp lệ (ném lỗi 400).
   */
  async updateStatus(orderId: number, newStatus: OrderStatus | string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    assertTransition(order.status, newStatus);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updatedOrder,
      orderCode: `BL-${String(updatedOrder.id).padStart(6, '0')}`,
    };
  }

  /**
   * Lấy danh sách lịch sử đơn hàng kèm món của user đang đăng nhập (US-09).
   */
  async findMyOrders(userId: number) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
              },
            },
          },
        },
      },
    });

    return orders.map((order) => ({
      ...order,
      orderCode: `BL-${String(order.id).padStart(6, '0')}`,
    }));
  }
}
