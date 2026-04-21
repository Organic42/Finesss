import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { Transaction } from '../modules/transactions/entities/transaction.entity.js';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<number>('DB_PORT')),
    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_DATABASE'),
    entities: [Transaction],
    synchronize: String(config.get('DB_SYNCHRONIZE')) === 'true',
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
  }),
};
