import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    } as unknown as PrismaService;

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
    } as unknown as JwtService;

    service = new AuthService(prisma, jwtService);
  });

  describe('register', () => {
    it('registers a new user and returns a token', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        email: 'test@brewlite.vn',
        name: 'Tester',
        passwordHash: 'hashed_password',
        loyaltyPoints: 0,
        createdAt: new Date(),
      } as any);

      const result = await service.register({
        email: 'TEST@brewlite.vn',
        password: 'password123',
        name: 'Tester',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@brewlite.vn' },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@brewlite.vn',
      });
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@brewlite.vn');
    });

    it('throws ConflictException if email is already taken', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 2,
        email: 'existing@brewlite.vn',
      } as any);

      await expect(
        service.register({
          email: 'existing@brewlite.vn',
          password: 'password123',
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('logs in successfully with valid credentials', async () => {
      const mockHashed = await bcrypt.hash('secret123', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 5,
        email: 'user@brewlite.vn',
        passwordHash: mockHashed,
        name: 'User',
        loyaltyPoints: 10,
        createdAt: new Date(),
      } as any);

      const result = await service.login({
        email: 'user@brewlite.vn',
        password: 'secret123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(5);
    });

    it('throws UnauthorizedException if user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notfound@brewlite.vn',
          password: 'password',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if password does not match', async () => {
      const mockHashed = await bcrypt.hash('correct_password', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 6,
        email: 'user@brewlite.vn',
        passwordHash: mockHashed,
        name: 'User',
      } as any);

      await expect(
        service.login({
          email: 'user@brewlite.vn',
          password: 'wrong_password',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
