import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  SIZE_EXTRA_PRICE,
  TOPPING_PRICE,
} from '../common/constants/options.constants.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { assertTransition, OrderStatus } from '../common/state-machine/order-state-machine.js';

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

      // Optimistic locking
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

  /**
   * Lấy danh sách các mã khuyến mãi đang hoạt động (Public).
   */
  async getPromotions() {
    return this.prisma.promotion.findMany({
      where: { isActive: true },
      orderBy: { minOrder: 'asc' },
    });
  }

  /**
   * Kiểm tra và tính toán giảm giá thử trước khi tạo đơn (Promotion preview/validation).
   */
  async validatePromotion(code: string, subtotal: number) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Vui lòng nhập mã khuyến mãi');
    }
    const normalizedCode = code.trim().toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({
      where: { code: normalizedCode },
    });

    if (!promotion || !promotion.isActive) {
      throw new BadRequestException('Mã khuyến mãi không tồn tại hoặc đã hết hạn');
    }

    if (subtotal < promotion.minOrder) {
      throw new BadRequestException(
        `Đơn hàng cần đạt tối thiểu ${promotion.minOrder.toLocaleString('vi-VN')} ₫ để áp dụng mã này`
      );
    }

    let discount = 0;
    if (promotion.discountPercent != null) {
      discount = (subtotal * promotion.discountPercent) / 100;
    } else if (promotion.discountAmount != null) {
      discount = promotion.discountAmount;
    }
    discount = Math.min(discount, subtotal);

    return {
      code: promotion.code,
      description: promotion.description,
      discount,
      discountPercent: promotion.discountPercent,
      discountAmount: promotion.discountAmount,
      finalTotal: Math.max(0, subtotal - discount),
    };
  }

  /**
   * Xử lý Webhook từ Ngân hàng / Cổng thanh toán
   * (DUY NHẤT nơi này có thẩm quyền chuyển trạng thái đơn hàng sang PAID)
   */
  async processPaymentWebhook(dto: {
    transactionRef: string;
    orderId: number;
    amount: number;
    status: string;
    message?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Chống lặp (Idempotency theo mã giao dịch ngân hàng)
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey: dto.transactionRef },
      });
      if (existingPayment) {
        this.logger.log(`[Webhook Idempotent] Giao dịch ${dto.transactionRef} đã được xử lý.`);
        return {
          idempotent: true,
          success: true,
          orderId: existingPayment.orderId,
          status: OrderStatus.PAID,
        };
      }

      // 2. Kiểm tra đơn hàng có tồn tại không
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${dto.orderId}`);
      }

      // 3. Nếu đơn đã PAID rồi thì bỏ qua không xử lý lại (Idempotency order-level)
      if (order.status === OrderStatus.PAID) {
        this.logger.log(`[Webhook] Đơn hàng #${dto.orderId} đã ở trạng thái PAID.`);
        return {
          idempotent: true,
          success: true,
          orderId: order.id,
          status: OrderStatus.PAID,
        };
      }

      // 4. Kiểm tra Finite State Machine
      assertTransition(
        order.status as OrderStatus,
        dto.status === 'SUCCESS' ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED
      );

      // 5. Đối soát số tiền: Khách thực chuyển có khớp với giá trị đơn hàng không?
      if (Math.abs(dto.amount - order.total) > 1) {
        this.logger.error(
          `[Webhook] Sai lệch tiền! Đơn hàng: ${order.total}đ, Ngân hàng báo: ${dto.amount}đ`
        );
        throw new BadRequestException('Số tiền thanh toán từ ngân hàng không khớp với giá trị đơn');
      }

      // 6. Xử lý khi ngân hàng báo giao dịch THẤT BẠI
      if (dto.status !== 'SUCCESS') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAYMENT_FAILED },
        });
        return {
          idempotent: false,
          success: false,
          status: OrderStatus.PAYMENT_FAILED,
          message: 'Giao dịch ngân hàng không thành công',
        };
      }

      // 7. Giao dịch THÀNH CÔNG: Lưu Payment transaction và Cập nhật Order -> PAID
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          idempotencyKey: dto.transactionRef,
          amount: dto.amount,
          method: 'WALLET',
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });

      // 8. Tích lũy điểm thưởng loyalty (10.000đ = 1 điểm)
      const loyaltyPointsEarned = Math.floor(order.total / 10000);
      if (order.userId && loyaltyPointsEarned > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            loyaltyPoints: { increment: loyaltyPointsEarned },
          },
        });
      }

      this.logger.log(`[Webhook] Đơn hàng #${order.id} đã chuyển trạng thái PENDING -> PAID thành công!`);

      return {
        idempotent: false,
        success: true,
        orderId: order.id,
        status: OrderStatus.PAID,
        paymentId: payment.id,
        loyaltyPointsEarned,
      };
    });
  }

  /**
   * Lấy trạng thái hiện tại của đơn hàng (phục vụ client Polling)
   */
  async getOrderStatus(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        total: true,
        discount: true,
        couponCode: true,
        updatedAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }

    return {
      orderId: order.id,
      orderCode: `BL-${String(order.id).padStart(6, '0')}`,
      status: order.status,
      total: order.total,
      discount: order.discount,
      couponCode: order.couponCode,
      updatedAt: order.updatedAt,
    };
  }
}
