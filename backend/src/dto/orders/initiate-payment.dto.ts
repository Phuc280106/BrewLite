import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty } from 'class-validator';

export enum PaymentMethodEnum {
  VIETQR = 'VIETQR',
  MOMO = 'MOMO',
  VNPAY = 'VNPAY',
  CARD = 'CARD',
}

export class InitiatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID của đơn hàng PENDING' })
  @IsInt()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({
    example: PaymentMethodEnum.VIETQR,
    enum: PaymentMethodEnum,
    description: 'Phương thức thanh toán khách chọn',
  })
  @IsEnum(PaymentMethodEnum)
  @IsNotEmpty()
  method!: PaymentMethodEnum;
}