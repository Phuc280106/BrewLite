import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Đã kết nối cơ sở dữ liệu PostgreSQL thành công.');
    } catch (error) {
      this.logger.warn(
        'Chưa thể kết nối CSDL PostgreSQL (kiểm tra DATABASE_URL trong .env). Ứng dụng vẫn đang chạy ở chế độ dev.'
      );
    }
  }
}
