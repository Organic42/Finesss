import { AiService } from './ai.service.js';
import { ChatDto } from './dto/chat.dto.js';
export declare class AiController {
    private readonly service;
    constructor(service: AiService);
    chat(dto: ChatDto): Promise<{
        reply: string;
        model: string;
    }>;
}
