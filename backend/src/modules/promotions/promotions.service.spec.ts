import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { PromotionsService } from './promotions.service.js';

const promo = (overrides = {}) => ({
  code: 'BREW10',
  description: null,
  isActive: true,
  minOrder: 50000,
  discountPercent: 10,
  discountAmount: null,
  ...overrides,
});

function build(found: unknown) {
  const findUnique = vi.fn().mockResolvedValue(found);
  const prisma = { promotion: { findUnique } } as unknown as PrismaService;
  return { service: new PromotionsService(prisma), findUnique };
}

describe('PromotionsService.validate', () => {
  it('giảm theo phần trăm và chuẩn hoá mã về chữ hoa', async () => {
    const { service, findUnique } = build(promo());
    const result = await service.validate(' brew10 ', 100000);
    expect(findUnique).toHaveBeenCalledWith({ where: { code: 'BREW10' } });
    expect(result).toMatchObject({ discount: 10000, total: 90000 });
  });

  it('giảm theo số tiền cố định, không vượt quá tạm tính', async () => {
    const { service } = build(
      promo({ code: 'CHAOBAN', discountPercent: null, discountAmount: 20000, minOrder: 10000 })
    );
    expect((await service.validate('CHAOBAN', 15000)).discount).toBe(15000);
  });

  it('báo lỗi khi mã không tồn tại hoặc bị vô hiệu hoá', async () => {
    await expect(build(null).service.validate('X', 100000)).rejects.toThrow(BadRequestException);
    await expect(
      build(promo({ isActive: false })).service.validate('BREW10', 100000)
    ).rejects.toThrow(BadRequestException);
  });

  it('báo lỗi khi chưa đạt giá trị tối thiểu', async () => {
    await expect(build(promo()).service.validate('BREW10', 30000)).rejects.toThrow(
      BadRequestException
    );
  });
});
