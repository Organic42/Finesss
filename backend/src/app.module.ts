import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { typeOrmAsyncConfig } from './config/typeorm.config.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { MlModule } from './modules/ml/ml.module.js';
import { AiModule } from './modules/ai/ai.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    TransactionsModule,
    MlModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
