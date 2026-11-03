import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import {
  SIZE_EXTRA_PRICE,
  TOPPING_PRICE,
} from '../common/constants/options.constants.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { PayOrderDto } from '../dto/orders/pay-order.dto.js';
import { assertTransition, OrderStatus } from '../common/state-machine/order-state-machine.js';

/** Số lần thử lại tối đa khi có xung đột phiên bản (optimistic locking). */
export const MAX_ORDER_ATTEMPTS = 5;

/** Thời gian chờ cơ sở giữa các lần thử (ms), tăng dần + jitter. */
const RETRY_BASE_DELAY_MS = 20;

/** Giá trị quy đổi điểm thưởng: 1 điểm = 1.000 VNĐ */
export const LOYALTY_POINT_VALUE = 1000;

/** Tỉ lệ tích lũy điểm thưởng: mỗi 10.000 VNĐ = 1 điểm */
export const LOYALTY_EARN_RATE = 10000;

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

/**
 * Được ném khi tồn kho nguyên liệu (Ingredient) bị giao dịch khác cập nhật
 * (version/stock thay đổi) giữa lúc đọc và lúc ghi (Optimistic Locking).
 */
export class IngredientStockVersionConflictError extends Error {
  constructor(readonly ingredientId: number) {
    super(`Stock version conflict for ingredient ${ingredientId}`);
    this.name = 'IngredientStockVersionConflictError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** P2034: Prisma báo write conflict / deadlock -> cũng an toàn để thử lại. */
function isRetryable(error: unknown): boolean {
  if (error instanceof StockVersionConflictError) return true;
  if (error instanceof IngredientStockVersionConflictError) return true;
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

  /**
   * Tính số ly tối đa dựa theo tồn kho nguyên liệu hiện tại.
   * - Nếu truyền `size`: tính riêng cho size đó.
   * - Nếu không truyền `size`: tính số ly tối đa có thể pha chế (lấy max giữa các size).
   * - Nếu sản phẩm không có công thức: trả về tồn kho sản phẩm (product.stock).
   */
  async calculateProductAvailability(
    productId: number,
    size?: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const product = await client.product.findUnique({
      where: { id: productId },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }

    if (!product.recipeItems || product.recipeItems.length === 0) {
      return 0;
    }

    if (size) {
      const itemsForSize = product.recipeItems.filter(
        (item) => item.size.toUpperCase() === size.toUpperCase()
      );
      if (itemsForSize.length === 0) {
        return 0;
      }

      let maxCups = Infinity;
      for (const item of itemsForSize) {
        if (item.amount <= 0) continue;
        const available = Math.floor(
          (item.ingredient?.stock ?? 0) / item.amount
        );
        if (available < maxCups) {
          maxCups = available;
        }
      }
      return maxCups === Infinity ? 0 : maxCups;
    }

    const sizes = [...new Set(product.recipeItems.map((item) => item.size))];
    if (sizes.length === 0) {
      return 0;
    }

    let overallMax = 0;
    for (const s of sizes) {
      const itemsForSize = product.recipeItems.filter((item) => item.size === s);
      let cupsForSize = Infinity;
      for (const item of itemsForSize) {
        if (item.amount <= 0) continue;
        const available = Math.floor(
          (item.ingredient?.stock ?? 0) / item.amount
        );
        if (available < cupsForSize) {
          cupsForSize = available;
        }
      }
      if (cupsForSize !== Infinity && cupsForSize > overallMax) {
        overallMax = cupsForSize;
      }
    }

    return overallMax;
  }

  /**
   * Trả về chi tiết số ly tối đa của từng size cho sản phẩm.
   */
  async calculateProductAvailabilityDetails(
    productId: number,
    tx?: Prisma.TransactionClient
  ): Promise<{ maxCups: number; bySize: Record<string, number> }> {
    const client = tx ?? this.prisma;
    const product = await client.product.findUnique({
      where: { id: productId },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found`);
    }

    if (!product.recipeItems || product.recipeItems.length === 0) {
      return {
        maxCups: 0,
        bySize: { S: 0, M: 0, L: 0 },
      };
    }

    const sizes = [...new Set(product.recipeItems.map((item) => item.size))];
    const bySize: Record<string, number> = {};
    for (const s of sizes) {
      const itemsForSize = product.recipeItems.filter((item) => item.size === s);
      let cupsForSize = Infinity;
      for (const item of itemsForSize) {
        if (item.amount <= 0) continue;
        const available = Math.floor(
          (item.ingredient?.stock ?? 0) / item.amount
        );
        if (available < cupsForSize) {
          cupsForSize = available;
        }
      }
      bySize[s] = cupsForSize === Infinity ? 0 : cupsForSize;
    }

    const maxCups =
      Object.keys(bySize).length > 0 ? Math.max(...Object.values(bySize)) : 0;
    return { maxCups, bySize };
  }

  private resolveTopping(
    key: string,
    toppings: Array<{ id: number; name: string; price: number; stock: number }>
  ) {
  if (!toppings || toppings.length === 0) return null;

  const numId = Number(key);
  if (!Number.isNaN(numId) && Number.isInteger(numId)) {
    const byId = toppings.find((t) => t.id === numId);
    if (byId) return byId;
  }

  const slugKeywords: Record<string, string> = {
    pearl: 'trân châu',
    cheese: 'macchiato',
    peach_jelly: 'thạch đào',
  };
  const keyword = slugKeywords[key.toLowerCase()];
  if (keyword) {
    const bySlug = toppings.find((t) =>
      t.name.toLowerCase().includes(keyword)
    );
    if (bySlug) return bySlug;
  }

  const byName = toppings.find(
    (t) => t.name.toLowerCase() === key.toLowerCase()
  );
  if (byName) return byName;

  return null;
}

  private createOnce(input: CreateOrderDto, userId?: number) {
    return this.prisma.$transaction(async (transaction) => {
      const productIds = [...new Set(input.items.map((item) => item.productId))];
      const products = await transaction.product.findMany({
        where: { id: { in: productIds } },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const item of input.items) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} was not found`);
        }
      }

      // 1. Đọc công thức của các món trong giỏ hàng
      const recipeItems = (transaction as any).recipeItem?.findMany
        ? await (transaction as any).recipeItem.findMany({
            where: { productId: { in: productIds } },
          })
        : [];

      const recipesByKey = new Map<string, Array<{ ingredientId: number; amount: number }>>();
      const productsWithRecipes = new Set<number>();
      for (const r of recipeItems) {
        productsWithRecipes.add(r.productId);
        const key = `${r.productId}_${r.size.toUpperCase()}`;
        if (!recipesByKey.has(key)) {
          recipesByKey.set(key, []);
        }
        recipesByKey.get(key)!.push({
          ingredientId: r.ingredientId,
          amount: r.amount,
        });
      }

      // 2. Tính tổng nguyên vật liệu tiêu hao
      const totalIngredientRequirement = new Map<number, number>();

      for (const item of input.items) {
        const product = productsById.get(item.productId)!;
        const key = `${item.productId}_${item.size.toUpperCase()}`;
        const recipes = recipesByKey.get(key);

        if (recipes && recipes.length > 0) {
          for (const recipe of recipes) {
            const totalNeeded = recipe.amount * item.quantity;
            totalIngredientRequirement.set(
              recipe.ingredientId,
              (totalIngredientRequirement.get(recipe.ingredientId) ?? 0) + totalNeeded
            );
          }
        } else if (productsWithRecipes.has(item.productId)) {
          throw new BadRequestException(
            `Không tìm thấy công thức pha chế cho món ${product.name} (Size ${item.size})`
          );
        }
      }

      // 3. Trừ tồn kho nguyên vật liệu với Optimistic Locking trên bảng Ingredient
      if (totalIngredientRequirement.size > 0) {
        const ingredientIds = [...totalIngredientRequirement.keys()];
        const ingredients = await (transaction as any).ingredient.findMany({
          where: { id: { in: ingredientIds } },
        });
        const ingredientsById = new Map<number, any>(
          ingredients.map((ing: any) => [ing.id, ing])
        );

        // Kiểm tra sớm để trả lỗi 400 rõ ràng khi không đủ nguyên liệu
        for (const [ingredientId, needed] of totalIngredientRequirement) {
          const ingredient = ingredientsById.get(ingredientId);
          if (!ingredient || ingredient.stock < needed) {
            const ingName = ingredient?.name || `nguyên liệu #${ingredientId}`;
            const currentStock = ingredient?.stock ?? 0;
            const unit = ingredient?.unit ? ` ${ingredient.unit}` : '';
            throw new BadRequestException(
              `Không đủ nguyên liệu "${ingName}" để pha chế (Cần: ${needed}${unit}, Còn lại: ${currentStock}${unit})`
            );
          }
        }

        // Optimistic locking trên bảng Ingredient
        const sortedIngredientRequests = [...totalIngredientRequirement.entries()].sort(
          ([a], [b]) => a - b
        );

        for (const [ingredientId, needed] of sortedIngredientRequests) {
          const ingredient = ingredientsById.get(ingredientId)!;
          const { count } = await (transaction as any).ingredient.updateMany({
            where: {
              id: ingredientId,
              version: ingredient.version,
              stock: { gte: needed },
            },
            data: {
              stock: { decrement: needed },
              version: { increment: 1 },
            },
          });

          if (count === 0) {
            throw new IngredientStockVersionConflictError(ingredientId);
          }
        }
      }

      // 4. Kiểm tra và trừ tồn kho Topping
      const dbToppings: Array<{ id: number; name: string; price: number; stock: number }> =
        (transaction as any).topping?.findMany
          ? await (transaction as any).topping.findMany()
          : [];

      const totalToppingRequirement = new Map<number, { topping: any; needed: number }>();

      for (const item of input.items) {
        if (!item.toppings || item.toppings.length === 0) continue;
        for (const toppingKey of item.toppings) {
          const matched = this.resolveTopping(toppingKey, dbToppings);
          if (matched) {
            const current = totalToppingRequirement.get(matched.id) ?? {
              topping: matched,
              needed: 0,
            };
            current.needed += item.quantity;
            totalToppingRequirement.set(matched.id, current);
          } else if (dbToppings.length > 0) {
            throw new BadRequestException(
              `Topping không tồn tại hoặc không hợp lệ: ${toppingKey}`
            );
          }
        }
      }

      // Kiểm tra sớm tồn kho Topping
      for (const [, { topping, needed }] of totalToppingRequirement) {
        if (topping.stock < needed) {
          throw new BadRequestException(
            `Topping "${topping.name}" không đủ số lượng phục vụ (Cần: ${needed}, Còn lại: ${topping.stock})`
          );
        }
      }

      // Trừ tồn kho Topping trong transaction
      if (totalToppingRequirement.size > 0 && (transaction as any).topping?.updateMany) {
        const sortedToppings = [...totalToppingRequirement.entries()].sort(([a], [b]) => a - b);
        for (const [toppingId, { topping, needed }] of sortedToppings) {
          const { count } = await (transaction as any).topping.updateMany({
            where: {
              id: toppingId,
              stock: { gte: needed },
            },
            data: {
              stock: { decrement: needed },
            },
          });

          if (count === 0) {
            throw new BadRequestException(
              `Topping "${topping.name}" đã hết hàng hoặc không đủ tồn kho để đặt đơn này`
            );
          }
        }
      }

      const orderItems = input.items.map((item) => {
        const product = productsById.get(item.productId)!;
        const toppingsPrice = item.toppings.reduce((total, toppingKey) => {
          const matched = this.resolveTopping(toppingKey, dbToppings);
          return total + (matched?.price ?? TOPPING_PRICE[toppingKey] ?? 0);
        }, 0);
        const price = product.price + SIZE_EXTRA_PRICE[item.size] + toppingsPrice;

        const resolvedToppingNames = item.toppings.map((t) => {
          const matched = this.resolveTopping(t, dbToppings);
          return matched ? matched.name : t;
        });

        return {
          productId: item.productId,
          size: item.size,
          toppings: item.toppings.length > 0 ? JSON.stringify(resolvedToppingNames) : null,
          price,
          qty: item.quantity,
          lineTotal: price * item.quantity,
        };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

      let discount = 0;
      let appliedCouponCode: string | null = null;

      // 1. Áp dụng mã khuyến mãi (nếu có)
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

        // RÀNG BUỘC: Mỗi tài khoản chỉ được phép dùng mỗi mã đúng 1 lần
        if (userId) {
          const alreadyUsed = await transaction.order.findFirst({
            where: {
              userId,
              couponCode: normalizedCode,
              status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED] },
            },
          });
          if (alreadyUsed) {
            throw new BadRequestException(
              `Tài khoản của bạn đã sử dụng mã khuyến mãi "${normalizedCode}" trước đó. Mỗi tài khoản chỉ được sử dụng 1 lần.`
            );
          }
        }

        if (promotion.discountPercent != null) {
          discount = (subtotal * promotion.discountPercent) / 100;
        } else if (promotion.discountAmount != null) {
          discount = promotion.discountAmount;
        }

        discount = Math.min(discount, subtotal);
        appliedCouponCode = promotion.code;
      }

      // 2. Áp dụng điểm thưởng thành viên (Loyalty points)
      let pointsUsed = 0;
      let pointDiscount = 0;

      if (input.pointsUsed && input.pointsUsed > 0) {
        if (!userId) {
          throw new BadRequestException('Chỉ thành viên đã đăng nhập mới có thể sử dụng điểm tích lũy');
        }

        const user = await transaction.user.findUnique({
          where: { id: userId },
          select: { id: true, loyaltyPoints: true },
        });

        if (!user) {
          throw new NotFoundException('Không tìm thấy tài khoản người dùng');
        }

        if (user.loyaltyPoints < input.pointsUsed) {
          throw new BadRequestException(
            `Số điểm tích lũy của bạn không đủ (${user.loyaltyPoints} điểm < ${input.pointsUsed} điểm)`
          );
        }

        const remainingAfterCoupon = Math.max(0, subtotal - discount);
        const requestedDiscount = Math.floor(input.pointsUsed) * LOYALTY_POINT_VALUE;

        if (requestedDiscount > remainingAfterCoupon) {
          pointDiscount = remainingAfterCoupon;
          pointsUsed = Math.ceil(pointDiscount / LOYALTY_POINT_VALUE);
        } else {
          pointDiscount = requestedDiscount;
          pointsUsed = Math.floor(input.pointsUsed);
        }
      }

      const totalDiscount = discount + pointDiscount;
      const total = Math.max(0, subtotal - totalDiscount);

      const order = await transaction.order.create({
        data: {
          userId: userId ?? null,
          total,
          discount,
          couponCode: appliedCouponCode,
          pointsUsed,
          pointDiscount,
          status: 'PENDING',
          items: { create: orderItems },
        },
        select: {
          id: true,
          total: true,
          discount: true,
          couponCode: true,
          pointsUsed: true,
          pointDiscount: true,
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
        pointsUsed: order.pointsUsed,
        pointDiscount: order.pointDiscount,
        status: order.status,
        createdAt: order.createdAt,
      };
    });
  }

  /**
   * Thanh toán trực tiếp theo Idempotency Key (Thẻ / Ví).
   */
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
      assertTransition(order.status as OrderStatus, OrderStatus.PAID);

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

      // 4. Trong transaction thanh toán thành công: trừ pointsUsed khỏi tài khoản của User, đồng thời cộng điểm mới tích lũy
      const loyaltyPointsEarned = Math.floor(order.total / LOYALTY_EARN_RATE);
      const pointsUsed = order.pointsUsed || 0;
      let updatedUserPoints: number | undefined;

      if (order.userId) {
        if (pointsUsed > 0) {
          const user = await tx.user.findUnique({ where: { id: order.userId } });
          if (user) {
            if (user.loyaltyPoints < pointsUsed) {
              throw new BadRequestException(
                `Số điểm tích lũy của bạn không đủ (${user.loyaltyPoints} điểm < ${pointsUsed} điểm)`
              );
            }
            updatedUserPoints = Math.max(0, user.loyaltyPoints - pointsUsed + loyaltyPointsEarned);
            await tx.user.update({
              where: { id: order.userId },
              data: { loyaltyPoints: updatedUserPoints },
            });
          }
        } else if (loyaltyPointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              loyaltyPoints: {
                increment: loyaltyPointsEarned,
              },
            },
          });
        }
      }

      return {
        idempotent: false,
        payment,
        loyaltyPointsEarned,
        pointsUsed: order.pointsUsed,
        remainingLoyaltyPoints: updatedUserPoints,
      };
    });
  }

  /**
   * Cập nhật trạng thái đơn hàng theo Order State Machine (Task 10.1).
   * Dùng `assertTransition` để chặn mọi chuyển tiếp trạng thái không hợp lệ (ném lỗi 400).
   */
  /**
   * Hoàn trả tồn kho nguyên liệu và topping khi đơn hàng bị HỦY.
   */
  async rollbackInventory(orderId: number, tx: Prisma.TransactionClient) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || !order.items || order.items.length === 0) return;

    const productIds = [...new Set(order.items.map((it) => it.productId))];

    // 1. Hoàn trả nguyên liệu theo công thức
    const recipeItems = (tx as any).recipeItem?.findMany
      ? await (tx as any).recipeItem.findMany({
          where: { productId: { in: productIds } },
        })
      : [];

    const recipesByKey = new Map<string, Array<{ ingredientId: number; amount: number }>>();
    for (const r of recipeItems) {
      const key = `${r.productId}_${r.size.toUpperCase()}`;
      if (!recipesByKey.has(key)) recipesByKey.set(key, []);
      recipesByKey.get(key)!.push({
        ingredientId: r.ingredientId,
        amount: r.amount,
      });
    }

    const ingredientReturnMap = new Map<number, number>();
    for (const item of order.items) {
      const key = `${item.productId}_${item.size.toUpperCase()}`;
      const recipes = recipesByKey.get(key) || [];
      for (const r of recipes) {
        const needed = r.amount * item.qty;
        ingredientReturnMap.set(
          r.ingredientId,
          (ingredientReturnMap.get(r.ingredientId) ?? 0) + needed
        );
      }
    }

    if (ingredientReturnMap.size > 0 && (tx as any).ingredient?.update) {
      for (const [ingredientId, amount] of ingredientReturnMap) {
        await (tx as any).ingredient.update({
          where: { id: ingredientId },
          data: {
            stock: { increment: Math.round(amount) },
            version: { increment: 1 },
          },
        });
      }
    }

    // 2. Hoàn trả Topping
    const dbToppings: Array<{ id: number; name: string; price: number; stock: number }> =
      (tx as any).topping?.findMany ? await (tx as any).topping.findMany() : [];

    const toppingReturnMap = new Map<number, number>();
    for (const item of order.items) {
      if (!item.toppings) continue;
      let toppingKeys: string[] = [];
      try {
        const parsed = JSON.parse(item.toppings);
        toppingKeys = Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch {
        toppingKeys = item.toppings.split(',').map((s) => s.trim());
      }

      for (const tKey of toppingKeys) {
        const matched = this.resolveTopping(tKey, dbToppings);
        if (matched) {
          toppingReturnMap.set(
            matched.id,
            (toppingReturnMap.get(matched.id) ?? 0) + item.qty
          );
        }
      }
    }

    if (toppingReturnMap.size > 0 && (tx as any).topping?.update) {
      for (const [toppingId, qty] of toppingReturnMap) {
        await (tx as any).topping.update({
          where: { id: toppingId },
          data: { stock: { increment: qty } },
        });
      }
    }
  }

  /**
   * Hủy đơn hàng và hoàn trả nguyên vật liệu về kho.
   */
  async cancelOrder(orderId: number, reason?: string, userId?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (userId && order.userId && order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này');
    }

    assertTransition(order.status as OrderStatus, OrderStatus.CANCELLED);

    const execute = async (tx: Prisma.TransactionClient) => {
      await this.rollbackInventory(orderId, tx);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
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

      this.logger.log(`[Order Cancelled] Đơn hàng #${orderId} đã được hủy. Lý do: ${reason || 'Không rõ'}`);

      return {
        ...updatedOrder,
        orderCode: `BL-${String(updatedOrder.id).padStart(6, '0')}`,
      };
    };

    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(execute);
    }
    return execute(this.prisma as unknown as Prisma.TransactionClient);
  }

  async updateStatus(orderId: number, newStatus: OrderStatus | string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    assertTransition(order.status as OrderStatus, newStatus as OrderStatus);

    if (newStatus === OrderStatus.CANCELLED) {
      return this.cancelOrder(orderId, 'Cập nhật sang CANCELLED qua updateStatus');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus as any },
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

  /**
   * Lấy toàn bộ danh sách đơn hàng kèm món (dành cho Barista / Nhân viên).
   */
  async findAll() {
    const orders = await this.prisma.order.findMany({
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
   * Hỗ trợ ràng buộc mỗi tài khoản chỉ được dùng mã đúng 1 lần nếu truyền userId.
   */
  async validatePromotion(code: string, subtotal: number, userId?: number) {
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

    if (userId) {
      const alreadyUsed = await this.prisma.order.findFirst({
        where: {
          userId,
          couponCode: normalizedCode,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED] },
        },
      });
      if (alreadyUsed) {
        throw new BadRequestException(
          `Tài khoản của bạn đã sử dụng mã khuyến mãi "${normalizedCode}" này rồi. Mỗi tài khoản chỉ được dùng mã 1 lần.`
        );
      }
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

      // 8. Transaction thanh toán thành công: trừ pointsUsed và cộng điểm tích lũy mới
      const loyaltyPointsEarned = Math.floor(order.total / LOYALTY_EARN_RATE);
      const pointsUsed = order.pointsUsed || 0;
      let updatedUserPoints: number | undefined;

      if (order.userId) {
        if (pointsUsed > 0) {
          const user = await tx.user.findUnique({ where: { id: order.userId } });
          if (user) {
            if (user.loyaltyPoints < pointsUsed) {
              throw new BadRequestException(
                `Số điểm tích lũy của bạn không đủ (${user.loyaltyPoints} điểm < ${pointsUsed} điểm)`
              );
            }
            updatedUserPoints = Math.max(0, user.loyaltyPoints - pointsUsed + loyaltyPointsEarned);
            await tx.user.update({
              where: { id: order.userId },
              data: { loyaltyPoints: updatedUserPoints },
            });
          }
        } else if (loyaltyPointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: loyaltyPointsEarned } },
          });
        }
      }

      this.logger.log(`[Webhook] Đơn hàng #${order.id} đã chuyển trạng thái PENDING -> PAID thành công!`);

      return {
        idempotent: false,
        success: true,
        orderId: order.id,
        status: OrderStatus.PAID,
        paymentId: payment.id,
        loyaltyPointsEarned,
        pointsUsed: order.pointsUsed,
        remainingLoyaltyPoints: updatedUserPoints,
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
        pointsUsed: true,
        pointDiscount: true,
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
      pointsUsed: order.pointsUsed,
      pointDiscount: order.pointDiscount,
      updatedAt: order.updatedAt,
    };
  }
}
