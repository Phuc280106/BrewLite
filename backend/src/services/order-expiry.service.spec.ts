import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { OrderStatus } from '../common/state-machine/order-state-machine.js';
import { OrderExpiryService, PAYMENT_TTL_MINUTES } from './order-expiry.service.js';

describe('OrderExpiryService.expireStaleOrders', () => {
  let orderFindMany: ReturnType<typeof vi.fn>;
  let orderFindUnique: ReturnType<typeof vi.fn>;
  let orderUpdate: ReturnType<typeof vi.fn>;
  let productUpdate: ReturnType<typeof vi.fn>;
  let transactionFn: ReturnType<typeof vi.fn>;
  let service: OrderExpiryService;

  const staleOrder = {
    id: 1,
    status: OrderStatus.PENDING,
    items: [
      { productId: 10, qty: 2 },
      { productId: 11, qty: 1 },
    ],
  };

  beforeEach(() => {
    orderFindMany = vi.fn().mockResolvedValue([staleOrder]);
    orderFindUnique = vi.fn().mockResolvedValue({ status: OrderStatus.PENDING });
    orderUpdate = vi.fn().mockResolvedValue({ id: 1, status: OrderStatus.CANCELLED });
    productUpdate = vi.fn().mockResolvedValue({});

    const txClient = {
      order: { findUnique: orderFindUnique, update: orderUpdate },
      product: { update: productUpdate },
    } as unknown as Prisma.TransactionClient;

    transactionFn = vi.fn((cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(txClient));

    const prisma = {
      order: { findMany: orderFindMany },
      $transaction: transactionFn,
    } as unknown as PrismaService;

    service = new OrderExpiryService(prisma);
  });

  it('không làm gì nếu không có đơn hết hạn', async () => {
    orderFindMany.mockResolvedValue([]);
    await service.expireStaleOrders();
    expect(transactionFn).not.toHaveBeenCalled();
  });

  it('query đúng điều kiện: status PENDING/PAYMENT_FAILED, createdAt < cutoff', async () => {
    const before = Date.now();
    await service.expireStaleOrders();
    const after = Date.now();

    const [callArgs] = orderFindMany.mock.calls[0];
    expect(callArgs.where.status).toEqual({
      in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED],
    });

    const cutoff: Date = callArgs.where.createdAt.lt;
    const expectedMs = PAYMENT_TTL_MINUTES * 60 * 1000;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(expectedMs - 50);
    expect(after - cutoff.getTime()).toBeLessThanOrEqual(expectedMs + 50);
  });

  it('hoàn stock cho từng item rồi cancel đơn trong cùng 1 transaction', async () => {
    await service.expireStaleOrders();

    expect(transactionFn).toHaveBeenCalledOnce();

    // Hoàn stock 2 items
    expect(productUpdate).toHaveBeenCalledTimes(2);
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { stock: { increment: 2 } },
    });
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { stock: { increment: 1 } },
    });

    // Cancel đơn
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: OrderStatus.CANCELLED },
    });
  });

  it('bỏ qua đơn đã được thanh toán đồng thời (race condition protection)', async () => {
    // Đơn đã chuyển sang PAID ngay trước khi cronjob xử lý
    orderFindUnique.mockResolvedValue({ status: OrderStatus.PAID });

    await service.expireStaleOrders();

    expect(productUpdate).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('xử lý tiếp các đơn còn lại nếu một đơn bị lỗi', async () => {
    const staleOrder2 = { id: 2, status: OrderStatus.PENDING, items: [{ productId: 12, qty: 1 }] };
    orderFindMany.mockResolvedValue([staleOrder, staleOrder2]);

    // Đơn đầu tiên throw lỗi, đơn thứ hai vẫn xử lý được
    transactionFn
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockImplementationOnce((cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb({
          order: {
            findUnique: vi.fn().mockResolvedValue({ status: OrderStatus.PENDING }),
            update: orderUpdate,
          },
          product: { update: productUpdate },
        } as unknown as Prisma.TransactionClient)
      );

    await expect(service.expireStaleOrders()).resolves.toBeUndefined();
    expect(productUpdate).toHaveBeenCalledTimes(1); // chỉ đơn 2
  });
});
