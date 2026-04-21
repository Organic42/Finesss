import { ConfigService } from '@nestjs/config';
export declare class MlService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    train(userId?: string): Promise<any>;
    forecast(months?: number): Promise<any>;
    private mlDir;
    private resolvePython;
    private runPython;
    private parseJson;
}
