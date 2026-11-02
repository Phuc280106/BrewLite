import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { ProductService } from './product.service.js';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns all products', async () => {
      const mockProducts = [{ id: 1, name: 'Cà phê sữa đá' }];
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any);

      const result = await service.findAll();
      expect(result).toEqual(mockProducts);
    });

    it('calculates stock from recipeItems for each product', async () => {
      const mockProductsWithRecipe = [
        {
          id: 1,
          name: 'Cà phê sữa đá',
          recipeItems: [
            {
              size: 'M',
              amount: 20,
              ingredient: { id: 1, name: 'Hạt cà phê', stock: 100 },
            },
          ],
        },
      ];
      vi.mocked(prisma.product.findMany).mockResolvedValue(mockProductsWithRecipe as any);

      const result = await service.findAll();
      expect(result).toEqual([
        {
          id: 1,
          name: 'Cà phê sữa đá',
          stock: 5,
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns a product by id', async () => {
      const mockProduct = { id: 1, name: 'Cà phê sữa đá', price: 25000 };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);

      const result = await service.findOne(1);
      expect(result).toEqual(mockProduct);
      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } })
      );
    });

    it('calculates stock from recipeItems when available', async () => {
      const mockProductWithRecipe = {
        id: 1,
        name: 'Cà phê sữa đá',
        price: 25000,
        recipeItems: [
          {
            size: 'M',
            amount: 20,
            ingredient: { id: 1, name: 'Hạt cà phê', stock: 100 },
          },
        ],
      };
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProductWithRecipe as any);

      const result = await service.findOne(1);
      expect(result).toEqual({
        id: 1,
        name: 'Cà phê sữa đá',
        price: 25000,
        stock: 5,
      });
    });

    it('throws NotFoundException if product is not found', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
