import {
  BadRequestException,
  Injectable,
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
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(input: CreateOrderDto, userId?: number) {
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

      for (const [productId, quantity] of requestedQuantityByProductId) {
        const product = productsById.get(productId)!;
        if (quantity > product.stock) {
          throw new BadRequestException(
            `Insufficient stock for product ${productId}`
          );
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
      const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

      const order = await transaction.order.create({
        data: {
          userId: userId ?? null,
          total,
          status: 'PENDING',
          items: { create: orderItems },
        },
        select: { id: true, total: true, status: true, createdAt: true },
      });

      return {
        orderId: order.id,
        orderCode: `BL-${String(order.id).padStart(6, '0')}`,
        total: order.total,
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


      return { idempotent: false, payment };
    });
  }

}
