import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ALLOWED_SIZE_IDS,
} from '../../common/constants/options.constants.js';
import type { ProductSizeId } from '../../common/constants/options.constants.js';

export class CreateOrderItemDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty({ enum: ALLOWED_SIZE_IDS, example: 'M' })
  @IsIn(ALLOWED_SIZE_IDS)
  size!: ProductSizeId;

  @ApiProperty({ isArray: true, example: ['pearl', '1'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  toppings!: string[];

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiPropertyOptional({
    example: 'BREW10',
    description: 'Mã khuyến mãi áp dụng cho đơn hàng',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Số điểm tích lũy thành viên sử dụng để giảm tiền (1 điểm = 1.000đ)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsUsed?: number;
}
