import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderStatus } from './order-state-machine.js';
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
          findUnique: vi.fn().mockResolvedValue({ id: 10, status: 'PENDING', total: 70000 }),
          update: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const prisma = {
        $transaction: vi.fn((cb) => cb(transaction)),
      } as unknown as PrismaService;

      service = new OrdersService(prisma);
    });

    it('tạo payment mới khi idempotency-key chưa tồn tại', async () => {
      const result = await service.pay(10, 'key-abc', { method: 'WALLET' });
      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 70000,
            method: 'WALLET',
          }),
        })
      );
      expect(result.idempotent).toBe(false);
    });

    it('trả về payment cũ khi key đã tồn tại — KHÔNG tạo mới', async () => {
      paymentFindUnique.mockResolvedValue(existingPayment); // key đã có

      const result = await service.pay(10, 'key-abc', { method: 'WALLET' });

      expect(paymentCreate).not.toHaveBeenCalled(); // ← quan trọng nhất
      expect(result.idempotent).toBe(true);
      expect(result.payment.idempotencyKey).toBe('key-abc');
    });

    it('chặn khi tái sử dụng idempotency-key cho một orderId khác', async () => {
      paymentFindUnique.mockResolvedValue(existingPayment); // existingPayment có orderId: 10

      // Thử thanh toán cho đơn hàng khác (orderId: 99) nhưng dùng lại key cũ của đơn 10
      await expect(
        service.pay(99, 'key-abc', { method: 'WALLET' })
      ).rejects.toThrow('đã được sử dụng cho đơn hàng #10');
    });

    it('tự động lấy đúng số tiền từ order.total để tạo payment', async () => {
      const result = await service.pay(10, 'key-auto-amount', { method: 'WALLET' });

      expect(paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 70000,
          }),
        })
      );
      expect(result.idempotent).toBe(false);
    });

    it('cho phép thanh toán khi đơn hàng đang ở trạng thái PAYMENT_FAILED (thử lại)', async () => {
      // Giả lập đơn hàng lần trước bị lỗi (PAYMENT_FAILED)
      vi.spyOn(service['prisma'], '$transaction').mockImplementation(async (cb) => {
        return cb({
          payment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          order: {
            findUnique: vi.fn().mockResolvedValue({ id: 10, status: 'PAYMENT_FAILED', total: 70000 }),
            update: vi.fn(),
          },
        } as any);
      });

      const result = await service.pay(10, 'key-retry', { method: 'WALLET' });
      expect(result.idempotent).toBe(false);
    });

    it('chặn thanh toán khi đơn hàng ở trạng thái sai (ví dụ: CANCELLED hoặc COMPLETED)', async () => {
      vi.spyOn(service['prisma'], '$transaction').mockImplementation(async (cb) => {
        return cb({
          payment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          order: {
            findUnique: vi.fn().mockResolvedValue({ id: 10, status: 'CANCELLED', total: 70000 }),
            update: vi.fn(),
          },
        } as any);
      });

      await expect(
        service.pay(10, 'key-invalid', { method: 'WALLET' })
      ).rejects.toThrow();
    });

  });

  describe('OrdersService.updateStatus – Order State Machine', () => {
    let service: OrdersService;
    let orderFindUnique: ReturnType<typeof vi.fn>;
    let orderUpdate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      orderFindUnique = vi.fn();
      orderUpdate = vi.fn();
      const prisma = {
        order: {
          findUnique: orderFindUnique,
          update: orderUpdate,
        },
      } as unknown as PrismaService;

      service = new OrdersService(prisma);
    });

    it('chuyển trạng thái hợp lệ tuần tự: PAID -> PREPARING -> READY -> COMPLETED', async () => {
      orderFindUnique.mockResolvedValueOnce({ id: 10, status: OrderStatus.PAID });
      orderUpdate.mockResolvedValueOnce({ id: 10, status: OrderStatus.PREPARING, items: [] });

      const step1 = await service.updateStatus(10, OrderStatus.PREPARING);
      expect(step1).toMatchObject({
        id: 10,
        orderCode: 'BL-000010',
        status: OrderStatus.PREPARING,
      });

      orderFindUnique.mockResolvedValueOnce({ id: 10, status: OrderStatus.PREPARING });
      orderUpdate.mockResolvedValueOnce({ id: 10, status: OrderStatus.READY, items: [] });

      const step2 = await service.updateStatus(10, OrderStatus.READY);
      expect(step2.status).toBe(OrderStatus.READY);

      orderFindUnique.mockResolvedValueOnce({ id: 10, status: OrderStatus.READY });
      orderUpdate.mockResolvedValueOnce({ id: 10, status: OrderStatus.COMPLETED, items: [] });

      const step3 = await service.updateStatus(10, OrderStatus.COMPLETED);
      expect(step3.status).toBe(OrderStatus.COMPLETED);
    });

    it('chặn chuyển trạng thái sai quy tắc (ví dụ: PENDING nhảy sang COMPLETED) và ném lỗi 400 BadRequestException', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: OrderStatus.PENDING });

      await expect(
        service.updateStatus(10, OrderStatus.COMPLETED)
      ).rejects.toThrow(BadRequestException);
      expect(orderUpdate).not.toHaveBeenCalled();
    });

    it('chặn chuyển tiếp từ trạng thái kết thúc (COMPLETED hoặc CANCELLED)', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: OrderStatus.COMPLETED });

      await expect(
        service.updateStatus(10, OrderStatus.CANCELLED)
      ).rejects.toThrow(BadRequestException);
      expect(orderUpdate).not.toHaveBeenCalled();
    });

    it('ném NotFoundException nếu không tìm thấy đơn hàng', async () => {
      orderFindUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, OrderStatus.PREPARING)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('OrdersService.findMyOrders – Lịch sử đơn hàng của user', () => {
    it('trả về danh sách đơn hàng kèm món của user đang đăng nhập theo thứ tự mới nhất', async () => {
      const mockOrders = [
        {
          id: 5,
          userId: 1,
          total: 85000,
          status: OrderStatus.PAID,
          createdAt: new Date('2026-10-22T10:00:00.000Z'),
          items: [
            {
              id: 1,
              productId: 12,
              size: 'M',
              qty: 2,
              lineTotal: 85000,
              product: {
                id: 12,
                name: 'Cappuccino',
                imageUrl: '/images/cappuccino.jpg',
                price: 45000,
              },
            },
          ],
        },
      ];
      const findMany = vi.fn().mockResolvedValue(mockOrders);
      const prisma = {
        order: { findMany },
      } as unknown as PrismaService;

      const service = new OrdersService(prisma);
      const result = await service.findMyOrders(1);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
          orderBy: { createdAt: 'desc' },
          include: expect.objectContaining({
            items: expect.any(Object),
          }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 5,
        orderCode: 'BL-000005',
        status: OrderStatus.PAID,
        total: 85000,
      });
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
