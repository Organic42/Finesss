import { ConfigService } from '@nestjs/config';
export declare class AiService {
    private readonly config;
    private readonly logger;
    private client;
    constructor(config: ConfigService);
    private getClient;
    chat(message: string, context?: Record<string, unknown>): Promise<{
        reply: string;
        model: string;
    }>;
    private generate;
    private shouldFallback;
}
