import { Module } from '@nestjs/common';
import { OptionsController } from '../controllers/options.controller.js';
import { OptionsService } from '../services/options.service.js';

@Module({
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
