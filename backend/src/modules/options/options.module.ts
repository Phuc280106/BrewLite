import { Module } from '@nestjs/common';
import { OptionsController } from './options.controller.js';
import { OptionsService } from './options.service.js';

@Module({
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
