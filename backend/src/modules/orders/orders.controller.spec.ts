import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus } from './order-state-machine.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: {
    create: ReturnType<typeof vi.fn>;
    findMyOrders: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    ordersService = {
      create: vi.fn().mockResolvedValue({
        orderId: 1,
        orderCode: 'BL-000001',
        total: 45000,
        status: OrderStatus.PENDING,
      }),
      findMyOrders: vi.fn().mockResolvedValue([
        {
          id: 1,
          orderCode: 'BL-000001',
          userId: 7,
          total: 45000,
          status: OrderStatus.PAID,
          items: [],
        },
      ]),
      updateStatus: vi.fn().mockResolvedValue({
        id: 1,
        orderCode: 'BL-000001',
        status: OrderStatus.PREPARING,
        items: [],
      }),
    };

    controller = new OrdersController(
      ordersService as unknown as OrdersService
    );
  });

  it('GET /orders/me gọi ordersService.findMyOrders với user.id từ JWT request', async () => {
    const result = await controller.findMyOrders({ user: { id: 7 } });

    expect(ordersService.findMyOrders).toHaveBeenCalledWith(7);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      orderCode: 'BL-000001',
      status: OrderStatus.PAID,
    });
  });

  it('PATCH /orders/:id/status gọi ordersService.updateStatus với id và status mới', async () => {
    const result = await controller.updateStatus(1, {
      status: OrderStatus.PREPARING,
    });

    expect(ordersService.updateStatus).toHaveBeenCalledWith(
      1,
      OrderStatus.PREPARING
    );
    expect(result).toMatchObject({
      id: 1,
      orderCode: 'BL-000001',
      status: OrderStatus.PREPARING,
    });
  });
});
