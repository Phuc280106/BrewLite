import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum PaymentMethodEnum {
  VNPAY = 'VNPAY',
  VIETQR = 'VIETQR',
  MOMO = 'MOMO',
  CARD = 'CARD',
}

export class InitiatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID của đơn hàng PENDING hoặc PAYMENT_FAILED' })
  @IsInt()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({
    example: PaymentMethodEnum.VNPAY,
    enum: PaymentMethodEnum,
    description: 'Phương thức thanh toán khách chọn (VNPay Sandbox)',
  })
  @IsEnum(PaymentMethodEnum)
  @IsNotEmpty()
  method!: PaymentMethodEnum;

  @ApiPropertyOptional({
    example: 'VNBANK',
    description: 'Mã tab mở sẵn trên VNPay: VNPAYQR (Quét QR), VNBANK (Thẻ ATM nội địa), INTCARD (Thẻ quốc tế)',
  })
  @IsOptional()
  @IsString()
  bankCode?: string;
}
