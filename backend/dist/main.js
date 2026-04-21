"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors({
        origin: config.get('CORS_ORIGIN') ?? 'http://localhost:3000',
        credentials: true,
    });
    const port = Number(config.get('PORT') ?? 4000);
    await app.listen(port);
    console.log(`FinEase backend listening on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map