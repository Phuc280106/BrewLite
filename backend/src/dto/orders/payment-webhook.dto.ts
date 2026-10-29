import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'TXN_1729123456_BL000001', description: 'Mã giao dịch ngân hàng' })
  @IsString()
  @IsNotEmpty()
  transactionRef!: string;

  @ApiProperty({ example: 1, description: 'ID đơn hàng trong hệ thống BrewLite' })
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @ApiProperty({ example: 65000, description: 'Số tiền khách thực chuyển' })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({ example: 'SUCCESS', description: 'Trạng thái giao dịch từ phía ngân hàng' })
  @IsString()
  @IsNotEmpty()
  status!: string; // 'SUCCESS' | 'FAILED'

  @ApiProperty({ example: 'BL-000001 Napas247', description: 'Nội dung chuyển khoản' })
  @IsString()
  message!: string;
}