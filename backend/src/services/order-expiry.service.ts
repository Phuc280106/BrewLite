import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { OrderStatus } from '../common/state-machine/order-state-machine.js';

/** Thời gian tối đa (phút) kể từ khi tạo đơn mà chưa được thanh toán. */
export const PAYMENT_TTL_MINUTES = 1;

/**
 * Chạy mỗi phút, tìm các đơn hàng PENDING / PAYMENT_FAILED quá TTL và:
 *   1. Hoàn trả tồn kho (rollback stock) cho từng sản phẩm trong đơn.
 *   2. Chuyển trạng thái đơn sang CANCELLED.
 *
 * Hai bước trên được thực hiện trong cùng một transaction để đảm bảo
 * tính nguyên tử — không thể hoàn kho mà đơn vẫn PENDING hoặc ngược lại.
 */
@Injectable()
export class OrderExpiryService {
  private readonly logger = new Logger(OrderExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - PAYMENT_TTL_MINUTES * 60 * 1000);

    // Lấy các đơn hết hạn kèm items (để biết cần hoàn bao nhiêu stock về)
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        status: true,
        items: { select: { productId: true, qty: true } },
      },
    });

    if (staleOrders.length === 0) return;

    this.logger.log(
      `[PaymentTTL] Tìm thấy ${staleOrders.length} đơn hàng hết hạn, bắt đầu hoàn kho và huỷ...`
    );

    let cancelled = 0;
    let failed = 0;

    for (const order of staleOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-check trong transaction để tránh race với webhook PAID đến đúng lúc
          const current = await tx.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          });

          // Nếu đơn vừa được thanh toán (webhook đến đồng thời) thì bỏ qua
          if (
            !current ||
            (current.status !== OrderStatus.PENDING &&
              current.status !== OrderStatus.PAYMENT_FAILED)
          ) {
            return;
          }

          // Hoàn trả tồn kho cho từng sản phẩm
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.qty } },
            });
          }

          // Chuyển đơn sang CANCELLED
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED },
          });
        });

        cancelled++;
        this.logger.log(
          `[PaymentTTL] Đơn #${order.id} đã huỷ và hoàn kho thành công.`
        );
      } catch (err) {
        failed++;
        this.logger.error(
          `[PaymentTTL] Lỗi khi huỷ đơn #${order.id}: ${(err as Error).message}`
        );
      }
    }

    this.logger.log(
      `[PaymentTTL] Hoàn thành: ${cancelled} huỷ thành công, ${failed} thất bại.`
    );
  }
}
