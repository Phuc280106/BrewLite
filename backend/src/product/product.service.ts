import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  // Hàm này lấy toàn bộ bảng Product
  async findAll() {
    return this.prisma.product.findMany();
  }
}