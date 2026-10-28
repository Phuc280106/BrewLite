import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  // Hàm này lấy toàn bộ bảng Product
  async findAll() {
    return this.prisma.product.findMany();
  }

  // Hàm lấy chi tiết một sản phẩm theo id
  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id: ${id}`);
    }

    return product;
  }
}