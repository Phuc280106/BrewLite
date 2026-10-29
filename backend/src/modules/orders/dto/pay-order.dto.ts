import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const PAYMENT_METHODS = ['WALLET', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class PayOrderDto {
  @ApiProperty({
    example: 'WALLET',
    enum: PAYMENT_METHODS,
    description:
      'Phương thức thanh toán: Ví điện tử (WALLET: MoMo, VNPay) hoặc Thẻ ngân hàng (CARD)',
  })
  @IsIn(PAYMENT_METHODS, {
    message: `Phương thức thanh toán không hợp lệ. Chỉ chấp nhận: ${PAYMENT_METHODS.join(', ')}`,
  })
  method!: PaymentMethod;
}