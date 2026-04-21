import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { Transaction } from './entities/transaction.entity.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { KpiQueryDto } from './dto/kpi-query.dto.js';

type CsvRow = Record<string, string>;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const entity = this.repo.create({
      userId: dto.userId ?? 'default_user',
      date: dto.date,
      income: dto.income ?? 0,
      expense: dto.expense ?? 0,
    });
    return this.repo.save(entity);
  }

  async findAll(userId?: string): Promise<Transaction[]> {
    return this.repo.find({
      where: userId ? { userId } : {},
      order: { date: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.repo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException(`Transaction ${id} not found`);
  }

  async getKpi(query: KpiQueryDto) {
    const userId = query.userId ?? 'default_user';
    const start = query.start ?? '1900-01-01';
    const end = query.end ?? '2999-12-31';

    const rows = await this.repo.find({
      where: { userId, date: Between(start, end) },
      order: { date: 'ASC' },
    });

    let revenue = 0;
    let expense = 0;
    for (const r of rows) {
      revenue += Number(r.income);
      expense += Number(r.expense);
    }
    const profit = revenue - expense;
    const margin = revenue > 0 ? profit / revenue : 0;

    return {
      userId,
      start,
      end,
      revenue: round2(revenue),
      expense: round2(expense),
      profit: round2(profit),
      margin: round2(margin),
      transactionCount: rows.length,
      series: rows.map((r) => ({
        date: r.date,
        income: Number(r.income),
        expense: Number(r.expense),
      })),
    };
  }

  async ingestCsv(buffer: Buffer, userId = 'default_user') {
    if (!buffer?.length) throw new BadRequestException('Empty file');

    let records: CsvRow[];
    try {
      records = parse(buffer, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
      }) as CsvRow[];
    } catch (err) {
      throw new BadRequestException(`Invalid CSV: ${(err as Error).message}`);
    }

    if (!records.length) throw new BadRequestException('CSV contains no rows');

    const entities: Transaction[] = [];
    const errors: { row: number; reason: string }[] = [];

    records.forEach((row, idx) => {
      const dateRaw = row.date ?? row.day ?? row.transaction_date;
      if (!dateRaw) {
        errors.push({ row: idx + 2, reason: 'Missing date column' });
        return;
      }
      const date = normalizeDate(dateRaw);
      if (!date) {
        errors.push({ row: idx + 2, reason: `Unparseable date: ${dateRaw}` });
        return;
      }
      const income = parseAmount(row.income ?? row.revenue ?? row.sales);
      const expense = parseAmount(row.expense ?? row.expenses ?? row.cost);

      entities.push(
        this.repo.create({
          userId: row.userid || row.user_id || userId,
          date,
          income,
          expense,
        }),
      );
    });

    if (!entities.length) {
      throw new BadRequestException({ message: 'No valid rows found', errors });
    }

    const chunkSize = 500;
    for (let i = 0; i < entities.length; i += chunkSize) {
      await this.repo.save(entities.slice(i, i + chunkSize));
    }

    return {
      inserted: entities.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    };
  }
}

function parseAmount(raw: string | undefined): number {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[,\s$]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeDate(raw: string): string | null {
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const yyyy = c.length === 2 ? `20${c}` : c;
    const mm = a.padStart(2, '0');
    const dd = b.padStart(2, '0');
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
