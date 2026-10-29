import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { OrderStatus } from '../common/state-machine/order-state-machine.js';
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

  it('accepts an optional valid string couponCode', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [
        {
          productId: 12,
          size: 'M',
          toppings: ['pearl'],
          quantity: 2,
        },
      ],
      couponCode: 'BREW10',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a non-string couponCode', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      items: [
        {
          productId: 12,
          size: 'M',
          toppings: ['pearl'],
          quantity: 2,
        },
      ],
      couponCode: 12345,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
 
describe('OrdersService', () => {
  let service: OrdersService;
  let orderCreate: ReturnType<typeof vi.fn>;
  let promotionFindUnique: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    orderCreate = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: 22,
        total: data.total,
        discount: data.discount ?? 0,
        couponCode: data.couponCode ?? null,
        status: data.status,
        createdAt: new Date('2026-10-14T00:00:00.000Z'),
      })
    );
    promotionFindUnique = vi.fn().mockResolvedValue(null);
    const transaction = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 12, stock: 10, price: 25000, version: 0 },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      promotion: { findUnique: promotionFindUnique },
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

  it('áp dụng mã giảm giá theo phần trăm (BREW10: 10%) và trừ vào total', async () => {
    promotionFindUnique.mockResolvedValue({
      code: 'BREW10',
      discountPercent: 10,
      discountAmount: null,
      minOrder: 50000,
      isActive: true,
    });

    const result = await service.create(
      plainToInstance(CreateOrderDto, {
        items: [
          { productId: 12, size: 'M', toppings: ['pearl'], quantity: 2 },
        ],
        couponCode: 'brew10',
      })
    );

    // subtotal = 70.000đ, discount 10% = 7.000đ -> total = 63.000đ
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 63000,
          discount: 7000,
          couponCode: 'BREW10',
          status: 'PENDING',
        }),
      })
    );
    expect(result).toMatchObject({
      orderId: 22,
      total: 63000,
      discount: 7000,
      couponCode: 'BREW10',
    });
  });

  it('áp dụng mã giảm giá theo số tiền cố định (CHAOBAN: 20.000đ) và trừ vào total', async () => {
    promotionFindUnique.mockResolvedValue({
      code: 'CHAOBAN',
      discountPercent: null,
      discountAmount: 20000,
      minOrder: 40000,
      isActive: true,
    });

    const result = await service.create(
      plainToInstance(CreateOrderDto, {
        items: [
          { productId: 12, size: 'M', toppings: ['pearl'], quantity: 2 },
        ],
        couponCode: 'CHAOBAN',
      })
    );

    // subtotal = 70.000đ, discount = 20.000đ -> total = 50.000đ
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 50000,
          discount: 20000,
          couponCode: 'CHAOBAN',
          status: 'PENDING',
        }),
      })
    );
    expect(result).toMatchObject({
      orderId: 22,
      total: 50000,
      discount: 20000,
      couponCode: 'CHAOBAN',
    });
  });

  it('ném lỗi BadRequestException khi mã khuyến mãi không tồn tại', async () => {
    promotionFindUnique.mockResolvedValue(null);

    await expect(
      service.create(
        plainToInstance(CreateOrderDto, {
          items: [
            { productId: 12, size: 'M', toppings: ['pearl'], quantity: 2 },
          ],
          couponCode: 'INVALID_CODE',
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ném lỗi BadRequestException khi mã khuyến mãi đã bị vô hiệu hóa (isActive: false)', async () => {
    promotionFindUnique.mockResolvedValue({
      code: 'EXPIRED',
      discountPercent: 10,
      discountAmount: null,
      minOrder: 10000,
      isActive: false,
    });

    await expect(
      service.create(
        plainToInstance(CreateOrderDto, {
          items: [
            { productId: 12, size: 'M', toppings: ['pearl'], quantity: 2 },
          ],
          couponCode: 'EXPIRED',
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ném lỗi BadRequestException khi đơn hàng chưa đạt giá trị tối thiểu (minOrder)', async () => {
    promotionFindUnique.mockResolvedValue({
      code: 'VIP100',
      discountPercent: 20,
      discountAmount: null,
      minOrder: 100000,
      isActive: true,
    });

    // subtotal = 70.000đ < minOrder (100.000đ)
    await expect(
      service.create(
        plainToInstance(CreateOrderDto, {
          items: [
            { productId: 12, size: 'M', toppings: ['pearl'], quantity: 2 },
          ],
          couponCode: 'VIP100',
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
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
  describe('OrdersService.pay – tích lũy điểm thưởng (loyalty points)', () => {
    let service: OrdersService;
    let userUpdate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      userUpdate = vi.fn().mockResolvedValue({ id: 9, loyaltyPoints: 17 });

      const transaction = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 1 }),
        },
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 10,
            userId: 9,
            status: 'PENDING',
            total: 75000,
          }),
          update: vi.fn(),
        },
        user: { update: userUpdate },
      } as unknown as Prisma.TransactionClient;

      const prisma = {
        $transaction: vi.fn((cb) => cb(transaction)),
      } as unknown as PrismaService;

      service = new OrdersService(prisma);
    });

    it('tự động tính điểm (10.000đ = 1 điểm) và cộng vào User.loyaltyPoints khi order có userId', async () => {
      const result = await service.pay(10, 'key-loyalty', { method: 'WALLET' });

      // 75.000đ / 10.000 = 7 điểm
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: 9 },
        data: {
          loyaltyPoints: {
            increment: 7,
          },
        },
      });
      expect(result.loyaltyPointsEarned).toBe(7);
    });

    it('không cộng điểm khi đơn hàng không có userId (khách vãng lai)', async () => {
      vi.spyOn(service['prisma'], '$transaction').mockImplementation(async (cb) => {
        return cb({
          payment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          order: {
            findUnique: vi.fn().mockResolvedValue({ id: 10, userId: null, status: 'PENDING', total: 75000 }),
            update: vi.fn(),
          },
          user: { update: userUpdate },
        } as any);
      });

      const result = await service.pay(10, 'key-guest', { method: 'WALLET' });
      expect(userUpdate).not.toHaveBeenCalled();
      expect(result.loyaltyPointsEarned).toBe(7);
    });

    it('không gọi user.update nếu đơn hàng có tổng tiền dưới 10.000đ (0 điểm)', async () => {
      vi.spyOn(service['prisma'], '$transaction').mockImplementation(async (cb) => {
        return cb({
          payment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          order: {
            findUnique: vi.fn().mockResolvedValue({ id: 10, userId: 9, status: 'PENDING', total: 8000 }),
            update: vi.fn(),
          },
          user: { update: userUpdate },
        } as any);
      });

      const result = await service.pay(10, 'key-low-amount', { method: 'WALLET' });
      expect(userUpdate).not.toHaveBeenCalled();
      expect(result.loyaltyPointsEarned).toBe(0);
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
