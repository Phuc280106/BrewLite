import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidatePromotionQueryDto } from './dto/validate-promotion.dto.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('validate')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Kiểm tra mã giảm giá và xem trước số tiền được giảm (US-10.4)',
  })
  validate(@Query() query: ValidatePromotionQueryDto) {
    return this.promotionsService.validate(query.code, query.subtotal);
  }
}
