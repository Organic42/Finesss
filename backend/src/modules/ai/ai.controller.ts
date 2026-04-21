import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ChatDto } from './dto/chat.dto.js';

@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.service.chat(dto.message, dto.context);
  }
}
