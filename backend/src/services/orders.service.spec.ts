import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { MAX_ORDER_ATTEMPTS, OrdersService } from './orders.service.js';
 
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
          { id: 12, stock: 10, price: 25000, version: 0 },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
  describe('OrdersService.processPaymentWebhook – webhook idempotency & state machine', () => {
    let service: OrdersService;
    let paymentCreate: ReturnType<typeof vi.fn>;
    let paymentFindUnique: ReturnType<typeof vi.fn>;
    let orderFindUnique: ReturnType<typeof vi.fn>;
    let orderUpdate: ReturnType<typeof vi.fn>;

    const existingPayment = {
      id: 1,
      orderId: 10,
      idempotencyKey: 'TXN_TEST_123',
      amount: 70000,
      method: 'WALLET',
      createdAt: new Date(),
    };

    beforeEach(() => {
      paymentCreate = vi.fn().mockResolvedValue(existingPayment);
      paymentFindUnique = vi.fn().mockResolvedValue(null);
      orderFindUnique = vi.fn().mockResolvedValue({ id: 10, status: 'PENDING', total: 70000 });
      orderUpdate = vi.fn().mockResolvedValue({ id: 10, status: 'PAID' });

      const transaction = {
        payment: { findUnique: paymentFindUnique, create: paymentCreate },
        order: {
          findUnique: orderFindUnique,
          update: orderUpdate,
        },
      } as unknown as Prisma.TransactionClient;

      const prisma = {
        $transaction: vi.fn((cb) => cb(transaction)),
      } as unknown as PrismaService;

      service = new OrdersService(prisma);
    });

    it('tạo payment mới và đổi order sang PAID khi webhook thành công và transactionRef chưa tồn tại', async () => {
      const result = await service.processPaymentWebhook({
        transactionRef: 'TXN_NEW_001',
        orderId: 10,
        amount: 70000,
        status: 'SUCCESS',
      });

      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 10,
            amount: 70000,
            idempotencyKey: 'TXN_NEW_001',
          }),
        })
      );
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { status: 'PAID' },
        })
      );
      expect(result).toMatchObject({
        idempotent: false,
        success: true,
        orderId: 10,
        status: 'PAID',
      });
    });

    it('trả về idempotent: true khi transactionRef đã tồn tại — KHÔNG tạo mới payment', async () => {
      paymentFindUnique.mockResolvedValue(existingPayment);

      const result = await service.processPaymentWebhook({
        transactionRef: 'TXN_TEST_123',
        orderId: 10,
        amount: 70000,
        status: 'SUCCESS',
      });

      expect(paymentCreate).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        idempotent: true,
        success: true,
        orderId: 10,
        status: 'PAID',
      });
    });

    it('bỏ qua và trả về idempotent: true nếu đơn hàng đã ở trạng thái PAID', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: 'PAID', total: 70000 });

      const result = await service.processPaymentWebhook({
        transactionRef: 'TXN_ANOTHER_456',
        orderId: 10,
        amount: 70000,
        status: 'SUCCESS',
      });

      expect(paymentCreate).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        idempotent: true,
        success: true,
        orderId: 10,
        status: 'PAID',
      });
    });

    it('từ chối (BadRequestException) khi số tiền khách chuyển không khớp với order.total', async () => {
      await expect(
        service.processPaymentWebhook({
          transactionRef: 'TXN_FRAUD_999',
          orderId: 10,
          amount: 1000,
          status: 'SUCCESS',
        })
      ).rejects.toThrow('không khớp');
    });

    it('cập nhật PAYMENT_FAILED khi ngân hàng gửi status không phải SUCCESS', async () => {
      const result = await service.processPaymentWebhook({
        transactionRef: 'TXN_FAIL_001',
        orderId: 10,
        amount: 70000,
        status: 'FAILED',
      });

      expect(paymentCreate).not.toHaveBeenCalled();
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { status: 'PAYMENT_FAILED' },
        })
      );
      expect(result).toMatchObject({
        idempotent: false,
        success: false,
        status: 'PAYMENT_FAILED',
      });
    });

    it('chặn thanh toán khi đơn hàng ở trạng thái sai (ví dụ: CANCELLED)', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: 'CANCELLED', total: 70000 });

      await expect(
        service.processPaymentWebhook({
          transactionRef: 'TXN_INVALID_STATE',
          orderId: 10,
          amount: 70000,
          status: 'SUCCESS',
        })
      ).rejects.toThrow();
    });
  });
});

describe('OrdersService - inventory control (transaction + optimistic locking)', () => {
  type FakeProduct = { id: number; stock: number; price: number; version: number };
 
  /**
   * DB giả lập trong bộ nhớ: updateMany là nguyên tử (như UPDATE ... WHERE của
   * Postgres), còn findMany nhường event loop để các request đồng thời thực sự
   * xen kẽ giữa bước "đọc" và bước "ghi". Transaction thất bại sẽ được rollback.
   */
  function createFakeDb(initial: FakeProduct[]) {
    const products = new Map(initial.map((p) => [p.id, { ...p }]));
    let orderSeq = 0;
    const orders: unknown[] = [];
 
    const prisma = {
      $transaction: async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>
      ) => {
        const undo: Array<() => void> = [];
        const pendingOrders: unknown[] = [];
        const tx = {
          product: {
            findMany: async ({ where }: { where: { id: { in: number[] } } }) => {
              const snapshot = where.id.in
                .map((id) => products.get(id))
                .filter((p): p is FakeProduct => Boolean(p))
                .map((p) => ({ ...p }));
              await new Promise((resolve) => setImmediate(resolve));
              return snapshot;
            },
            updateMany: async ({
              where,
              data,
            }: {
              where: { id: number; version: number; stock: { gte: number } };
              data: {
                stock: { decrement: number };
                version: { increment: number };
              };
            }) => {
              const p = products.get(where.id);
              if (!p || p.version !== where.version || p.stock < where.stock.gte) {
                return { count: 0 };
              }
              const before = { ...p };
              p.stock -= data.stock.decrement;
              p.version += data.version.increment;
              undo.push(() => products.set(before.id, before));
              return { count: 1 };
            },
          },
          order: {
            create: async ({ data }: { data: { total: number; status: string } }) => {
              const order = {
                id: ++orderSeq,
                total: data.total,
                status: data.status,
                createdAt: new Date(),
              };
              pendingOrders.push(order);
              return order;
            },
          },
        } as unknown as Prisma.TransactionClient;
 
        try {
          const result = await callback(tx);
          orders.push(...pendingOrders);
          return result;
        } catch (error) {
          undo.reverse().forEach((fn) => fn());
          throw error;
        }
      },
    } as unknown as PrismaService;
 
    return { prisma, products, orders };
  }
 
  const makeDto = (productId: number, quantity: number) =>
    plainToInstance(CreateOrderDto, {
      items: [{ productId, size: 'S', toppings: [], quantity }],
    });
 
  it('decrements stock and bumps version when an order is created', async () => {
    const db = createFakeDb([{ id: 1, stock: 10, price: 25000, version: 0 }]);
    const service = new OrdersService(db.prisma);
 
    await service.create(makeDto(1, 3));
 
    expect(db.products.get(1)).toMatchObject({ stock: 7, version: 1 });
  });
 
  it('never oversells when many customers order at the same time', async () => {
    // 10 ly còn lại, 25 khách cùng đặt 1 ly -> đúng 10 đơn thành công.
    const db = createFakeDb([{ id: 1, stock: 10, price: 25000, version: 0 }]);
    const service = new OrdersService(db.prisma);
 
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => service.create(makeDto(1, 1)))
    );
 
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
 
    expect(succeeded).toHaveLength(10);
    expect(failed).toHaveLength(15);
    for (const failure of failed) {
      // Hết hàng thật (400) hoặc tranh chấp quá nhiều (409) - không phải lỗi lạ.
      expect([BadRequestException, ConflictException]).toContainEqual(
        failure.reason.constructor
      );
    }
    expect(db.products.get(1)!.stock).toBe(0);
    expect(db.orders).toHaveLength(10);
  });
 
  it('rolls back earlier stock deductions when a later product conflicts', async () => {
    const db = createFakeDb([
      { id: 1, stock: 5, price: 25000, version: 0 },
      { id: 2, stock: 1, price: 30000, version: 0 },
    ]);
    const service = new OrdersService(db.prisma);
 
    // Đơn A lấy hết sản phẩm 2; đơn B cần cả 1 và 2 -> B phải thất bại và
    // không được để lại phần kho đã trừ của sản phẩm 1.
    const orderA = service.create(makeDto(2, 1));
    const orderB = service.create(
      plainToInstance(CreateOrderDto, {
        items: [
          { productId: 1, size: 'S', toppings: [], quantity: 2 },
          { productId: 2, size: 'S', toppings: [], quantity: 1 },
        ],
      })
    );
    const [a, b] = await Promise.allSettled([orderA, orderB]);
 
    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('rejected');
    expect(db.products.get(1)!.stock).toBe(5);
    expect(db.products.get(2)!.stock).toBe(0);
  });
 
  it('rejects with 400 when requested quantity exceeds stock', async () => {
    const db = createFakeDb([{ id: 1, stock: 2, price: 25000, version: 0 }]);
    const service = new OrdersService(db.prisma);
 
    await expect(service.create(makeDto(1, 3))).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(db.products.get(1)).toMatchObject({ stock: 2, version: 0 });
  });
 
  it('gives up with 409 after too many version conflicts', async () => {
    const tx = {
      product: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 1, stock: 10, price: 25000, version: 0 }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      order: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    const prisma = {
      $transaction: vi.fn((cb: (t: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(tx)
      ),
    } as unknown as PrismaService;
    const service = new OrdersService(prisma);
 
    await expect(service.create(makeDto(1, 1))).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(MAX_ORDER_ATTEMPTS);
  });
});
 

