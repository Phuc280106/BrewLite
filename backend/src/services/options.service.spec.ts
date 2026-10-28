import { describe, expect, it } from 'vitest';
import { OptionsService } from './options.service.js';
import { PRODUCT_SIZES, PRODUCT_TOPPINGS } from '../common/constants/options.constants.js';

describe('OptionsService', () => {
  const service = new OptionsService();

  it('should return all sizes and toppings with price maps', () => {
    const result = service.getOptions();

    expect(result.sizes).toEqual(PRODUCT_SIZES);
    expect(result.toppings).toEqual(PRODUCT_TOPPINGS);
    expect(result.sizeExtraPrice['M']).toBe(5000);
    expect(result.toppingPrice['pearl']).toBe(5000);
  });
});
