import { TransactionsService } from './transactions.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { KpiQueryDto } from './dto/kpi-query.dto.js';
export declare class TransactionsController {
    private readonly service;
    constructor(service: TransactionsService);
    findAll(userId?: string): Promise<import("./entities/transaction.entity.js").Transaction[]>;
    getKpi(query: KpiQueryDto): Promise<{
        userId: string;
        start: string;
        end: string;
        revenue: number;
        expense: number;
        profit: number;
        margin: number;
        transactionCount: number;
        series: {
            date: string;
            income: number;
            expense: number;
        }[];
    }>;
    findOne(id: string): Promise<import("./entities/transaction.entity.js").Transaction>;
    create(dto: CreateTransactionDto): Promise<import("./entities/transaction.entity.js").Transaction>;
    upload(file: Express.Multer.File, userId?: string): Promise<{
        inserted: number;
        skipped: number;
        errors: {
            row: number;
            reason: string;
        }[];
    }>;
    remove(id: string): Promise<void>;
}
