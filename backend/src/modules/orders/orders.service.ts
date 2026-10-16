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

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrderDto) {
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
}
