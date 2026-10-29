import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ValidatePromotionQueryDto {
  @ApiProperty({ example: 'BREW10' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã khuyến mãi' })
  code!: string;

  @ApiProperty({ example: 80000, description: 'Tạm tính của giỏ hàng (VND)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal!: number;
}
