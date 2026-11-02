import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  private calculateAvailability(recipeItems?: any[]): number {
    if (!recipeItems || recipeItems.length === 0) {
      return 0;
    }

    const sizes = [...new Set(recipeItems.map((item) => item.size))];
    const bySize: Record<string, number> = {};

    for (const s of sizes) {
      const itemsForSize = recipeItems.filter((item) => item.size === s);
      let cupsForSize = Infinity;
      for (const item of itemsForSize) {
        if (!item.ingredient || item.amount <= 0) continue;
        const available = Math.floor(
          (item.ingredient.stock ?? 0) / item.amount
        );
        if (available < cupsForSize) {
          cupsForSize = available;
        }
      }
      bySize[s] = cupsForSize === Infinity ? 0 : cupsForSize;
    }

    return Object.keys(bySize).length > 0 ? Math.max(...Object.values(bySize)) : 0;
  }

  // Hàm này lấy toàn bộ bảng Product kèm tính toán tồn kho theo nguyên liệu
  async findAll() {
    const products = await this.prisma.product.findMany({
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return products.map((product: any) => {
      if (!product.recipeItems) {
        return product;
      }
      const { recipeItems, ...rest } = product;
      const stock = this.calculateAvailability(recipeItems);
      return {
        ...rest,
        stock,
      };
    });
  }

  // Hàm lấy chi tiết một sản phẩm theo id
  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${id}`);
    }

    if (!(product as any).recipeItems) {
      return product;
    }

    const { recipeItems, ...rest } = product as any;
    const stock = this.calculateAvailability(recipeItems);
    return {
      ...rest,
      stock,
    };
  }
}
