import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrderDto } from '../dto/orders/create-order.dto.js';
import { OrderStatus } from '../common/state-machine/order-state-machine.js';
import { OrdersService } from './orders.service.js';

describe('BrewLite - 3 Ca Kiểm thử Cốt lõi (Core Unit Tests)', () => {
  // =========================================================================
  // (a) CHẶN CHUYỂN TRẠNG THÁI SAI (Order State Machine)
  // =========================================================================
  describe('(a) Chặn được chuyển trạng thái sai (Order State Machine)', () => {
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

    it('chặn chuyển trạng thái sai quy tắc (ví dụ: PENDING nhảy sang COMPLETED) ném 400 BadRequestException', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: OrderStatus.PENDING });

      await expect(
        service.updateStatus(10, OrderStatus.COMPLETED)
      ).rejects.toThrow(BadRequestException);
      expect(orderUpdate).not.toHaveBeenCalled();
    });

    it('chặn hủy đơn khi đã ở trạng thái PREPARING (không cho phép PREPARING -> CANCELLED)', async () => {
      orderFindUnique.mockResolvedValue({ id: 10, status: OrderStatus.PREPARING });

      await expect(
        service.updateStatus(10, OrderStatus.CANCELLED)
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

    it('chặn thanh toán khi đơn hàng đang ở trạng thái không cho phép (ví dụ: CANCELLED)', async () => {
      const prisma = {
        $transaction: vi.fn(async (cb) => {
          return cb({
            payment: { findUnique: vi.fn().mockResolvedValue(null) },
            order: {
              findUnique: vi.fn().mockResolvedValue({ id: 10, status: OrderStatus.CANCELLED, total: 50000 }),
            },
          });
        }),
      } as unknown as PrismaService;
      const testService = new OrdersService(prisma);

      await expect(
        testService.pay(10, 'key-cancelled-order', { method: 'WALLET' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // (b) GỬI 2 LẦN CÙNG IDEMPOTENCY-KEY CHỈ TẠO 1 ĐƠN / 1 GIAO DỊCH
  // =========================================================================
  describe('(b) Gửi 2 lần cùng Idempotency-Key chỉ tạo 1 đơn / 1 giao dịch (Idempotency)', () => {
    let service: OrdersService;
    let paymentCreate: ReturnType<typeof vi.fn>;
    let paymentFindUnique: ReturnType<typeof vi.fn>;
    let orderFindUnique: ReturnType<typeof vi.fn>;
    let orderUpdate: ReturnType<typeof vi.fn>;

    const mockExistingPayment = {
      id: 1,
      orderId: 10,
      idempotencyKey: 'IDEMPOTENT_KEY_123',
      amount: 70000,
      method: 'WALLET',
      createdAt: new Date(),
    };

    beforeEach(() => {
      paymentCreate = vi.fn().mockResolvedValue(mockExistingPayment);
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

    it('lần 1: tạo payment mới khi Idempotency-Key chưa tồn tại', async () => {
      const result = await service.pay(10, 'IDEMPOTENT_KEY_123', { method: 'WALLET' });

      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 10,
            idempotencyKey: 'IDEMPOTENT_KEY_123',
            amount: 70000,
            method: 'WALLET',
          }),
        })
      );
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { status: 'PAID' },
        })
      );
      expect(result.idempotent).toBe(false);
    });

    it('lần 2: gửi cùng Idempotency-Key chỉ trả về kết quả cũ — KHÔNG tạo payment mới', async () => {
      // Giả lập DB đã tồn tại payment với key này từ lần gửi trước
      paymentFindUnique.mockResolvedValue(mockExistingPayment);

      const result = await service.pay(10, 'IDEMPOTENT_KEY_123', { method: 'WALLET' });

      // Đảm bảo tuyệt đối không gọi payment.create thêm lần nào
      expect(paymentCreate).not.toHaveBeenCalled();
      expect(result.idempotent).toBe(true);
      expect(result.payment).toEqual(mockExistingPayment);
    });

    it('chặn dùng lại cùng Idempotency-Key cho đơn hàng khác (ném BadRequestException)', async () => {
      // Key đã được dùng cho đơn #10, không được dùng cho đơn #99
      paymentFindUnique.mockResolvedValue(mockExistingPayment);

      await expect(
        service.pay(99, 'IDEMPOTENT_KEY_123', { method: 'WALLET' })
      ).rejects.toThrow(BadRequestException);
      expect(paymentCreate).not.toHaveBeenCalled();
    });

    it('webhook ngân hàng: nhận cùng 1 transactionRef 2 lần chỉ xử lý 1 lần duy nhất', async () => {
      // Lần 1: Webhook nhận mã giao dịch mới -> tạo payment và đổi trạng thái sang PAID
      const firstCall = await service.processPaymentWebhook({
        transactionRef: 'TXN_BANK_DUPLICATE_CHECK',
        orderId: 10,
        amount: 70000,
        status: 'SUCCESS',
      });
      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(firstCall.idempotent).toBe(false);

      // Lần 2: Webhook gửi lại cùng transactionRef (mạng trễ hoặc retry)
      paymentFindUnique.mockResolvedValue({
        id: 2,
        orderId: 10,
        idempotencyKey: 'TXN_BANK_DUPLICATE_CHECK',
        amount: 70000,
      });
      const secondCall = await service.processPaymentWebhook({
        transactionRef: 'TXN_BANK_DUPLICATE_CHECK',
        orderId: 10,
        amount: 70000,
        status: 'SUCCESS',
      });

      // Không tạo mới payment lần thứ 2
      expect(paymentCreate).toHaveBeenCalledOnce();
      expect(secondCall.idempotent).toBe(true);
      expect(secondCall.status).toBe('PAID');
    });
  });

  // =========================================================================
  // (c) ĐẶT ĐỒNG THỜI KHÔNG VƯỢT TỒN KHO (Concurrency & Optimistic Locking)
  // =========================================================================
  describe('(c) Đặt đồng thời không vượt tồn kho (Concurrency & Optimistic Locking)', () => {
    type FakeIngredient = { id: number; name: string; unit: string; stock: number; version: number };
    type FakeProduct = { id: number; price: number };
    type FakeRecipe = { productId: number; ingredientId: number; size: string; amount: number };

    function createFakeDb(
      initialIngredients: FakeIngredient[],
      initialProducts: FakeProduct[] = [{ id: 1, price: 25000 }],
      recipes: FakeRecipe[] = [{ productId: 1, ingredientId: 1, size: 'S', amount: 1 }]
    ) {
      const ingredients = new Map(initialIngredients.map((i) => [i.id, { ...i }]));
      const products = new Map(initialProducts.map((p) => [p.id, { ...p }]));
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
                return where.id.in
                  .map((id) => products.get(id))
                  .filter((p): p is FakeProduct => Boolean(p))
                  .map((p) => ({ ...p }));
              },
            },
            recipeItem: {
              findMany: async ({ where }: { where: { productId: { in: number[] } } }) => {
                return recipes.filter((r) => where.productId.in.includes(r.productId));
              },
            },
            ingredient: {
              findMany: async ({ where }: { where: { id: { in: number[] } } }) => {
                const snapshot = where.id.in
                  .map((id) => ingredients.get(id))
                  .filter((i): i is FakeIngredient => Boolean(i))
                  .map((i) => ({ ...i }));
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
                const ing = ingredients.get(where.id);
                if (!ing || ing.version !== where.version || ing.stock < where.stock.gte) {
                  return { count: 0 };
                }
                const before = { ...ing };
                ing.stock -= data.stock.decrement;
                ing.version += data.version.increment;
                undo.push(() => ingredients.set(before.id, before));
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

      return { prisma, ingredients, products, orders };
    }

    const makeDto = (productId: number, quantity: number) =>
      plainToInstance(CreateOrderDto, {
        items: [{ productId, size: 'S', toppings: [], quantity }],
      });

    it('trừ tồn kho và tăng version của nguyên liệu khi đặt đơn thành công', async () => {
      const db = createFakeDb([{ id: 1, name: 'Hạt cà phê', unit: 'g', stock: 10, version: 0 }]);
      const service = new OrdersService(db.prisma);

      await service.create(makeDto(1, 3));

      expect(db.ingredients.get(1)).toMatchObject({ stock: 7, version: 1 });
    });

    it('không bao giờ bán âm (never oversells) khi 25 khách hàng đặt đồng thời với 10 suất tồn kho', async () => {
      // 10 đơn vị nguyên liệu còn lại, 25 khách cùng đặt 1 ly đồng thời -> đúng 10 đơn thành công
      const db = createFakeDb([{ id: 1, name: 'Hạt cà phê', unit: 'g', stock: 10, version: 0 }]);
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
        expect([BadRequestException, ConflictException]).toContainEqual(
          failure.reason.constructor
        );
      }
      // Tồn kho nguyên liệu sau cùng phải về đúng 0, KHÔNG BAO GIỜ bị âm
      expect(db.ingredients.get(1)!.stock).toBe(0);
      expect(db.orders).toHaveLength(10);
    });

    it('tự động rollback các nguyên liệu đã trừ nếu gặp xung đột ở nguyên liệu phía sau', async () => {
      const db = createFakeDb(
        [
          { id: 1, name: 'Cà phê', unit: 'g', stock: 5, version: 0 },
          { id: 2, name: 'Sữa đặc', unit: 'ml', stock: 1, version: 0 },
        ],
        [
          { id: 1, price: 25000 },
          { id: 2, price: 30000 },
        ],
        [
          { productId: 1, ingredientId: 1, size: 'S', amount: 1 },
          { productId: 1, ingredientId: 2, size: 'S', amount: 2 }, // Cần 2 sữa đặc nhưng kho chỉ có 1
        ]
      );
      const service = new OrdersService(db.prisma);

      await expect(service.create(makeDto(1, 1))).rejects.toThrow(BadRequestException);

      // Cà phê không được bị trừ hao hụt khi đơn hàng bị từ chối
      expect(db.ingredients.get(1)!.stock).toBe(5);
      expect(db.ingredients.get(2)!.stock).toBe(1);
      expect(db.orders).toHaveLength(0);
    });
  });
});
