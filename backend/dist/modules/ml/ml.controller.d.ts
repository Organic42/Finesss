import { MlService } from './ml.service.js';
import { ForecastQueryDto } from './dto/forecast-query.dto.js';
export declare class MlController {
    private readonly service;
    constructor(service: MlService);
    train(userId?: string): Promise<any>;
    forecast(query: ForecastQueryDto): Promise<any>;
}
