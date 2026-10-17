import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

describe('CreateOrderDto', () => {
  it('validates a cart with product option IDs', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [
        {
          productId: 12,
          size: 'M',
          toppings: ['pearl'],
          quantity: 2,
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an invalid topping ID', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [
        {
          productId: 12,
          size: 'M',
          toppings: ['unknown'],
          quantity: 2,
        },
      ],
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});

describe('OrdersService', () => {
  let service: OrdersService;
  let orderCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    orderCreate = vi.fn().mockResolvedValue({
      id: 22,
      total: 70000,
      status: 'PENDING',
      createdAt: new Date('2026-10-14T00:00:00.000Z'),
    });
    const transaction = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 12, stock: 10, price: 25000 },
        ]),
      },
      order: { create: orderCreate },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn(
        (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          callback(transaction)
      ),
    } as unknown as PrismaService;

    service = new OrdersService(prisma);
  });

  it('creates a pending order using server prices and returns its code', async () => {
    const result = await service.create(
      plainToInstance(CreateOrderDto, {
        items: [
          {
            productId: 12,
            size: 'M',
            toppings: ['pearl'],
            quantity: 2,
          },
        ],
      })
    );

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 70000,
          status: 'PENDING',
          items: {
            create: [
              expect.objectContaining({
                productId: 12,
                price: 35000,
                qty: 2,
                lineTotal: 70000,
              }),
            ],
          },
        }),
      })
    );
    expect(result).toMatchObject({
      orderId: 22,
      orderCode: 'BL-000022',
      status: 'PENDING',
      total: 70000,
    });
  });
  describe('OrdersService.pay – idempotency', () => {
    let service: OrdersService;
    let paymentCreate: ReturnType<typeof vi.fn>;
    let paymentFindUnique: ReturnType<typeof vi.fn>;

    const existingPayment = {
      id: 1, orderId: 10, idempotencyKey: 'key-abc',
      amount: 70000, method: 'WALLET', createdAt: new Date(),
    };

    beforeEach(() => {
      paymentCreate = vi.fn().mockResolvedValue(existingPayment);
      paymentFindUnique = vi.fn().mockResolvedValue(null); // chưa có key

      const transaction = {
        payment: { findUnique: paymentFindUnique, create: paymentCreate },
        order: {
          findUnique: vi.fn().mockResolvedValue({ id: 10, status: 'PENDING' }),
          update: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const prisma = {
        $transaction: vi.fn((cb) => cb(transaction)),
      } as unknown as PrismaService;

      service = new OrdersService(prisma);
    });

    it('tạo payment mới khi idempotency-key chưa tồn tại', async () => {
      const result = await service.pay(10, 'key-abc', { method: 'WALLET', amount: 70000 });
      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(result.idempotent).toBe(false);
    });

    it('trả về payment cũ khi key đã tồn tại — KHÔNG tạo mới', async () => {
      paymentFindUnique.mockResolvedValue(existingPayment); // key đã có

      const result = await service.pay(10, 'key-abc', { method: 'WALLET', amount: 70000 });

      expect(paymentCreate).not.toHaveBeenCalled(); // ← quan trọng nhất
      expect(result.idempotent).toBe(true);
      expect(result.payment.idempotencyKey).toBe('key-abc');
    });
  });

});
