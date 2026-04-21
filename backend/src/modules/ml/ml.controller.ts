import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { MlService } from './ml.service.js';
import { ForecastQueryDto } from './dto/forecast-query.dto.js';

@Controller('ml')
export class MlController {
  constructor(private readonly service: MlService) {}

  @Post('train')
  train(@Body('userId') userId?: string) {
    return this.service.train(userId ?? 'default_user');
  }

  @Get('forecast')
  forecast(@Query() query: ForecastQueryDto) {
    return this.service.forecast(query.months ?? 6);
  }
}
