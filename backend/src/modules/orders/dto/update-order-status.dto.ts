import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../order-state-machine.js';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PREPARING,
    description: 'Trạng thái mới của đơn hàng',
  })
  @IsEnum(OrderStatus, {
    message: `Trạng thái không hợp lệ. Chỉ chấp nhận: ${Object.values(OrderStatus).join(', ')}`,
  })
  status!: OrderStatus;
}
