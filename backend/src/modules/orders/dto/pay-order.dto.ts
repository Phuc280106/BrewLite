import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive } from 'class-validator';

export class PayOrderDto {
    @ApiProperty({ example: 'WALLET', enum: ['WALLET', 'CARD'] })
    @IsIn(['WALLET', 'CARD'])
    method: 'WALLET' | 'CARD';

    @ApiProperty({ example: 70000 })
    @IsNumber()
    @IsPositive()
    amount: number;
}
