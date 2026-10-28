import { Injectable } from '@nestjs/common';
import {
  PRODUCT_SIZES,
  PRODUCT_TOPPINGS,
  SIZE_EXTRA_PRICE,
  TOPPING_PRICE,
} from '../common/constants/options.constants.js';

@Injectable()
export class OptionsService {
  getOptions() {
    return {
      sizes: PRODUCT_SIZES,
      toppings: PRODUCT_TOPPINGS,
      sizeExtraPrice: SIZE_EXTRA_PRICE,
      toppingPrice: TOPPING_PRICE,
    };
  }
}
