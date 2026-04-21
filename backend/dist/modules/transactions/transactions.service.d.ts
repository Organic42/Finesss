import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { KpiQueryDto } from './dto/kpi-query.dto.js';
export declare class TransactionsService {
    private readonly repo;
    constructor(repo: Repository<Transaction>);
    create(dto: CreateTransactionDto): Promise<Transaction>;
    findAll(userId?: string): Promise<Transaction[]>;
    findOne(id: string): Promise<Transaction>;
    remove(id: string): Promise<void>;
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
    ingestCsv(buffer: Buffer, userId?: string): Promise<{
        inserted: number;
        skipped: number;
        errors: {
            row: number;
            reason: string;
        }[];
    }>;
}
