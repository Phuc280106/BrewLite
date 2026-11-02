import { Module } from '@nestjs/common';
import { OptionsController } from '../controllers/options.controller.js';
import { OptionsService } from '../services/options.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
