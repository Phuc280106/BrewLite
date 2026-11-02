import { describe, expect, it, vi } from 'vitest';
import { OptionsService } from './options.service.js';
import { PRODUCT_SIZES, PRODUCT_TOPPINGS } from '../common/constants/options.constants.js';

describe('OptionsService', () => {
  it('should return default sizes and toppings with price maps when no prisma is provided', async () => {
    const service = new OptionsService();
    const result = await service.getOptions();

    expect(result.sizes).toEqual(PRODUCT_SIZES);
    expect(result.toppings).toEqual(PRODUCT_TOPPINGS);
    expect(result.sizeExtraPrice['M']).toBe(5000);
    expect(result.toppingPrice['pearl']).toBe(5000);
  });

  it('should return database toppings with stock when prisma is provided', async () => {
    const mockPrisma = {
      topping: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, name: 'Trân châu đen', price: 5000, stock: 45 },
          { id: 2, name: 'Kem Macchiato', price: 10000, stock: 0 },
        ]),
      },
    } as any;

    const service = new OptionsService(mockPrisma);
    const result = await service.getOptions();

    expect(result.toppings).toHaveLength(2);
    expect(result.toppings[0]).toEqual({
      id: '1',
      name: 'Trân châu đen',
      price: 5000,
      stock: 45,
    });
    expect(result.toppings[1]).toEqual({
      id: '2',
      name: 'Kem Macchiato',
      price: 10000,
      stock: 0,
    });
    expect(result.toppingPrice['1']).toBe(5000);
    expect(result.toppingPrice['2']).toBe(10000);
  });
});
