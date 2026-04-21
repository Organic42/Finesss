"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sync_1 = require("csv-parse/sync");
const transaction_entity_js_1 = require("./entities/transaction.entity.js");
let TransactionsService = class TransactionsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async create(dto) {
        const entity = this.repo.create({
            userId: dto.userId ?? 'default_user',
            date: dto.date,
            income: dto.income ?? 0,
            expense: dto.expense ?? 0,
        });
        return this.repo.save(entity);
    }
    async findAll(userId) {
        return this.repo.find({
            where: userId ? { userId } : {},
            order: { date: 'ASC' },
        });
    }
    async findOne(id) {
        const tx = await this.repo.findOne({ where: { id } });
        if (!tx)
            throw new common_1.NotFoundException(`Transaction ${id} not found`);
        return tx;
    }
    async remove(id) {
        const result = await this.repo.delete(id);
        if (!result.affected)
            throw new common_1.NotFoundException(`Transaction ${id} not found`);
    }
    async getKpi(query) {
        const userId = query.userId ?? 'default_user';
        const start = query.start ?? '1900-01-01';
        const end = query.end ?? '2999-12-31';
        const rows = await this.repo.find({
            where: { userId, date: (0, typeorm_2.Between)(start, end) },
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
    async ingestCsv(buffer, userId = 'default_user') {
        if (!buffer?.length)
            throw new common_1.BadRequestException('Empty file');
        let records;
        try {
            records = (0, sync_1.parse)(buffer, {
                columns: (header) => header.map((h) => h.trim().toLowerCase()),
                skip_empty_lines: true,
                trim: true,
            });
        }
        catch (err) {
            throw new common_1.BadRequestException(`Invalid CSV: ${err.message}`);
        }
        if (!records.length)
            throw new common_1.BadRequestException('CSV contains no rows');
        const entities = [];
        const errors = [];
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
            entities.push(this.repo.create({
                userId: row.userid || row.user_id || userId,
                date,
                income,
                expense,
            }));
        });
        if (!entities.length) {
            throw new common_1.BadRequestException({ message: 'No valid rows found', errors });
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
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_js_1.Transaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TransactionsService);
function parseAmount(raw) {
    if (raw == null || raw === '')
        return 0;
    const n = Number(String(raw).replace(/[,\s$]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : 0;
}
function normalizeDate(raw) {
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
        if (!Number.isNaN(d.getTime()))
            return d.toISOString().slice(0, 10);
    }
    return null;
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=transactions.service.js.map