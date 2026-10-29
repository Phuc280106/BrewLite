import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import { PayOrderDto } from './pay-order.dto.js';

export class CreatePaymentDto extends PayOrderDto {
  @ApiProperty({ example: 1, description: 'ID của đơn hàng cần thanh toán' })
  @IsInt()
  @IsPositive()
  orderId!: number;
}