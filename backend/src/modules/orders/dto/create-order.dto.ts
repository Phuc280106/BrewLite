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
import {
  ALLOWED_SIZE_IDS,
  ALLOWED_TOPPING_IDS,
} from '../../options/options.constants.js';
import type { ProductSizeId } from '../../options/options.constants.js';

export class CreateOrderItemDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  productId!: number;

  @ApiProperty({ enum: ALLOWED_SIZE_IDS, example: 'M' })
  @IsIn(ALLOWED_SIZE_IDS)
  size!: ProductSizeId;

  @ApiProperty({ enum: ALLOWED_TOPPING_IDS, isArray: true, example: ['pearl'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLOWED_TOPPING_IDS, { each: true })
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
