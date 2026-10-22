import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsPositive } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 1, description: 'ID của đơn hàng cần thanh toán' })
  @IsInt()
  @IsPositive()
  orderId: number;

  @ApiProperty({
    example: 'WALLET',
    enum: ['WALLET', 'CARD'],
    description: 'Phương thức thanh toán: Ví điện tử (WALLET) hoặc Thẻ ngân hàng (CARD)',
  })
  @IsIn(['WALLET', 'CARD'])
  method: 'WALLET' | 'CARD';
}
