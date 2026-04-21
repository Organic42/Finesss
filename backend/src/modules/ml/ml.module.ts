import { Module } from '@nestjs/common';
import { MlController } from './ml.controller.js';
import { MlService } from './ml.service.js';

@Module({
  controllers: [MlController],
  providers: [MlService],
  exports: [MlService],
})
export class MlModule {}
