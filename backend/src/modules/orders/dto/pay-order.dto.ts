import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PayOrderDto {
    @ApiProperty({ example: 'WALLET', enum: ['WALLET', 'CARD'], description: 'Phương thức thanh toán' })
    @IsIn(['WALLET', 'CARD'])
    method: 'WALLET' | 'CARD';
}
