import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const CART_SIZES = ['S', 'M', 'L'] as const;
const TOPPING_IDS = ['pearl', 'cheese', 'peach_jelly'] as const;

export class CreateOrderItemDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty({ enum: CART_SIZES, example: 'M' })
  @IsIn(CART_SIZES)
  size!: (typeof CART_SIZES)[number];

  @ApiProperty({ enum: TOPPING_IDS, isArray: true, example: ['pearl'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(TOPPING_IDS, { each: true })
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
}
