import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionsService } from '../services/options.service.js';

@ApiTags('Options')
@Controller('options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách kích cỡ (sizes) và toppings cùng bảng giá',
  })
  async getOptions() {
    return this.optionsService.getOptions();
  }

  @Get('toppings')
  @ApiOperation({
    summary: 'Lấy danh sách toppings từ cơ sở dữ liệu',
  })
  async getToppings() {
    return this.optionsService.getToppings();
  }
}
