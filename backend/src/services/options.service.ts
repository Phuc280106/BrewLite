import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  PRODUCT_SIZES,
  PRODUCT_TOPPINGS,
  SIZE_EXTRA_PRICE,
  TOPPING_PRICE,
} from '../common/constants/options.constants.js';

@Injectable()
export class OptionsService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async getToppings() {
    if (this.prisma) {
      try {
        const toppings = await this.prisma.topping.findMany({
          orderBy: { id: 'asc' },
        });
        if (toppings && toppings.length > 0) {
          return toppings;
        }
      } catch {
        // Fallback nếu kết nối database bị gián đoạn
      }
    }

    return PRODUCT_TOPPINGS.map((t, idx) => ({
      id: idx + 1,
      name: t.name,
      price: t.price,
      stock: 100,
    }));
  }

  async getOptions() {
    let dbToppings: Array<{ id: number; name: string; price: number; stock: number }> = [];

    if (this.prisma) {
      try {
        dbToppings = await this.prisma.topping.findMany({
          orderBy: { id: 'asc' },
        });
      } catch {
        // Fallback
      }
    }

    if (dbToppings && dbToppings.length > 0) {
      const toppings = dbToppings.map((t) => ({
        id: String(t.id),
        name: t.name,
        price: t.price,
        stock: t.stock,
      }));

      const toppingPrice: Record<string, number> = { ...TOPPING_PRICE };
      for (const t of dbToppings) {
        toppingPrice[String(t.id)] = t.price;
        toppingPrice[t.name] = t.price;
      }

      return {
        sizes: PRODUCT_SIZES,
        toppings,
        sizeExtraPrice: SIZE_EXTRA_PRICE,
        toppingPrice,
      };
    }

    return {
      sizes: PRODUCT_SIZES,
      toppings: PRODUCT_TOPPINGS,
      sizeExtraPrice: SIZE_EXTRA_PRICE,
      toppingPrice: TOPPING_PRICE,
    };
  }
}
