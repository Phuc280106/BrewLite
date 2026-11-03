import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service.js';
import { OrderStatus } from '../common/state-machine/order-state-machine.js';

/** Thời gian tối đa (phút) kể từ khi tạo đơn mà chưa được thanh toán (10 phút). */
export const PAYMENT_TTL_MINUTES = 10;
export const PAYMENT_TTL_SECONDS = PAYMENT_TTL_MINUTES * 60;

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

          // Hoàn trả tồn kho nguyên liệu (nếu có công thức)
          const recipeItems = (tx as any).recipeItem?.findMany
            ? await (tx as any).recipeItem.findMany({
                where: { productId: { in: order.items.map((it: any) => it.productId) } },
              })
            : [];

          if (recipeItems.length > 0 && (tx as any).ingredient?.update) {
            for (const item of order.items as any[]) {
              const matched = recipeItems.filter(
                (r: any) => r.productId === item.productId && (!item.size || r.size === item.size)
              );
              for (const r of matched) {
                await (tx as any).ingredient.update({
                  where: { id: r.ingredientId },
                  data: {
                    stock: { increment: Math.round(r.amount * item.qty) },
                    version: { increment: 1 },
                  },
                });
              }
            }
          }

          // Hoàn trả tồn kho cho từng sản phẩm (nếu Product model còn trường stock)
          if ((tx as any).product?.update) {
            for (const item of order.items) {
              try {
                await (tx as any).product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.qty } },
                });
              } catch {
                // Product không có trường stock thì an toàn bỏ qua
              }
            }
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
