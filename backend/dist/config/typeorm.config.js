"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeOrmAsyncConfig = void 0;
const config_1 = require("@nestjs/config");
const transaction_entity_js_1 = require("../modules/transactions/entities/transaction.entity.js");
exports.typeOrmAsyncConfig = {
    inject: [config_1.ConfigService],
    useFactory: (config) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: Number(config.get('DB_PORT')),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        entities: [transaction_entity_js_1.Transaction],
        synchronize: String(config.get('DB_SYNCHRONIZE')) === 'true',
        logging: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    }),
};
//# sourceMappingURL=typeorm.config.js.map