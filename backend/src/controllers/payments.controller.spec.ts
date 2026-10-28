import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsController } from './payments.controller.js';
import { OrdersService } from '../services/orders.service.js';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let ordersService: Partial<OrdersService>;

  beforeEach(() => {
    ordersService = {
      pay: vi.fn().mockResolvedValue({
        idempotent: false,
        payment: { id: 1, orderId: 10, amount: 70000, method: 'WALLET' },
      }),
    };
    controller = new PaymentsController(ordersService as OrdersService);
  });

  it('gọi ordersService.pay với đúng orderId, key và method', async () => {
    const result = await controller.pay('key-123', {
      orderId: 10,
      method: 'WALLET',
    });

    expect(ordersService.pay).toHaveBeenCalledWith(10, 'key-123', {
      method: 'WALLET',
    });
    expect(result).toMatchObject({
      idempotent: false,
      payment: expect.objectContaining({ orderId: 10, amount: 70000 }),
    });
  });

  it('ném lỗi BadRequestException nếu thiếu header Idempotency-Key', async () => {
    await expect(
      controller.pay('', { orderId: 10, method: 'WALLET' })
    ).rejects.toThrow(BadRequestException);
  });
});
